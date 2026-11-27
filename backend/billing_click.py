"""Internal Click protocol helpers; no routes or payment mutations."""
import hashlib
import hmac
import re
from decimal import Decimal

def amount_minor(value: str) -> int:
    if not isinstance(value,str) or not re.fullmatch(r"[0-9]{1,12}(?:\.[0-9]{1,2})?",value):
        raise ValueError("Invalid amount")
    result = int(Decimal(value)*100)
    if result <= 0:
        raise ValueError("Invalid amount")
    return result

def verify_callback(params: dict, service_id: str, secret: str, action: int) -> bool:
    """Preserve original form strings for provider-defined MD5 signature."""
    if not isinstance(params,dict) or not isinstance(secret,str) or not isinstance(service_id,str) or not secret or not service_id or type(action) is not int or action not in (0,1):
        return False
    keys = ["click_trans_id","service_id","merchant_trans_id","amount","action","sign_time","sign_string"]
    if action == 1:
        keys.append("merchant_prepare_id")
    if any(not isinstance(params.get(k),str) or not params[k] or len(params[k])>256 for k in keys):
        return False
    if params["service_id"] != service_id or params["action"] != str(action):
        return False
    if not re.fullmatch(r"[0-9a-fA-F]{32}",params["sign_string"]):
        return False
    try:
        amount_minor(params["amount"])
    except ValueError:
        return False
    parts = [params["click_trans_id"],service_id,secret,params["merchant_trans_id"]]
    if action == 1:
        parts.append(params["merchant_prepare_id"])
    parts.extend([params["amount"],params["action"],params["sign_time"]])
    expected = hashlib.md5("".join(parts).encode("utf-8")).hexdigest()
    return hmac.compare_digest(expected,params["sign_string"].lower())


def prepare(conn, params, service_id, secret):
    """Internal sandbox handler; caller owns transaction."""
    from uuid import UUID
    def reply(error, note, prepare_id=None):
        return {"click_trans_id":params.get("click_trans_id"),
                "merchant_trans_id":params.get("merchant_trans_id"),
                "merchant_prepare_id":prepare_id,"error":error,"error_note":note}
    if not verify_callback(params,service_id,secret,0):
        return reply(-1,"Invalid signature")
    try:
        oid=UUID(params["merchant_trans_id"])
        amount=amount_minor(params["amount"])
    except ValueError:
        return reply(-5,"Invalid order")
    row=conn.execute("SELECT amount_minor,state FROM payment_orders WHERE id=%s AND provider='click' FOR UPDATE",(oid,)).fetchone()
    if not row:
        return reply(-5,"Order not found")
    if row[0]!=amount:
        return reply(-2,"Invalid amount")
    if row[1]=="paid":
        return reply(-4,"Already paid")
    if row[1]!="pending":
        return reply(-9,"Order unavailable")
    existing=conn.execute("SELECT prepare_id,click_trans_id,state FROM click_transactions WHERE order_id=%s",(oid,)).fetchone()
    if existing:
        if existing[1]==params["click_trans_id"] and existing[2]=="prepared":
            return reply(0,"Success",existing[0])
        return reply(-9,"Conflicting transaction")
    inserted=conn.execute("""INSERT INTO click_transactions(click_trans_id,order_id,amount_minor)
        VALUES (%s,%s,%s) ON CONFLICT DO NOTHING RETURNING prepare_id""",
        (params["click_trans_id"],oid,amount)).fetchone()
    if not inserted:
        return reply(-9,"Conflicting transaction")
    return reply(0,"Success",inserted[0])


def complete(conn, params, service_id, secret, now):
    """Internal handler. Caller must roll back on exceptions."""
    from uuid import UUID, uuid4
    from billing_domain import utc, period_end
    from billing_subscriptions import _lock_owner, expire_subscription
    def reply(error,note,confirm=None):
        return {"click_trans_id":params.get("click_trans_id"),
                "merchant_trans_id":params.get("merchant_trans_id"),
                "merchant_confirm_id":confirm,"error":error,"error_note":note}
    if not verify_callback(params,service_id,secret,1):
        return reply(-1,"Invalid signature")
    try:
        oid=UUID(params["merchant_trans_id"])
        amount=amount_minor(params["amount"])
        prepare_id=int(params["merchant_prepare_id"])
        provider_error=int(params["error"])
        if not 0<prepare_id<2**63 or provider_error>0:
            raise ValueError()
    except (ValueError,KeyError,TypeError):
        return reply(-8,"Invalid transaction")
    owner=conn.execute("SELECT owner_id FROM payment_orders WHERE id=%s AND provider='click'",(oid,)).fetchone()
    if not owner:
        return reply(-5,"Order not found")
    _lock_owner(conn,owner[0])
    row=conn.execute("""SELECT o.plan_id,o.plan_version,o.amount_minor,o.state,
        t.amount_minor,t.state FROM payment_orders o JOIN click_transactions t ON t.order_id=o.id
        WHERE o.id=%s AND o.provider='click' AND t.prepare_id=%s AND t.click_trans_id=%s
        FOR UPDATE OF o,t""",(oid,prepare_id,params["click_trans_id"])).fetchone()
    if not row:
        return reply(-6,"Transaction not found")
    if amount!=row[2] or amount!=row[4]:
        return reply(-2,"Invalid amount")
    if row[5]=="completed" and row[3]=="paid":
        return reply(-4,"Already paid",prepare_id)
    if row[5]!="prepared" or row[3]!="pending":
        return reply(-9,"Transaction canceled")
    now=utc(now)
    if provider_error<0:
        conn.execute("UPDATE click_transactions SET state='canceled',completed_at=%s WHERE prepare_id=%s",(now,prepare_id))
        conn.execute("UPDATE payment_orders SET state='failed' WHERE id=%s",(oid,))
        from billing_promotions import settle_promotion
        settle_promotion(conn,oid)
        conn.execute("""UPDATE billing_gift_codes SET state='revoked' WHERE state='pending'
            AND id IN (SELECT gift_id FROM billing_gift_orders WHERE order_id=%s)""",(oid,))
        return reply(-9,"Transaction canceled")
    from billing_gifts import activate_paid_gift
    if activate_paid_gift(conn,oid,owner[0],row[0],row[1],now):
        conn.execute("UPDATE payment_orders SET state='paid',provider_transaction_id=%s WHERE id=%s",(params["click_trans_id"],oid))
        conn.execute("UPDATE click_transactions SET state='completed',completed_at=%s WHERE prepare_id=%s",(now,prepare_id))
        return reply(0,"Success",prepare_id)
    expire_subscription(conn,owner[0],now)
    if conn.execute("SELECT id FROM subscriptions WHERE owner_id=%s AND status='active' FOR UPDATE",(owner[0],)).fetchone():
        return reply(-9,"Active subscription exists")
    sid=uuid4()
    conn.execute("""INSERT INTO subscriptions(id,owner_id,plan_id,plan_version,status,period_start,period_end)
        VALUES (%s,%s,%s,%s,'active',%s,%s)""",(sid,owner[0],row[0],row[1],now,period_end(now)))
    conn.execute("UPDATE payment_orders SET state='paid',provider_transaction_id=%s WHERE id=%s",(params["click_trans_id"],oid))
    conn.execute("UPDATE click_transactions SET state='completed',completed_at=%s,subscription_id=%s WHERE prepare_id=%s",(now,sid,prepare_id))
    from billing_entitlements import link_entitlement
    link_entitlement(conn,oid,sid)
    from billing_promotions import settle_promotion
    settle_promotion(conn,oid)
    return reply(0,"Success",prepare_id)
