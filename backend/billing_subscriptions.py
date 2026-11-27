"""Staged PostgreSQL subscription repository; no automatic migrations or payment activation.
Call inside a caller-owned transaction. Not wired into live API.
"""
from datetime import datetime
from uuid import uuid4
from billing_domain import utc, period_end

def _lock_owner(conn, owner_id: str):
    row = conn.execute("SELECT id FROM parents WHERE id=%s FOR UPDATE", (owner_id,)).fetchone()
    if not row:
        raise LookupError("Parent not found")

def subscription_status(conn, owner_id: str, now: datetime) -> dict:
    now = utc(now)
    row = conn.execute(
        """SELECT id,plan_id,plan_version,period_start,period_end,cancel_at_period_end
           FROM subscriptions WHERE owner_id=%s AND status='active'
           AND period_start<=%s AND period_end>%s""", (owner_id,now,now)).fetchone()
    if not row:
        return {"plan":"free","subscription_status":"inactive","payments_enabled":False}
    return {"id":str(row[0]),"plan":row[1],"plan_version":row[2],
            "period_start":row[3],"period_end":row[4],
            "cancel_at_period_end":row[5],"subscription_status":"active",
            "payments_enabled":False}

def cancel_subscription(conn, owner_id: str, now: datetime) -> bool:
    now = utc(now)
    _lock_owner(conn, owner_id)
    result = conn.execute(
        """UPDATE subscriptions SET cancel_at_period_end=TRUE
           WHERE owner_id=%s AND status='active' AND period_end>%s
           AND period_start<=%s""", (owner_id,now,now))
    return result.rowcount == 1

def expire_subscription(conn, owner_id: str, now: datetime) -> int:
    now = utc(now)
    _lock_owner(conn, owner_id)
    return conn.execute(
        """UPDATE subscriptions SET status='expired'
           WHERE owner_id=%s AND status='active' AND period_end<=%s""",
        (owner_id,now)).rowcount

def preview_period(conn, owner_id: str, plan_id: str, now: datetime) -> dict:
    """Read-only renewal estimate, never grants access or charges money."""
    from billing_domain import get_plan
    plan = get_plan(plan_id)
    if not plan.price_minor:
        raise ValueError("Paid plan required")
    now = utc(now)
    current = subscription_status(conn, owner_id, now)
    if current["subscription_status"] == "active":
        if current["plan"] != plan_id:
            raise ValueError("Plan changes require a separate proration policy")
        start = current["period_end"]
    else:
        start = now
    return {"plan":plan.id,"price_minor":plan.price_minor,"currency":plan.currency,
            "period_start":start,"period_end":period_end(start),"payments_enabled":False}

# Activation is intentionally absent until verified payment events and
# an atomic order-to-entitlement ledger are implemented.
