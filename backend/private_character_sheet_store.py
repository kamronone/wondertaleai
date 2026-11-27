"""Local-only private character-sheet repository.

This is an operator-side storage adapter, not an API, renderer, queue runner
or authorization to transfer personal images. No provider is contacted.
Derived media expires no later than its temporary portrait and source request.
"""
from contextlib import contextmanager
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Callable

import secure_main as db
from illustration_worker import illustration_emergency_paused
from private_character_continuity import plan_reference_book
from private_character_sheet_edits import ApprovedCharacterSheet
from private_illustration_media import normalize_private_illustration


class CharacterSheetUnavailable(RuntimeError):
    pass


def _gate(c):
    if (not db.photo_reference_upload_enabled()
            or os.getenv("ENABLE_CHARACTER_SHEET_STORAGE", "false").lower() != "true"
            or illustration_emergency_paused(c)):
        raise CharacterSheetUnavailable("Private character sheet storage unavailable")


def _id(value):
    try:
        return str(uuid.UUID(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise CharacterSheetUnavailable("Invalid request") from exc


@contextmanager
def _transaction(owner):
    with db.connection() as c:
        if db.IS_PG:
            row = db.sql(c, "SELECT id FROM parents WHERE id=? FOR UPDATE", (owner,)).fetchone()
            if not row:
                raise CharacterSheetUnavailable("Private request unavailable")
        else:
            c.execute("BEGIN IMMEDIATE")
        _gate(c)
        yield c
        c.commit()


def _snapshot(c, owner, request_id):
    now = int(time.time())
    row = db.sql(c, "SELECT book_id,page_number,style,hero_mode,reference_sha256,expires_at "
        "FROM photo_illustration_requests WHERE id=? AND owner_id=? "
        "AND status='pending_review' AND expires_at>?", (request_id, owner, now)).fetchone()
    if not row or not db.photo_consent_active(owner, c) or not db.external_photo_transfer_consent_active(owner, c):
        raise CharacterSheetUnavailable("Private request unavailable")
    book, page, style, hero, digest, expires = row
    photo = db.sql(c, "SELECT sha256,jpeg_bytes,expires_at FROM photo_reference_temp "
        "WHERE owner_id=? AND expires_at>?", (owner, now)).fetchone()
    story = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?", (book, owner)).fetchone()
    if (not photo or not story or photo[0] != digest or photo[2] < expires
            or not hmac.compare_digest(hashlib.sha256(bytes(photo[1])).hexdigest(), digest)):
        raise CharacterSheetUnavailable("Private reference unavailable")
    try:
        pages = json.loads(story[0])["pages"]
        if (type(page) is not int or not 1 <= page <= len(pages)
                or any(p["number"] != n for n, p in enumerate(pages, 1))):
            raise ValueError
        plan = plan_reference_book(book, [p["text"] for p in pages], style, hero)
    except (TypeError, ValueError, KeyError, IndexError) as exc:
        raise CharacterSheetUnavailable("Invalid private story") from exc
    return book, style, hero, digest, expires, plan.fingerprint


def store_character_sheet(owner: str, source_request_id: str, sheet: ApprovedCharacterSheet,
                          *, image_moderator: Callable[[bytes], bool]) -> None:
    """Save one reviewed PNG, never overwrite a different approved reference.

    The caller is trusted and must have independently validated provenance.
    A sheet object/digest alone is not proof of moderation or consent.
    """
    request_id = _id(source_request_id)
    if not isinstance(sheet, ApprovedCharacterSheet) or not isinstance(sheet.png, bytes):
        raise ValueError("Invalid character sheet")
    if not hmac.compare_digest(hashlib.sha256(sheet.png).hexdigest(), sheet.sha256):
        raise ValueError("Character sheet integrity mismatch")
    with _transaction(owner) as c:
        before = _snapshot(c, owner, request_id)
    if (sheet.style, sheet.hero_mode) != before[1:3]:
        raise CharacterSheetUnavailable("Character sheet style mismatch")
    png = normalize_private_illustration(sheet.png)
    if not callable(image_moderator) or image_moderator(png) is not True:
        raise PermissionError("Character sheet moderation did not approve")
    sha = hashlib.sha256(png).hexdigest()
    with _transaction(owner) as c:
        current = _snapshot(c, owner, request_id)
        if current != before:
            raise CharacterSheetUnavailable("Private request changed")
        book, style, hero, digest, expires, plan_hash = current
        db.sql(c, "DELETE FROM photo_character_sheets WHERE owner_id=? AND expires_at<=?",
               (owner, int(time.time())))
        existing = db.sql(c, "SELECT reference_sha256,plan_fingerprint,sha256,expires_at "
            "FROM photo_character_sheets WHERE owner_id=? AND book_id=? AND style=? AND hero_mode=?",
            (owner, book, style, hero)).fetchone()
        if existing:
            if tuple(existing)[:3] == (digest, plan_hash, sha) and existing[3] > int(time.time()):
                return
            raise CharacterSheetUnavailable("A different character sheet already exists")
        db.sql(c, "INSERT INTO photo_character_sheets(source_request_id,owner_id,book_id,style,hero_mode,"
            "reference_sha256,plan_fingerprint,png_bytes,sha256,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
            (request_id, owner, book, style, hero, digest, plan_hash, png, sha, expires))


def load_character_sheet(owner: str, page_request_id: str) -> ApprovedCharacterSheet | None:
    """Resolve only the same owner's active reference for an active page request."""
    request_id = _id(page_request_id)
    with _transaction(owner) as c:
        book, style, hero, digest, expires, plan_hash = _snapshot(c, owner, request_id)
        row = db.sql(c, "SELECT s.png_bytes,s.sha256,s.source_request_id,s.expires_at "
            "FROM photo_character_sheets s JOIN photo_illustration_requests r ON r.id=s.source_request_id "
            "WHERE s.owner_id=? AND s.book_id=? AND s.style=? AND s.hero_mode=? "
            "AND s.reference_sha256=? AND s.plan_fingerprint=? AND s.expires_at>? "
            "AND r.owner_id=s.owner_id AND r.book_id=s.book_id AND r.style=s.style "
            "AND r.hero_mode=s.hero_mode AND r.reference_sha256=s.reference_sha256 "
            "AND r.status='pending_review' AND r.expires_at>=s.expires_at",
            (owner, book, style, hero, digest, plan_hash, int(time.time()))).fetchone()
        if not row:
            return None
        png = bytes(row[0])
        if not hmac.compare_digest(hashlib.sha256(png).hexdigest(), row[1]):
            raise CharacterSheetUnavailable("Stored character sheet integrity mismatch")
        return ApprovedCharacterSheet(png, row[1], style, hero)
