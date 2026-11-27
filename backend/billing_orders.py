"""Internal sandbox-only repository. No public routes or real provider calls.
Caller must use an isolated PostgreSQL database and a single transaction.
"""
import hashlib
import json
from uuid import uuid4
from billing_domain import get_plan, utc, period_end
from billing_subscriptions import _lock_owner, expire_subscription

def create_sandbox_order(conn, owner_id, plan_id, idempotency_key):
    plan = get_plan(plan_id)
    if not plan.price_minor or not isinstance(idempotency_key,str) or not 1 <= len(idempotency_key) <= 128:
        raise ValueError("Invalid order")
    _lock_owner(conn, owner_id)
    row = conn.execute("""SELECT id,plan_id,plan_version,amount_minor,provider
        FROM payment_orders WHERE owner_id=%s AND idempotency_key=%s""",
        (owner_id,idempotency_key)).fetchone()
    if row:
        if tuple(row[1:]) != (plan.id,plan.version,plan.price_minor,"sandbox"):
            raise ValueError("Idempotency conflict")
        return str(row[0])
    order_id = uuid4()
    conn.execute("""INSERT INTO payment_orders
        (id,owner_id,plan_id,plan_version,amount_minor,currency,provider,state,idempotency_key)
        VALUES (%s,%s,%s,%s,%s,%s,'sandbox','pending',%s)""",
        (order_id,owner_id,plan.id,plan.version,plan.price_minor,plan.currency,idempotency_key))
    return str(order_id)

def confirm_sandbox_order(conn, owner_id, order_id, event_id, transaction_id, amount_minor, now):
    """Trusted test harness only; never expose as a browser or provider callback."""
    now = utc(now)
    if type(amount_minor) is not int or amount_minor <= 0 or not all(
        isinstance(v,str) and 1 <= len(v) <= 128 for v in (event_id,transaction_id)):
        raise ValueError("Invalid sandbox event")
    _lock_owner(conn,owner_id)
    row = conn.execute("""SELECT plan_id,plan_version,amount_minor,state,provider_transaction_id
        FROM payment_orders WHERE id=%s AND owner_id=%s AND provider='sandbox' FOR UPDATE""",
        (order_id,owner_id)).fetchone()
    if not row or row[2] != amount_minor:
        raise ValueError("Order or amount mismatch")
    digest = hashlib.sha256(json.dumps([str(order_id),owner_id,transaction_id,amount_minor],
        separators=(",",":")).encode()).hexdigest()
    event = conn.execute("""INSERT INTO payment_events(provider,event_id,order_id,payload_digest)
        VALUES ('sandbox',%s,%s,%s) ON CONFLICT(provider,event_id) DO NOTHING
        RETURNING event_id""",(event_id,order_id,digest)).fetchone()
    if not event:
        previous = conn.execute("""SELECT payload_digest,processed_at FROM payment_events
            WHERE provider='sandbox' AND event_id=%s""",(event_id,)).fetchone()
        if previous[0] != digest or previous[1] is None:
            raise ValueError("Event conflict")
        return False
    if row[3] == "paid" and row[4] == transaction_id:
        conn.execute("UPDATE payment_events SET processed_at=%s WHERE provider='sandbox' AND event_id=%s",(now,event_id))
        return False
    if row[3] != "pending":
        raise ValueError("Invalid order state")
    expire_subscription(conn,owner_id,now)
    active = conn.execute("""SELECT id,plan_id,plan_version,period_end,cancel_at_period_end
        FROM subscriptions WHERE owner_id=%s AND status='active' FOR UPDATE""",
        (owner_id,)).fetchone()
    # Early renewal is deliberately rejected: extending the current period would
    # mix two monthly quotas. Renewal after expiry creates a fresh period.
    if active:
        raise ValueError("Renewal available after current period ends; no early charges")
    conn.execute("""UPDATE payment_orders SET state='paid',provider_transaction_id=%s WHERE id=%s""",
        (transaction_id,order_id))
    sid = uuid4()
    conn.execute("""INSERT INTO subscriptions
        (id,owner_id,plan_id,plan_version,status,period_start,period_end)
        VALUES (%s,%s,%s,%s,'active',%s,%s)""",
        (sid,owner_id,row[0],row[1],now,period_end(now)))
    from billing_entitlements import link_entitlement
    link_entitlement(conn,order_id,sid)
    from billing_promotions import settle_promotion
    settle_promotion(conn,order_id)
    conn.execute("UPDATE payment_events SET processed_at=%s WHERE provider='sandbox' AND event_id=%s",(now,event_id))
    return True
