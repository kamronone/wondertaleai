"""Internal refund request ledger. No provider calls or public routes."""
from uuid import UUID, uuid4

def request_refund(conn, owner_id: str, order_id: UUID, amount_minor: int, request_key: str):
    """Reserve refundable balance; caller owns transaction.
    Pending requests are not evidence of a provider refund.
    """
    if type(amount_minor) is not int or amount_minor <= 0:
        raise ValueError("Invalid refund amount")
    if not isinstance(request_key,str) or not 1 <= len(request_key) <= 128:
        raise ValueError("Invalid request key")
    from billing_subscriptions import _lock_owner
    _lock_owner(conn,owner_id)
    order=conn.execute("""SELECT amount_minor,state FROM payment_orders
        WHERE id=%s AND owner_id=%s FOR UPDATE""",(order_id,owner_id)).fetchone()
    if not order:
        raise LookupError("Order not found")
    ref="request:"+request_key
    existing=conn.execute("""SELECT id,amount_minor,state FROM refunds
        WHERE order_id=%s AND provider_ref=%s""",(order_id,ref)).fetchone()
    if existing:
        if existing[1]!=amount_minor:
            raise ValueError("Conflicting refund request")
        return {"id":str(existing[0]),"state":existing[2],"created":False}
    if order[1] not in ("paid","partially_refunded"):
        raise ValueError("Order not refundable")
    reserved=conn.execute("""SELECT COALESCE(SUM(amount_minor),0) FROM refunds
        WHERE order_id=%s AND state IN ('pending','completed')""",(order_id,)).fetchone()[0]
    if reserved+amount_minor>order[0]:
        raise ValueError("Refund exceeds available balance")
    entitlement=conn.execute("""SELECT s.id FROM billing_order_entitlements e
        JOIN subscriptions s ON s.id=e.subscription_id
        WHERE e.order_id=%s AND s.owner_id=%s FOR UPDATE OF s""",(order_id,owner_id)).fetchone()
    if not entitlement:
        raise ValueError("Manual review required: missing entitlement")
    if reserved+amount_minor==order[0]:
        used=conn.execute("""SELECT 1 FROM quota_reservations
            WHERE subscription_id=%s AND state IN (\'reserved\',\'committed\') LIMIT 1""",(entitlement[0],)).fetchone()
        if used:
            raise ValueError("Manual review required: service used or reserved")
    rid=uuid4()
    conn.execute("""INSERT INTO refunds(id,order_id,amount_minor,provider_ref,state)
        VALUES (%s,%s,%s,%s,'pending')""",(rid,order_id,amount_minor,ref))
    return {"id":str(rid),"state":"pending","created":True}

def list_refunds(conn,owner_id: str,order_id: UUID):
    rows=conn.execute("""SELECT r.id,r.amount_minor,r.state FROM refunds r
        JOIN payment_orders o ON o.id=r.order_id
        WHERE o.owner_id=%s AND o.id=%s ORDER BY r.id""",(owner_id,order_id)).fetchall()
    return [{"id":str(r[0]),"amount_minor":r[1],"state":r[2]} for r in rows]


def reconcile_refund(conn, refund_id: UUID, *, succeeded: bool):
    """Trusted internal reconciliation only, after independent provider verification.
    Caller must own transaction. No provider request is sent here.
    Full refunds require an explicit order linkage.
    """
    if type(succeeded) is not bool:
        raise ValueError("Invalid outcome")
    link=conn.execute("SELECT order_id FROM refunds WHERE id=%s",(refund_id,)).fetchone()
    if not link:
        raise LookupError("Refund not found")
    oid=link[0]
    from billing_subscriptions import _lock_owner
    from billing_entitlements import revoke_refunded_entitlement
    owner=conn.execute("SELECT owner_id FROM payment_orders WHERE id=%s",(oid,)).fetchone()
    if not owner:
        raise LookupError("Order not found")
    _lock_owner(conn,owner[0])
    order=conn.execute("SELECT amount_minor,state FROM payment_orders WHERE id=%s FOR UPDATE",(oid,)).fetchone()
    refund=conn.execute("SELECT state FROM refunds WHERE id=%s AND order_id=%s FOR UPDATE",(refund_id,oid)).fetchone()
    if not order or not refund:
        raise LookupError("Refund not found")
    target="completed" if succeeded else "failed"
    if refund[0]==target:
        return {"state":target,"changed":False,"order_state":order[1]}
    if refund[0]!="pending":
        raise ValueError("Conflicting terminal refund outcome")
    if order[1] not in ("paid","partially_refunded"):
        raise ValueError("Order requires manual reconciliation")
    conn.execute("UPDATE refunds SET state=%s WHERE id=%s",(target,refund_id))
    state=order[1]
    if succeeded:
        total=conn.execute("SELECT COALESCE(SUM(amount_minor),0) FROM refunds WHERE order_id=%s AND state='completed'",(oid,)).fetchone()[0]
        if total>order[0]:
            raise RuntimeError("Refund ledger exceeds payment; rollback required")
        state="refunded" if total==order[0] else "partially_refunded"
        conn.execute("UPDATE payment_orders SET state=%s WHERE id=%s",(state,oid))
    if state=="refunded":
        revoke_refunded_entitlement(conn,oid)
    return {"state":target,"changed":True,"order_state":state,
            "entitlement_review_required":False}
