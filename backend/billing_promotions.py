"""Internal read-only promotion quotes; not a redemption or checkout API."""
import re
from billing_domain import get_plan, utc

def normalize_code(code):
    if not isinstance(code,str) or not re.fullmatch(r"[A-Za-z0-9_-]{4,32}",code.strip()):
        raise ValueError("Invalid promotion code")
    return code.strip().upper()

def discount_minor(price, kind, value):
    if type(price) is not int or type(value) is not int or price<=1 or value<=0:
        raise ValueError("Invalid discount")
    if kind=="percent" and value<=99:
        discount=price*value//100
    elif kind=="fixed":
        discount=value
    else:
        raise ValueError("Invalid discount")
    if not 0<discount<price:
        raise ValueError("Discount must leave positive payment")
    return discount

def quote_promotion(conn, owner_id, plan_id, code, now):
    code=normalize_code(code)
    plan=get_plan(plan_id)
    now=utc(now)
    row=conn.execute("""SELECT discount_kind,discount_value,plan_id,starts_at,ends_at,max_uses,enabled
        FROM billing_promotions WHERE code=%s""",(code,)).fetchone()
    if not row or not row[6] or not row[3]<=now<row[4] or row[2] not in (None,plan_id):
        raise ValueError("Promotion unavailable")
    if conn.execute("SELECT 1 FROM billing_promotion_redemptions WHERE code=%s AND owner_id=%s AND state IN ('reserved','used')",(code,owner_id)).fetchone():
        raise ValueError("Promotion already claimed")
    count=conn.execute("SELECT COUNT(*) FROM billing_promotion_redemptions WHERE code=%s AND state IN ('reserved','used')",(code,)).fetchone()[0]
    if count>=row[5]:
        raise ValueError("Promotion exhausted")
    discount=discount_minor(plan.price_minor,row[0],row[1])
    return {"code":code,"plan_id":plan_id,"original_minor":plan.price_minor,
            "discount_minor":discount,"total_minor":plan.price_minor-discount,
            "currency":plan.currency,"guaranteed":False}


def create_promotional_order(conn, owner_id, plan_id, code, request_key, now, provider='sandbox'):
    """Local sandbox only. Caller owns transaction; rollback on exceptions."""
    from uuid import uuid4
    from billing_subscriptions import _lock_owner
    if provider not in ('sandbox','payme','click'):
        raise ValueError('Invalid test provider')
    code=normalize_code(code)
    if not isinstance(request_key,str) or not 1<=len(request_key)<=128:
        raise ValueError("Invalid request key")
    _lock_owner(conn,owner_id)
    existing=conn.execute("""SELECT o.id,o.plan_id,o.provider,r.code,o.amount_minor
        FROM payment_orders o LEFT JOIN billing_promotion_redemptions r ON r.order_id=o.id
        WHERE o.owner_id=%s AND o.idempotency_key=%s""",(owner_id,request_key)).fetchone()
    if existing:
        if tuple(existing[1:4])!=(plan_id,provider,code):
            raise ValueError("Idempotency conflict")
        return {"order_id":str(existing[0]),"total_minor":existing[4],"created":False}
    if not conn.execute("SELECT code FROM billing_promotions WHERE code=%s FOR UPDATE",(code,)).fetchone():
        raise ValueError("Promotion unavailable")
    quote=quote_promotion(conn,owner_id,plan_id,code,now)
    plan=get_plan(plan_id)
    oid=uuid4()
    conn.execute("""INSERT INTO payment_orders
        (id,owner_id,plan_id,plan_version,amount_minor,currency,provider,state,idempotency_key)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',%s)""",
        (oid,owner_id,plan.id,plan.version,quote["total_minor"],plan.currency,provider,request_key))
    conn.execute("""INSERT INTO billing_promotion_redemptions
        (order_id,code,owner_id,discount_minor,state) VALUES (%s,%s,%s,%s,'reserved')""",
        (oid,code,owner_id,quote["discount_minor"]))
    return {"order_id":str(oid),"total_minor":quote["total_minor"],"created":True}


def settle_promotion(conn, order_id):
    """Caller owns transaction; settle only from persisted order state."""
    order=conn.execute("SELECT state FROM payment_orders WHERE id=%s AND provider IN ('sandbox','payme','click') FOR UPDATE",(order_id,)).fetchone()
    if not order:
        raise LookupError("Test order not found")
    row=conn.execute("SELECT state FROM billing_promotion_redemptions WHERE order_id=%s FOR UPDATE",(order_id,)).fetchone()
    if not row:
        return None
    target={"paid":"used","failed":"released","expired":"released"}.get(order[0])
    if target is None or row[0]==target:
        return row[0]
    if row[0]!="reserved":
        raise ValueError("Conflicting promotion settlement")
    conn.execute("UPDATE billing_promotion_redemptions SET state=%s WHERE order_id=%s",(target,order_id))
    return target

def cancel_promotional_order(conn, owner_id, order_id):
    from billing_subscriptions import _lock_owner
    _lock_owner(conn,owner_id)
    row=conn.execute("""SELECT o.state FROM payment_orders o
        JOIN billing_promotion_redemptions r ON r.order_id=o.id
        WHERE o.id=%s AND o.owner_id=%s AND o.provider='sandbox' FOR UPDATE OF o""",(order_id,owner_id)).fetchone()
    if not row:
        raise LookupError("Promotional order not found")
    if row[0]=="pending":
        conn.execute("UPDATE payment_orders SET state='failed' WHERE id=%s",(order_id,))
    elif row[0] not in ("failed","expired"):
        raise ValueError("Order cannot be canceled")
    return settle_promotion(conn,order_id)


def expire_promotional_order(conn, owner_id, order_id, now):
    """Expire local sandbox orders after 30 minutes; caller owns transaction."""
    from datetime import timedelta
    from billing_subscriptions import _lock_owner
    now=utc(now)
    _lock_owner(conn,owner_id)
    row=conn.execute("""SELECT o.state,o.created_at FROM payment_orders o
        JOIN billing_promotion_redemptions r ON r.order_id=o.id
        WHERE o.id=%s AND o.owner_id=%s AND o.provider='sandbox' FOR UPDATE OF o""",
        (order_id,owner_id)).fetchone()
    if not row:
        raise LookupError("Promotional order not found")
    if row[0]=="expired":
        settle_promotion(conn,order_id)
        return True
    if row[0]!="pending" or now<row[1]+timedelta(minutes=30):
        return False
    conn.execute("UPDATE payment_orders SET state='expired' WHERE id=%s",(order_id,))
    settle_promotion(conn,order_id)
    return True
