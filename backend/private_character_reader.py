"""Read-only local personal illustration bridge for the private reader.

No provider call, upload, queue mutation or generation entry point.
An expired/revoked image is never returned from this bridge.
"""
import os
import time

import secure_main as db
from private_character_sheet_store import _transaction, _snapshot, CharacterSheetUnavailable
from private_character_page_worker import _context, _read_page


def reader_enabled():
    return (db.photo_reference_upload_enabled()
            and os.getenv("ENABLE_CHARACTER_SHEET_STORAGE", "false").lower() == "true"
            and os.getenv("ENABLE_CHARACTER_PAGE_READER", "false").lower() == "true")


def lookup_personal_page(owner, book, page):
    """Return metadata for the newest valid personal request, if any."""
    if not reader_enabled():
        return None
    try:
        with _transaction(owner) as c:
            requests = db.sql(c, "SELECT id FROM photo_illustration_requests "
                "WHERE owner_id=? AND book_id=? AND page_number=? "
                "AND status='pending_review' AND expires_at>? "
                "ORDER BY created_at DESC,id DESC LIMIT 1",
                (owner, book, page, int(time.time()))).fetchone()
            if not requests:
                return None
            rid = requests[0]
            _snapshot(c, owner, rid)
            try:
                key, _ = _context(c, owner, rid)
                png = _read_page(c, owner, rid, key)
                if png is not None:
                    return {"job_id": rid, "kind": "personal", "expires_at": key[3]}
            except CharacterSheetUnavailable:
                pass
            attempt = db.sql(c, "SELECT 1 FROM photo_ai_attempt_reservations "
                "WHERE request_id=? AND owner_id=?", (rid, owner)).fetchone()
            return {"status": "needs_review" if attempt else "pending_review"}
    except CharacterSheetUnavailable:
        return None


def read_personal_page(owner, rid):
    if not reader_enabled():
        return None
    try:
        with _transaction(owner) as c:
            key, _ = _context(c, owner, rid)
            return _read_page(c, owner, rid, key)
    except CharacterSheetUnavailable:
        return None


def personal_book_readiness(owner: str, book_id: str, style: str, hero_mode: str) -> dict:
    """Internal local-only report for a single book and character design.

    No provider, job creation, retry, or storage mutation. Do not expose as a
    public API: it is an operator diagnostic, not authorization to generate.
    A ready page must pass the same consent, reference, plan and PNG integrity
    checks as the reader. Report only counts and page numbers, never images,
    reference hashes, story text, or request IDs.
    """
    import json
    from private_character_sheet_store import _id
    from private_character_continuity import plan_reference_book

    if not reader_enabled():
        raise CharacterSheetUnavailable("Private reader disabled")
    book_id = _id(book_id)
    with _transaction(owner) as c:
        story = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?",
                       (book_id, owner)).fetchone()
        now = int(time.time())
        if (not story or not db.photo_consent_active(owner, c)
                or not db.external_photo_transfer_consent_active(owner, c)):
            raise CharacterSheetUnavailable("Private book unavailable")
        if not db.sql(c, "SELECT 1 FROM photo_reference_temp WHERE owner_id=? AND expires_at>?",
                      (owner, now)).fetchone():
            raise CharacterSheetUnavailable("Private reference unavailable")
        try:
            chapters = json.loads(story[0])["pages"]
            if not isinstance(chapters, list) or any(
                type(p["number"]) is not int or p["number"] != i
                for i, p in enumerate(chapters, 1)
            ):
                raise ValueError("Invalid page numbers")
            plan = plan_reference_book(book_id, [p["text"] for p in chapters], style, hero_mode)
        except (ValueError, TypeError, KeyError, IndexError) as exc:
            raise CharacterSheetUnavailable("Private book unavailable") from exc
        rows = db.sql(c, "SELECT id,page_number FROM photo_illustration_requests "
            "WHERE owner_id=? AND book_id=? AND style=? AND hero_mode=? "
            "AND status='pending_review' AND expires_at>? ORDER BY page_number",
            (owner, book_id, style, hero_mode, now)).fetchall()
        requests = {page: rid for rid, page in rows}
        pages = []
        for page in plan.pages:
            rid = requests.get(page.page_number)
            status = "not_requested"
            if rid:
                status = "needs_review"
                try:
                    _snapshot(c, owner, rid)
                    key, _ = _context(c, owner, rid)
                    if key[0][5] != plan.fingerprint:
                        raise CharacterSheetUnavailable("Plan mismatch")
                    if _read_page(c, owner, rid, key) is not None:
                        status = "ready"
                    elif not db.sql(c, "SELECT 1 FROM photo_ai_attempt_reservations "
                                   "WHERE request_id=? AND owner_id=?", (rid, owner)).fetchone():
                        status = "pending_review"
                except CharacterSheetUnavailable:
                    # A missing sheet, expired context or corrupt asset must
                    # not be counted as ready or authorized for another call.
                    pass
            pages.append({"page_number": page.page_number, "status": status})
        counts = {status: sum(p["status"] == status for p in pages)
                  for status in ("not_requested", "pending_review", "needs_review", "ready")}
        return {"total_pages": len(pages), "counts": counts, "pages": pages,
                "generation_started": False}
