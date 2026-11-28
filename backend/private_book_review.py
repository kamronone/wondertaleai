"""Opt-in local whole-book review queue. No HTTP route or provider calls.

The public single-page limit is unchanged. This operator-only preparation
does not approve moderation, reserve budget, or start any worker.
"""
import hashlib
import hmac
import json
import os
import time
import uuid

import secure_main as db
from private_character_continuity import plan_reference_book
from private_character_sheet_store import (
    CharacterSheetUnavailable, _id, _transaction, _snapshot,
)


def prepare_book_review(owner: str, book_id: str, style: str, hero_mode: str) -> dict:
    """Atomically prepare at most one active book/design, up to 20 pages.

    Existing requests are reused only when still valid for the same reference.
    Cancelled/expired requests are never recreated here: their attempt history
    may represent a charge. An operator must reconcile them separately.
    """
    if (os.getenv("APP_ENV", "").lower() != "development"
            or os.getenv("ENABLE_PERSONAL_BOOK_REVIEW", "false").lower() != "true"):
        raise CharacterSheetUnavailable("Whole-book review disabled")
    book_id = _id(book_id)
    with _transaction(owner) as c:
        if not db.photo_consent_active(owner, c) or not db.external_photo_transfer_consent_active(owner, c):
            raise CharacterSheetUnavailable("Current parental permissions required")
        now = int(time.time())
        story = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?",
                       (book_id, owner)).fetchone()
        photo = db.sql(c, "SELECT jpeg_bytes,sha256,expires_at FROM photo_reference_temp "
                       "WHERE owner_id=? AND expires_at>?", (owner, now)).fetchone()
        if not story or not photo:
            raise CharacterSheetUnavailable("Private book or reference unavailable")
        digest, expiry = photo[1], photo[2]
        if not hmac.compare_digest(hashlib.sha256(bytes(photo[0])).hexdigest(), digest):
            raise CharacterSheetUnavailable("Reference integrity mismatch")
        try:
            pages = json.loads(story[0])["pages"]
            if not isinstance(pages, list) or any(
                not isinstance(page, dict) or type(page.get("number")) is not int
                or page["number"] != i for i, page in enumerate(pages, 1)
            ):
                raise ValueError("Invalid page sequence")
            plan = plan_reference_book(book_id, [p["text"] for p in pages], style, hero_mode)
        except (ValueError, TypeError, KeyError, IndexError) as exc:
            raise CharacterSheetUnavailable("Book is not eligible for whole-book review") from exc
        total = len(plan.pages)
        active = db.sql(c, "SELECT book_id,style,hero_mode FROM photo_illustration_requests "
            "WHERE owner_id=? AND status='pending_review' AND expires_at>?",
            (owner, now)).fetchall()
        if any(tuple(row) != (book_id, style, hero_mode) for row in active):
            raise CharacterSheetUnavailable("Another active book or design requires review")
        existing = db.sql(c, "SELECT id,page_number,reference_sha256,status,expires_at "
            "FROM photo_illustration_requests WHERE owner_id=? AND book_id=? AND style=? AND hero_mode=?",
            (owner, book_id, style, hero_mode)).fetchall()
        by_page = {}
        for rid, page, saved_digest, status, saved_expiry in existing:
            if (type(page) is not int or not 1 <= page <= total or page in by_page
                    or saved_digest != digest or status != "pending_review"
                    or not now < saved_expiry <= expiry):
                raise CharacterSheetUnavailable("Existing request requires reconciliation")
            # Validate ownership, consent, reference bytes and current scene plan.
            if _snapshot(c, owner, rid)[5] != plan.fingerprint:
                raise CharacterSheetUnavailable("Existing plan requires reconciliation")
            by_page[page] = rid
        created = 0
        for page in plan.pages:
            if page.page_number in by_page:
                continue
            rid = str(uuid.uuid4())
            db.sql(c, "INSERT INTO photo_illustration_requests "
                "(id,owner_id,book_id,page_number,style,hero_mode,reference_sha256,status,created_at,expires_at) "
                "VALUES(?,?,?,?,?,?,?,'pending_review',?,?)",
                (rid, owner, book_id, page.page_number, style, hero_mode, digest, now, expiry))
            by_page[page.page_number] = rid
            created += 1
        # All new rows commit together, or none do. No attempt or budget rows
        # are touched. The existing one-shot workers retain their own gates.
        return {"total_pages": total, "created": created, "reused": total-created,
                "generation_started": False, "budget_reserved": False}


