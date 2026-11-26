"""Fail-closed budget reservation ledger for FUTURE personalized photo edits.

Operator-invoked only. No API endpoint invokes this module. It never loads
child photos, imports an image provider, performs an edit, or records a real
charge. A reservation counts a conservative possible future attempt, not
money spent. There are intentionally no automatic refunds or retries.
"""
import os
import time
import uuid
from datetime import datetime, timezone

import secure_main as db


class PhotoBudgetDenied(RuntimeError):
    """No account details, books or photo data should appear in this error."""


def _positive_limit(name: str, ceiling: int) -> int:
    raw = os.getenv(name, "")
    if not raw.isascii() or not raw.isdecimal():
        raise PhotoBudgetDenied("Photo budget is not configured")
    amount = int(raw)
    if not 0 < amount <= ceiling:
        raise PhotoBudgetDenied("Photo budget exceeds allowed configuration")
    return amount


def _gate(c) -> None:
    if not db.photo_reference_upload_enabled():
        raise PhotoBudgetDenied("Photo budget planning is local-development only")
    if os.getenv("ENABLE_PHOTO_BUDGET_RESERVATIONS", "false").lower() != "true":
        raise PhotoBudgetDenied("Photo budget reservation is disabled")
    if os.getenv("ILLUSTRATION_EMERGENCY_STOP", "false").lower() == "true":
        raise PhotoBudgetDenied("Illustration emergency stop is active")
    try:
        row = db.sql(c, "SELECT paused FROM illustration_runtime_control WHERE singleton=1").fetchone()
        if row is None or row[0] != 0:
            raise PhotoBudgetDenied("Illustration emergency stop is active")
    except PhotoBudgetDenied:
        raise
    except Exception as exc:
        raise PhotoBudgetDenied("Illustration runtime state unavailable") from exc


def reserve_photo_attempt_budget(request_id: str) -> dict:
    """Atomically reserve at most one conservative attempt per request.

    All amounts are whole micro-USD and supplied by trusted operator config,
    never user input. The global aggregate is never reset by consent, request
    cancellation or account deletion. A reservation is not permission to call
    any model and must not be interpreted as a payment or provider charge.
    """
    try:
        request_id = str(uuid.UUID(request_id))
    except (TypeError, ValueError, AttributeError):
        raise PhotoBudgetDenied("Invalid photo request ID")
    estimate = _positive_limit("PHOTO_EDIT_ESTIMATE_MICRO_USD", 2_000_000)
    global_limit = _positive_limit("PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD", 20_000_000)
    parent_limit = _positive_limit("PHOTO_EDIT_DAILY_PARENT_MICRO_USD", 5_000_000)
    if estimate > min(global_limit, parent_limit):
        raise PhotoBudgetDenied("Estimate exceeds configured budget")
    now = int(time.time())
    day = datetime.now(timezone.utc).date().isoformat()

    with db.connection() as c:
        if not db.IS_PG:
            c.execute("BEGIN IMMEDIATE")
        _gate(c)
        row = db.sql(c,
            "SELECT owner_id,book_id,reference_sha256,expires_at,status "
            "FROM photo_illustration_requests WHERE id=?", (request_id,)).fetchone()
        if not row:
            raise PhotoBudgetDenied("Photo request unavailable")
        owner, book, digest, expires, status = row
        # The parent lock serializes consent changes, photo replacement and
        # reservations for the same account in PostgreSQL.
        parent_sql = "SELECT id FROM parents WHERE id=?"
        if db.IS_PG:
            parent_sql += " FOR UPDATE"
        if not db.sql(c, parent_sql, (owner,)).fetchone():
            raise PhotoBudgetDenied("Parent unavailable")
        _gate(c)
        if status != "pending_review" or expires <= now:
            raise PhotoBudgetDenied("Photo request is no longer valid")
        if not db.photo_consent_active(owner, c) or not db.external_photo_transfer_consent_active(owner, c):
            raise PhotoBudgetDenied("Photo permission is unavailable")
        if not db.sql(c, "SELECT id FROM books WHERE id=? AND owner_id=?", (book, owner)).fetchone():
            raise PhotoBudgetDenied("Private book unavailable")
        import hashlib
        import hmac
        photo = db.sql(c,
            "SELECT jpeg_bytes,sha256,expires_at FROM photo_reference_temp "
            "WHERE owner_id=? AND expires_at>?", (owner, now)).fetchone()
        if (not photo or photo[2] < expires or photo[1] != digest
                or not hmac.compare_digest(hashlib.sha256(bytes(photo[0])).hexdigest(), digest)):
            raise PhotoBudgetDenied("Valid current photo reference required")
        existing = db.sql(c,
            "SELECT reserved_micro_usd,state,day FROM photo_ai_attempt_reservations "
            "WHERE request_id=? AND owner_id=?", (request_id, owner)).fetchone()
        if existing:
            c.commit()
            return {"request_id": request_id, "state": existing[1], "day": existing[2],
                    "reserved_micro_usd": existing[0], "provider_called": False,
                    "charged_usd": 0}

        # Conditional upserts are concurrency-safe on PostgreSQL and SQLite.
        # If the second limit fails, the connection context rolls the first
        # upsert back along with the entire transaction.
        global_row = db.sql(c, (
            "INSERT INTO photo_ai_daily_budget(day,reserved_micro_usd) VALUES(?,?) "
            "ON CONFLICT(day) DO UPDATE SET "
            "reserved_micro_usd=photo_ai_daily_budget.reserved_micro_usd+excluded.reserved_micro_usd "
            "WHERE photo_ai_daily_budget.reserved_micro_usd<=? "
            "RETURNING reserved_micro_usd"
        ), (day, estimate, global_limit-estimate)).fetchone()
        if not global_row:
            raise PhotoBudgetDenied("Global photo budget exhausted")
        parent_row = db.sql(c, (
            "INSERT INTO photo_ai_parent_budget(owner_id,day,reserved_micro_usd) VALUES(?,?,?) "
            "ON CONFLICT(owner_id,day) DO UPDATE SET "
            "reserved_micro_usd=photo_ai_parent_budget.reserved_micro_usd+excluded.reserved_micro_usd "
            "WHERE photo_ai_parent_budget.reserved_micro_usd<=? "
            "RETURNING reserved_micro_usd"
        ), (owner, day, estimate, parent_limit-estimate)).fetchone()
        if not parent_row:
            raise PhotoBudgetDenied("Parent photo budget exhausted")
        db.sql(c,
            "INSERT INTO photo_ai_attempt_reservations"
            "(request_id,owner_id,day,reserved_micro_usd,state,created_at) "
            "VALUES(?,?,?,?,'reserved',?)",
            (request_id,owner,day,estimate,now))
        c.commit()
    return {"request_id": request_id, "state": "reserved", "day": day,
            "reserved_micro_usd": estimate, "provider_called": False,
            "charged_usd": 0}
