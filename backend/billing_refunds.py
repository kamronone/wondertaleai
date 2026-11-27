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
    rid=uuid4()
    conn.execute("""INSERT INTO refunds(id,order_id,amount_minor,provider_ref,state)
        VALUES (%s,%s,%s,%s,'pending')""",(rid,order_id,amount_minor,ref))
    return {"id":str(rid),"state":"pending","created":True}

def list_refunds(conn,owner_id: str,order_id: UUID):
    rows=conn.execute("""SELECT r.id,r.amount_minor,r.state FROM refunds r
        JOIN payment_orders o ON o.id=r.order_id
        WHERE o.owner_id=%s AND o.id=%s ORDER BY r.id""",(owner_id,order_id)).fetchall()
    return [{"id":str(r[0]),"amount_minor":r[1],"state":r[2]} for r in rows]
