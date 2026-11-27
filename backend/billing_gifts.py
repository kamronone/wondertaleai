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