def next_book_review_step(owner: str, book_id: str, style: str, hero_mode: str) -> dict:
    """Read-only operator preflight, not a reservation or a worker scheduler.

    Estimate only remaining image edits at the configured per-attempt amount.
    Moderation and actual provider billing are not included. A subsequent
    worker must independently revalidate permission and atomically reserve
    budget; this snapshot cannot authorize any external request.
    """
    from datetime import datetime, timezone
    from photo_illustration_budget import _gate, _positive_limit
    from private_character_page_worker import _context, _read_page

    if (os.getenv("APP_ENV", "").lower() != "development"
            or os.getenv("ENABLE_PERSONAL_BOOK_REVIEW", "false").lower() != "true"):
        raise CharacterSheetUnavailable("Whole-book review disabled")
    book_id = _id(book_id)
    with _transaction(owner) as c:
        _gate(c)
        estimate = _positive_limit("PHOTO_EDIT_ESTIMATE_MICRO_USD", 2_000_000)
        global_cap = _positive_limit("PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD", 20_000_000)
        parent_cap = _positive_limit("PHOTO_EDIT_DAILY_PARENT_MICRO_USD", 5_000_000)
        now = int(time.time())
        story = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?",
                       (book_id, owner)).fetchone()
        if not story:
            raise CharacterSheetUnavailable("Private book unavailable")
        try:
            chapters = json.loads(story[0])["pages"]
            if not isinstance(chapters, list) or any(
                not isinstance(p, dict) or type(p.get("number")) is not int
                or p["number"] != i for i, p in enumerate(chapters, 1)
            ):
                raise ValueError("Invalid page sequence")
            plan = plan_reference_book(book_id, [p["text"] for p in chapters], style, hero_mode)
        except (ValueError, TypeError, KeyError, IndexError) as exc:
            raise CharacterSheetUnavailable("Private book unavailable") from exc
        rows = db.sql(c, "SELECT id,page_number FROM photo_illustration_requests "
            "WHERE owner_id=? AND book_id=? AND style=? AND hero_mode=? "
            "AND status='pending_review' AND expires_at>? ORDER BY page_number",
            (owner, book_id, style, hero_mode, now)).fetchall()
        if [r[1] for r in rows] != list(range(1, len(plan.pages)+1)):
            raise CharacterSheetUnavailable("Complete active review queue required")
        snapshots = [_snapshot(c, owner, rid) for rid, _ in rows]
        if any(s[5] != plan.fingerprint or s[3] != snapshots[0][3] for s in snapshots):
            raise CharacterSheetUnavailable("Review plan changed")
        sheet = db.sql(c, "SELECT 1 FROM photo_character_sheets WHERE owner_id=? "
            "AND book_id=? AND style=? AND hero_mode=?",
            (owner, book_id, style, hero_mode)).fetchone()
        sheet_attempt = db.sql(c, "SELECT state FROM photo_sheet_attempts WHERE owner_id=? "
            "AND book_id=? AND style=? AND hero_mode=?",
            (owner, book_id, style, hero_mode)).fetchone()
        ready = []
        pending = []
        uncertain = []
        for rid, number in rows:
            attempted = db.sql(c, "SELECT 1 FROM photo_ai_attempt_reservations "
                "WHERE request_id=? AND owner_id=?", (rid, owner)).fetchone()
            if sheet:
                try:
                    key, _ = _context(c, owner, rid)
                    if _read_page(c, owner, rid, key) is not None:
                        ready.append(number)
                        continue
                except CharacterSheetUnavailable:
                    uncertain.append(number)
                    continue
            if attempted:
                uncertain.append(number)
            else:
                pending.append(number)
        day = datetime.now(timezone.utc).date().isoformat()
        global_row = db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_daily_budget WHERE day=?",
                            (day,)).fetchone()
        parent_row = db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_parent_budget WHERE owner_id=? AND day=?",
                            (owner, day)).fetchone()
        remaining = min(max(0, global_cap-(global_row[0] if global_row else 0)),
                        max(0, parent_cap-(parent_row[0] if parent_row else 0)))
        required = (len(pending)+(0 if sheet else 1))*estimate
        state, next_page = "complete", None
        if uncertain or (not sheet and sheet_attempt) or (sheet_attempt and sheet_attempt[0] != "ready"):
            state = "needs_review"
        elif pending or not sheet:
            if required > remaining:
                state = "budget_insufficient"
            elif not sheet:
                state, next_page = "prepare_character", 1
            else:
                state, next_page = "prepare_page", pending[0]
        return {"state": state, "next_page": next_page, "ready_pages": len(ready),
                "total_pages": len(rows), "uncertain_pages": uncertain,
                "estimated_remaining_micro_usd": required,
                "available_daily_micro_usd": remaining,
                "budget_reserved": False, "provider_called": False}
