"""Internal gift repository for isolated billing tests.
Caller owns transaction. Pending codes cannot be redeemed.
Payment activation is deliberately not implemented here.
"""
import hashlib
import secrets
import re
from datetime import timedelta
from uuid import uuid4
from billing_domain import get_plan, utc, period_end
from billing_subscriptions import _lock_owner, expire_subscription

def digest_code(code):
    if not isinstance(code,str) or not re.fullmatch(r"[A-Za-z0-9_-]{43}",code):
        raise ValueError("Invalid gift code")
    return hashlib.sha256(code.encode("ascii")).hexdigest()

def create_pending_gift(conn,purchaser_id,plan_id,now):
    now=utc(now)
    plan=get_plan(plan_id)
    if plan_id not in ("plus","family"):
        raise ValueError("Invalid gift plan")
    _lock_owner(conn,purchaser_id)
    code=secrets.token_urlsafe(32)
    gift_id=uuid4()
    conn.execute("""INSERT INTO billing_gift_codes
        (id,purchaser_id,plan_id,plan_version,code_digest,state,created_at,expires_at)
        VALUES (%s,%s,%s,%s,%s,'pending',%s,%s)""",
        (gift_id,purchaser_id,plan.id,plan.version,digest_code(code),now,now+timedelta(days=90)))
    return {"gift_id":str(gift_id),"code":code,"state":"pending"}

def redeem_gift(conn,owner_id,code,now):
    now=utc(now)
    digest=digest_code(code)
    _lock_owner(conn,owner_id)
    row=conn.execute("""SELECT id,plan_id,plan_version,state,expires_at,redeemed_by,subscription_id
        FROM billing_gift_codes WHERE code_digest=%s FOR UPDATE""",(digest,)).fetchone()
    if not row:
        raise ValueError("Gift unavailable")
    if row[3]=="redeemed" and row[5]==owner_id:
        return {"subscription_id":str(row[6]),"created":False}
    if row[3]!="available" or now>=row[4]:
        raise ValueError("Gift unavailable")
    expire_subscription(conn,owner_id,now)
    if conn.execute("SELECT 1 FROM subscriptions WHERE owner_id=%s AND status='active'",(owner_id,)).fetchone():
        raise ValueError("Active subscription exists")
    sid=uuid4()
    end=period_end(now)
    conn.execute("""INSERT INTO subscriptions
        (id,owner_id,plan_id,plan_version,status,period_start,period_end,cancel_at_period_end)
        VALUES (%s,%s,%s,%s,'active',%s,%s,FALSE)""",(sid,owner_id,row[1],row[2],now,end))
    conn.execute("""UPDATE billing_gift_codes SET state='redeemed',redeemed_by=%s,
        redeemed_at=%s,subscription_id=%s WHERE id=%s""",(owner_id,now,sid,row[0]))
    return {"subscription_id":str(sid),"created":True}


def create_gift_order(conn,purchaser_id,plan_id,request_key,now,provider='sandbox'):
    """Create a test gift order. Plaintext code is returned only on creation."""
    if provider not in ("sandbox","payme","click"):
        raise ValueError("Invalid test provider")
    now=utc(now)
    plan=get_plan(plan_id)
    if plan_id not in ("plus","family") or not isinstance(request_key,str) or not 1<=len(request_key)<=128:
        raise ValueError("Invalid gift order")
    _lock_owner(conn,purchaser_id)
    existing=conn.execute("""SELECT o.id,o.plan_id,o.provider,g.gift_id
        FROM payment_orders o LEFT JOIN billing_gift_orders g ON g.order_id=o.id
        WHERE o.owner_id=%s AND o.idempotency_key=%s""",(purchaser_id,request_key)).fetchone()
    if existing:
        if existing[1]!=plan_id or existing[2]!=provider or existing[3] is None:
            raise ValueError("Idempotency conflict")
        return {"order_id":str(existing[0]),"gift_id":str(existing[3]),"code":None,"created":False}
    gift=create_pending_gift(conn,purchaser_id,plan_id,now)
    oid=uuid4()
    conn.execute("""INSERT INTO payment_orders
        (id,owner_id,plan_id,plan_version,amount_minor,currency,provider,state,idempotency_key)
        VALUES (%s,%s,%s,%s,%s,%s,%s,'pending',%s)""",
        (oid,purchaser_id,plan.id,plan.version,plan.price_minor,plan.currency,provider,request_key))
    conn.execute("INSERT INTO billing_gift_orders(order_id,gift_id) VALUES (%s,%s)",(oid,gift["gift_id"]))
    return {"order_id":str(oid),"gift_id":gift["gift_id"],"code":gift["code"],"created":True}


