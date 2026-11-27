"""Staged quota repository. PostgreSQL only; caller owns transaction.
Not connected to live AI generation. All mutations serialize on parent row.
"""
from uuid import UUID
from billing_domain import utc
from billing_subscriptions import _lock_owner

def reserve_story(conn, owner_id: str, request_id: UUID, now):
    now = utc(now)
    _lock_owner(conn, owner_id)
    previous = conn.execute(
        "SELECT state FROM quota_reservations WHERE owner_id=%s AND request_id=%s",
        (owner_id, request_id)).fetchone()
    if previous:
        return {"created": False, "state": previous[0]}
    row = conn.execute("""SELECT s.id,s.period_start,p.story_limit
        FROM subscriptions s JOIN billing_plans p
        ON p.id=s.plan_id AND p.version=s.plan_version
        WHERE s.owner_id=%s AND s.status='active'
        AND s.period_start<=%s AND s.period_end>%s FOR UPDATE OF s""",
        (owner_id,now,now)).fetchone()
    if not row:
        raise PermissionError("Active subscription required")
    subscription_id, start, limit = row
    refund_pending = conn.execute("""SELECT 1 FROM billing_order_entitlements e
        JOIN payment_orders o ON o.id=e.order_id
        JOIN refunds r ON r.order_id=o.id
        WHERE e.subscription_id=%s AND r.state IN ('pending','completed')
        GROUP BY o.id,o.amount_minor
        HAVING SUM(r.amount_minor)>=o.amount_minor
        AND COUNT(*) FILTER (WHERE r.state='pending')>0""",(subscription_id,)).fetchone()
    if refund_pending:
        raise PermissionError("Full refund pending")
    used = conn.execute("""SELECT count(*) FROM quota_reservations
        WHERE subscription_id=%s AND period_start=%s
        AND state IN ('reserved','committed')""",(subscription_id,start)).fetchone()[0]
    if used >= limit:
        raise PermissionError("Story quota exhausted")
    conn.execute("""INSERT INTO quota_reservations
        (owner_id,subscription_id,period_start,request_id,state)
        VALUES (%s,%s,%s,%s,'reserved')""",(owner_id,subscription_id,start,request_id))
    return {"created": True, "state": "reserved", "remaining": limit-used-1}

def settle_story(conn, owner_id: str, request_id: UUID, *, succeeded: bool):
    """Trusted worker only. Release only after confirmed eligible failure."""
    if type(succeeded) is not bool:
        raise ValueError("Boolean outcome required")
    _lock_owner(conn, owner_id)
    target = "committed" if succeeded else "released"
    row = conn.execute("""SELECT state FROM quota_reservations
        WHERE owner_id=%s AND request_id=%s FOR UPDATE""",
        (owner_id,request_id)).fetchone()
    if not row:
        raise LookupError("Reservation not found")
    if row[0] == target:
        return False
    if row[0] != "reserved":
        raise ValueError("Conflicting terminal outcome")
    conn.execute("""UPDATE quota_reservations SET state=%s
        WHERE owner_id=%s AND request_id=%s AND state='reserved'""",
        (target,owner_id,request_id))
    return True
