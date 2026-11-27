"""Explicit one-shot local character-sheet worker for review requests.

Never started by FastAPI, never constructs a provider client, never retries.
Real use requires a trusted operator, independent moderation, documented
permission for both source and derived media, and configured daily limits.
"""
import os
import time
from datetime import datetime, timezone
from typing import Callable, Any

import secure_main as db
from photo_illustration_budget import _gate as budget_gate, _positive_limit, PhotoBudgetDenied
from private_character_sheet_store import (
    _transaction, _snapshot, _id, load_character_sheet, store_character_sheet,
)
from private_character_sheet_edits import create_character_sheet


def _worker_gate():
    if (os.getenv("APP_ENV", "").lower() != "development"
            or os.getenv("ENABLE_CHARACTER_SHEET_WORKER", "false").lower() != "true"):
        raise RuntimeError("Character sheet worker disabled")


def _reserve(owner, rid, expected):
    """Commit quota and a unique irreversible attempt before a provider call."""
    _worker_gate()
    amount = _positive_limit("PHOTO_EDIT_ESTIMATE_MICRO_USD", 2_000_000)
    global_cap = _positive_limit("PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD", 20_000_000)
    parent_cap = _positive_limit("PHOTO_EDIT_DAILY_PARENT_MICRO_USD", 5_000_000)
    if amount > min(global_cap, parent_cap):
        raise PhotoBudgetDenied("Estimate exceeds configured budget")
    day = datetime.now(timezone.utc).date().isoformat()
    with _transaction(owner) as c:
        budget_gate(c)
        current = _snapshot(c, owner, rid)
        if current != expected:
            raise PhotoBudgetDenied("Private request changed")
        book, style, hero, digest, expires, fingerprint = current
        existing = db.sql(c, "SELECT source_request_id FROM photo_sheet_attempts "
            "WHERE owner_id=? AND book_id=? AND style=? AND hero_mode=?",
            (owner, book, style, hero)).fetchone()
        if existing:
            return False
        for table, keys, values, cap in (
            ("photo_ai_daily_budget", "day", (day, amount), global_cap),
            ("photo_ai_parent_budget", "owner_id,day", (owner, day, amount), parent_cap),
        ):
            placeholders = ",".join("?" for _ in values)
            row = db.sql(c, f"INSERT INTO {table}({keys},reserved_micro_usd) VALUES({placeholders}) "
                f"ON CONFLICT({keys}) DO UPDATE SET reserved_micro_usd={table}.reserved_micro_usd+excluded.reserved_micro_usd "
                f"WHERE {table}.reserved_micro_usd<=? RETURNING reserved_micro_usd",
                (*values, cap-amount)).fetchone()
            if not row:
                raise PhotoBudgetDenied("Character sheet budget exhausted")
        db.sql(c, "INSERT INTO photo_sheet_attempts(source_request_id,owner_id,book_id,style,hero_mode,"
            "reference_sha256,plan_fingerprint,day,reserved_micro_usd,state,created_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,'needs_review',?)",
            (rid, owner, book, style, hero, digest, fingerprint, day, amount, int(time.time())))
    return True


def process_character_sheet_request(
    owner: str, request_id: str, *, client: Any,
    transfer_permission: Callable[[], bool],
    source_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
    image_moderator: Callable[[bytes], bool],
) -> dict:
    """Consume an explicitly chosen review request, not an automatic scheduler.

    The client must be configured with retries disabled. A durable attempt
    remains needs_review on any failure; no automatic refund or retry.
    """
    _worker_gate()
    rid = _id(request_id)
    if client is None or not all(callable(fn) for fn in (
        transfer_permission, source_moderator, prompt_moderator, image_moderator
    )):
        raise ValueError("Explicit client and independent checks required")
    if transfer_permission() is not True:
        raise PermissionError("Current transfer approval required")
    with _transaction(owner) as c:
        budget_gate(c)
        expected = _snapshot(c, owner, rid)
        photo = db.sql(c, "SELECT jpeg_bytes FROM photo_reference_temp WHERE owner_id=?",
                       (owner,)).fetchone()
        if not photo:
            raise PermissionError("Private reference unavailable")
        raw = bytes(photo[0])
    if load_character_sheet(owner, rid) is not None:
        return {"state": "ready", "provider_invoked": False}

    def permission():
        try:
            _worker_gate()
            if transfer_permission() is not True:
                return False
            with _transaction(owner) as c:
                budget_gate(c)
                return _snapshot(c, owner, rid) == expected
        except Exception:
            return False

    if not permission():
        raise PermissionError("Current transfer approval required")
    sheet = create_character_sheet(raw, style=expected[1], hero_mode=expected[2],
        client=client, permission=permission, reserve_attempt=lambda: _reserve(owner, rid, expected),
        source_moderator=source_moderator, prompt_moderator=prompt_moderator,
        image_moderator=image_moderator)
    if not permission():
        raise PermissionError("Private reference permission expired")
    store_character_sheet(owner, rid, sheet, image_moderator=image_moderator,
                          expected_snapshot=expected)
    with _transaction(owner) as c:
        if _snapshot(c, owner, rid) != expected:
            raise PermissionError("Private request changed")
        db.sql(c, "UPDATE photo_sheet_attempts SET state='ready' WHERE source_request_id=? "
            "AND owner_id=? AND state='needs_review'", (rid, owner))
    return {"state": "ready", "provider_invoked": True}
