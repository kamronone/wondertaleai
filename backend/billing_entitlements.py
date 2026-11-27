"""Internal entitlement operations. Caller owns transaction."""
from billing_subscriptions import _lock_owner

def link_entitlement(conn, order_id, subscription_id):
    row=conn.execute("""SELECT o.owner_id FROM payment_orders o
        JOIN subscriptions s ON s.id=%s AND s.owner_id=o.owner_id
        AND s.plan_id=o.plan_id AND s.plan_version=o.plan_version
        WHERE o.id=%s AND o.state='paid' FOR UPDATE OF o,s""",
        (subscription_id,order_id)).fetchone()
    if not row:
        raise ValueError("Order and subscription mismatch")
    conn.execute("""INSERT INTO billing_order_entitlements(order_id,subscription_id)
        VALUES (%s,%s) ON CONFLICT(order_id) DO NOTHING""",(order_id,subscription_id))
    existing=conn.execute("SELECT subscription_id FROM billing_order_entitlements WHERE order_id=%s",(order_id,)).fetchone()
    if existing[0]!=subscription_id:
        raise ValueError("Conflicting entitlement")

def revoke_refunded_entitlement(conn, order_id):
    owner=conn.execute("SELECT owner_id FROM payment_orders WHERE id=%s",(order_id,)).fetchone()
    if not owner:
        raise LookupError("Order not found")
    _lock_owner(conn,owner[0])
    order=conn.execute("SELECT state FROM payment_orders WHERE id=%s FOR UPDATE",(order_id,)).fetchone()
    if order[0]!="refunded":
        raise ValueError("Full refund required")
    link=conn.execute("""SELECT s.id FROM billing_order_entitlements e
        JOIN subscriptions s ON s.id=e.subscription_id
        WHERE e.order_id=%s AND s.owner_id=%s FOR UPDATE OF s""",(order_id,owner[0])).fetchone()
    if not link:
        raise LookupError("Explicit entitlement link required")
    conn.execute("UPDATE subscriptions SET status='canceled' WHERE id=%s AND owner_id=%s AND status='active'",(link[0],owner[0]))
    return str(link[0])
