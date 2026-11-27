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