def activate_paid_gift(conn,order_id,owner_id,plan_id,plan_version,now):
    """Called under owner/order locks in the same payment transaction."""
    row=conn.execute("""SELECT g.id,g.state,g.expires_at,g.purchaser_id,g.plan_id,g.plan_version
        FROM billing_gift_orders go JOIN billing_gift_codes g ON g.id=go.gift_id
        WHERE go.order_id=%s FOR UPDATE OF g""",(order_id,)).fetchone()
    if not row:
        return False
    if row[1]!="pending" or utc(now)>=row[2] or tuple(row[3:])!=(owner_id,plan_id,plan_version):
        raise ValueError("Invalid gift order")
    conn.execute("UPDATE billing_gift_codes SET state='available' WHERE id=%s",(row[0],))
    return True


def rotate_gift_code(conn,purchaser_id,gift_id,now):
    """Replace a lost code for a paid, unredeemed gift; caller owns transaction."""
    now=utc(now)
    _lock_owner(conn,purchaser_id)
    row=conn.execute("""SELECT o.id FROM payment_orders o
        JOIN billing_gift_orders go ON go.order_id=o.id
        WHERE go.gift_id=%s AND o.owner_id=%s AND o.state='paid'
        FOR UPDATE OF o""",(gift_id,purchaser_id)).fetchone()
    if not row:
        raise ValueError("Gift unavailable")
    gift=conn.execute("""SELECT state,expires_at FROM billing_gift_codes
        WHERE id=%s AND purchaser_id=%s FOR UPDATE""",(gift_id,purchaser_id)).fetchone()
    if not gift or gift[0]!="available" or now>=gift[1]:
        raise ValueError("Gift unavailable")
    code=secrets.token_urlsafe(32)
    conn.execute("UPDATE billing_gift_codes SET code_digest=%s WHERE id=%s",
        (digest_code(code),gift_id))
    return {"gift_id":str(gift_id),"code":code,"expires_at":gift[1]}


def reconcile_gift_refund(conn,purchaser_id,order_id,amount_minor,now):
    """Internal sandbox reconciliation after independently verified full refund.
    Never initiates a provider refund. Caller owns transaction.
    """
    now=utc(now)
    if type(amount_minor) is not int or amount_minor<=0:
        raise ValueError("Invalid refund amount")
    _lock_owner(conn,purchaser_id)
    order=conn.execute("""SELECT o.state,o.amount_minor,g.gift_id
        FROM payment_orders o JOIN billing_gift_orders g ON g.order_id=o.id
        WHERE o.id=%s AND o.owner_id=%s AND o.provider='sandbox'
        FOR UPDATE OF o""",(order_id,purchaser_id)).fetchone()
    if not order or order[1]!=amount_minor:
        raise ValueError("Gift order or amount mismatch")
    gift=conn.execute("""SELECT state FROM billing_gift_codes
        WHERE id=%s AND purchaser_id=%s FOR UPDATE""",(order[2],purchaser_id)).fetchone()
    if not gift:
        raise ValueError("Gift unavailable")
    if order[0]=="refunded" and gift[0]=="revoked":
        return False
    if order[0]!="paid" or gift[0] not in ("available","expired"):
        raise ValueError("Gift cannot be refunded automatically")
    if conn.execute("SELECT 1 FROM refunds WHERE order_id=%s AND state IN ('pending','completed')",(order_id,)).fetchone():
        raise ValueError("Existing refund requires reconciliation")
    conn.execute("""INSERT INTO refunds(id,order_id,amount_minor,provider_ref,state)
        VALUES (%s,%s,%s,%s,'completed')""",(uuid4(),order_id,amount_minor,"sandbox-gift:"+str(order_id)))
    conn.execute("UPDATE billing_gift_codes SET state='revoked' WHERE id=%s",(order[2],))
    conn.execute("UPDATE payment_orders SET state='refunded' WHERE id=%s",(order_id,))
    return True
