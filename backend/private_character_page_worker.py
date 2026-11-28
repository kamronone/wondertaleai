"""Local-only single-page worker; explicitly invoked, never auto-started.

Uses an approved stored character sheet, not the original photograph, for
the image edit. All provider operations require fresh budget and permission.
No automatic retry or refund. No public endpoint or scheduled processing.
"""
import hashlib
import hmac
import json
import os
import time
from typing import Any, Callable

import secure_main as db
from photo_illustration_budget import _gate as budget_gate, reserve_photo_attempt_budget
from private_character_sheet_store import (
    _transaction, _snapshot, _id, CharacterSheetUnavailable,
)
from private_character_continuity import plan_reference_book
from private_character_sheet_edits import ApprovedCharacterSheet, edit_character_sheet_page
from private_illustration_media import normalize_private_illustration


def _gate():
    if (os.getenv("APP_ENV", "").lower() != "development"
            or os.getenv("ENABLE_CHARACTER_PAGE_WORKER", "false").lower() != "true"):
        raise RuntimeError("Character page worker disabled")


def _context(c, owner, rid):
    expected = _snapshot(c, owner, rid)
    book, style, hero, digest, expires, fingerprint = expected
    now = int(time.time())
    row = db.sql(c, "SELECT s.source_request_id,s.png_bytes,s.sha256,s.expires_at "
        "FROM photo_character_sheets s JOIN photo_illustration_requests r ON r.id=s.source_request_id "
        "WHERE s.owner_id=? AND s.book_id=? AND s.style=? AND s.hero_mode=? "
        "AND s.reference_sha256=? AND s.plan_fingerprint=? AND s.expires_at>? "
        "AND r.owner_id=s.owner_id AND r.book_id=s.book_id AND r.style=s.style "
        "AND r.hero_mode=s.hero_mode AND r.reference_sha256=s.reference_sha256 "
        "AND r.status='pending_review' AND r.expires_at>=s.expires_at",
        (owner, book, style, hero, digest, fingerprint, now)).fetchone()
    if not row:
        raise CharacterSheetUnavailable("Approved character sheet unavailable")
    source, png, sha, sheet_expiry = row
    png = bytes(png)
    if not hmac.compare_digest(hashlib.sha256(png).hexdigest(), sha):
        raise CharacterSheetUnavailable("Character sheet integrity mismatch")
    request = db.sql(c, "SELECT page_number FROM photo_illustration_requests WHERE id=? AND owner_id=?",
                     (rid, owner)).fetchone()
    story = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?", (book, owner)).fetchone()
    try:
        chapters = [p["text"] for p in json.loads(story[0])["pages"]]
        plan = plan_reference_book(book, chapters, style, hero)
        page = request[0]
        if plan.fingerprint != fingerprint or type(page) is not int or not 1 <= page <= len(plan.pages):
            raise ValueError
        scene = plan.pages[page-1].scene_number
    except (ValueError, TypeError, KeyError, IndexError) as exc:
        raise CharacterSheetUnavailable("Private page plan unavailable") from exc
    return (expected, source, sha, min(expires, sheet_expiry), page, scene), ApprovedCharacterSheet(png, sha, style, hero)


def _read_page(c, owner, rid, key):
    expected, source, sheet_sha, expiry, _, _ = key
    row = db.sql(c, "SELECT png_bytes,sha256 FROM photo_character_pages "
        "WHERE request_id=? AND owner_id=? AND sheet_request_id=? AND sheet_sha256=? "
        "AND plan_fingerprint=? AND expires_at>? AND expires_at<=?",
        (rid, owner, source, sheet_sha, expected[5], int(time.time()), expiry)).fetchone()
    if not row:
        return None
    png = bytes(row[0])
    if not hmac.compare_digest(hashlib.sha256(png).hexdigest(), row[1]):
        raise CharacterSheetUnavailable("Stored page integrity mismatch")
    return png


def load_character_page(owner: str, request_id: str) -> bytes | None:
    """Internal read; active ownership, consent, plan and expiry are required."""
    _gate()
    rid = _id(request_id)
    with _transaction(owner) as c:
        key, _ = _context(c, owner, rid)
        return _read_page(c, owner, rid, key)


def process_character_page_request(
    owner: str, request_id: str, *, client: Any,
    transfer_permission: Callable[[], bool],
    source_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
    image_moderator: Callable[[bytes], bool],
) -> dict:
    """Run at most one paid attempt for an explicitly selected review request.

    The trusted client must have retries disabled. The caller must independently
    confirm the provider's approved processing and retention conditions.
    """
    _gate()
    rid = _id(request_id)
    if client is None or not all(callable(fn) for fn in (
            transfer_permission, source_moderator, prompt_moderator, image_moderator)):
        raise ValueError("Explicit client and independent checks required")
    if transfer_permission() is not True:
        raise PermissionError("Current transfer approval required")
    with _transaction(owner) as c:
        budget_gate(c)
        key, sheet = _context(c, owner, rid)
        if _read_page(c, owner, rid, key) is not None:
            return {"state": "ready", "provider_invoked": False}

    def permission():
        try:
            _gate()
            if transfer_permission() is not True:
                return False
            with _transaction(owner) as c:
                budget_gate(c)
                return _context(c, owner, rid)[0] == key
        except Exception:
            return False

    def reserve():
        if not permission():
            return False
        reserve_photo_attempt_budget(rid, require_fresh=True)
        # A committed reservation is never refunded or reused.
        return True

    output = edit_character_sheet_page(sheet, scene_number=key[5], client=client,
        permission=permission, reserve_attempt=reserve, source_moderator=source_moderator,
        prompt_moderator=prompt_moderator, image_moderator=image_moderator)
    png = normalize_private_illustration(output)
    if not permission():
        raise PermissionError("Private reference permission expired")
    sha = hashlib.sha256(png).hexdigest()
    with _transaction(owner) as c:
        budget_gate(c)
        if _context(c, owner, rid)[0] != key:
            raise CharacterSheetUnavailable("Private page changed during generation")
        expected, source, sheet_sha, expiry, _, _ = key
        if expiry <= int(time.time()):
            raise CharacterSheetUnavailable("Private page expired")
        db.sql(c, "INSERT INTO photo_character_pages(request_id,sheet_request_id,owner_id,"
            "plan_fingerprint,sheet_sha256,png_bytes,sha256,expires_at) VALUES(?,?,?,?,?,?,?,?)",
            (rid, source, owner, expected[5], sheet_sha, png, sha, expiry))
    return {"state": "ready", "provider_invoked": True}
