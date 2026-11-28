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
