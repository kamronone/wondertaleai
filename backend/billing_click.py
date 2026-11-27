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
    if not secret or not service_id or action not in (0,1):
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
