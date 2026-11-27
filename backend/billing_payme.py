"""Partial Payme Merchant API adapter. Not routed or enabled; no payment mutation."""
import base64
import binascii
import hmac
from uuid import UUID

class PaymeError(Exception):
    def __init__(self, code, message, data=None):
        self.code, self.message, self.data = code, message, data

def authenticate(header: str, login: str, secret: str):
    try:
        scheme, token = header.split(" ",1)
        if scheme.lower() != "basic" or not login or not secret:
            raise ValueError()
        decoded = base64.b64decode(token,validate=True)
        expected = (login+":"+secret).encode("utf-8")
        if not hmac.compare_digest(decoded,expected):
            raise ValueError()
    except (ValueError, AttributeError, binascii.Error):
        raise PaymeError(-32504,"Unauthorized") from None

def check_perform(conn, params):
    account = params.get("account")
    try:
        order = UUID(str(account["order_id"]))
    except (ValueError,TypeError,KeyError):
        raise PaymeError(-31050,{"ru":"Заказ не найден","uz":"Buyurtma topilmadi","en":"Order not found"},"order_id") from None
    row = conn.execute("""SELECT amount_minor,state FROM payment_orders
        WHERE id=%s AND provider='payme'""",(order,)).fetchone()
    if not row:
        raise PaymeError(-31050,{"ru":"Заказ не найден","uz":"Buyurtma topilmadi","en":"Order not found"},"order_id")
    amount = params.get("amount")
    if type(amount) is not int or amount <= 0 or amount != row[0]:
        raise PaymeError(-31001,"Invalid amount")
    if row[1] != "pending":
        raise PaymeError(-31050,{"ru":"Заказ недоступен","uz":"Buyurtma mavjud emas","en":"Order unavailable"},"order_id")
    return {"allow":True}

def dispatch_check(conn, payload, header, login, secret):
    """Internal read-only RPC handler. All mutation methods remain unavailable."""
    rid = payload.get("id") if isinstance(payload,dict) else None
    if type(rid) is not int:
        rid = None
    try:
        authenticate(header,login,secret)
        if rid is None or not isinstance(payload.get("method"),str) or not isinstance(payload.get("params"),dict):
            raise PaymeError(-32600,"Invalid request")
        if payload["method"] != "CheckPerformTransaction":
            raise PaymeError(-32601,"Method unavailable",payload["method"])
        result = check_perform(conn,payload["params"])
        return {"id":rid,"result":result}
    except PaymeError as exc:
        return {"id":rid,"error":{"code":exc.code,"message":exc.message,"data":exc.data}}
