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


def create_transaction(conn, params, now_ms):
    """Internal handler; caller owns transaction and must authenticate first."""
    from uuid import UUID
    pid, stamp, amount = params.get("id"), params.get("time"), params.get("amount")
    if not isinstance(pid,str) or len(pid)!=24 or type(stamp) is not int or not 10**12<=stamp<10**13:
        raise PaymeError(-32600,"Invalid transaction parameters")
    if type(amount) is not int or amount<=0:
        raise PaymeError(-31001,"Invalid amount")
    try:
        order = UUID(str(params["account"]["order_id"]))
    except (ValueError,KeyError,TypeError):
        raise PaymeError(-31050,{"ru":"Заказ не найден","uz":"Buyurtma topilmadi","en":"Order not found"},"order_id") from None
    row = conn.execute("SELECT amount_minor,state FROM payment_orders WHERE id=%s AND provider='payme' FOR UPDATE",(order,)).fetchone()
    if not row:
        raise PaymeError(-31050,{"ru":"Заказ не найден","uz":"Buyurtma topilmadi","en":"Order not found"},"order_id")
    if row[0]!=amount:
        raise PaymeError(-31001,"Invalid amount")
    existing = conn.execute("SELECT provider_id,provider_time,create_time,state FROM payme_transactions WHERE order_id=%s FOR UPDATE",(order,)).fetchone()
    if existing:
        if existing[0]!=pid or existing[1]!=stamp or existing[3]!=1 or now_ms-stamp>=43200000:
            raise PaymeError(-31008,"Transaction unavailable")
        return {"transaction":str(order),"create_time":existing[2],"state":1}
    if row[1]!="pending" or now_ms-stamp>=43200000 or stamp>now_ms+60000:
        raise PaymeError(-31008,"Transaction unavailable")
    inserted = conn.execute("""INSERT INTO payme_transactions(provider_id,order_id,amount_minor,provider_time,create_time)
        VALUES (%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING provider_id""",
        (pid,order,amount,stamp,now_ms)).fetchone()
    if not inserted:
        raise PaymeError(-31008,"Transaction already reserved")
    return {"transaction":str(order),"create_time":now_ms,"state":1}


def perform_transaction(conn, params, now_ms):
    """Internal authenticated handler; caller must roll back on any exception."""
    from datetime import datetime, timezone
    from uuid import uuid4
    from billing_domain import period_end
    from billing_subscriptions import _lock_owner, expire_subscription
    pid = params.get("id")
    if not isinstance(pid,str) or len(pid)!=24:
        raise PaymeError(-31003,"Transaction not found")
    owner = conn.execute("""SELECT o.owner_id FROM payme_transactions t
        JOIN payment_orders o ON o.id=t.order_id
        WHERE t.provider_id=%s AND o.provider='payme'""",(pid,)).fetchone()
    if not owner:
        raise PaymeError(-31003,"Transaction not found")
    _lock_owner(conn,owner[0])
    row = conn.execute("""SELECT o.id,o.plan_id,o.plan_version,o.amount_minor,o.state,
        t.amount_minor,t.state,t.provider_time,t.perform_time
        FROM payment_orders o JOIN payme_transactions t ON t.order_id=o.id
        WHERE t.provider_id=%s AND o.owner_id=%s AND o.provider='payme'
        FOR UPDATE OF o,t""",(pid,owner[0])).fetchone()
    if not row:
        raise PaymeError(-31003,"Transaction not found")
    if row[6]==2 and row[4]=="paid":
        return {"transaction":str(row[0]),"perform_time":row[8],"state":2}
    if row[6]!=1 or row[4]!="pending" or row[3]!=row[5] or now_ms-row[7]>=43200000:
        raise PaymeError(-31008,"Transaction unavailable")
    now = datetime.fromtimestamp(now_ms/1000,timezone.utc)
    from billing_gifts import activate_paid_gift
    if activate_paid_gift(conn,row[0],owner[0],row[1],row[2],now):
        conn.execute("UPDATE payment_orders SET state='paid',provider_transaction_id=%s WHERE id=%s",(pid,row[0]))
        conn.execute("UPDATE payme_transactions SET state=2,perform_time=%s WHERE provider_id=%s",(now_ms,pid))
        return {"transaction":str(row[0]),"perform_time":now_ms,"state":2}
    expire_subscription(conn,owner[0],now)
    if conn.execute("SELECT id FROM subscriptions WHERE owner_id=%s AND status='active' FOR UPDATE",(owner[0],)).fetchone():
        raise PaymeError(-31008,"Active subscription exists")
    sid = uuid4()
    conn.execute("""INSERT INTO subscriptions
        (id,owner_id,plan_id,plan_version,status,period_start,period_end)
        VALUES (%s,%s,%s,%s,'active',%s,%s)""",
        (sid,owner[0],row[1],row[2],now,period_end(now)))
    conn.execute("UPDATE payment_orders SET state='paid',provider_transaction_id=%s WHERE id=%s",(pid,row[0]))
    conn.execute("UPDATE payme_transactions SET state=2,perform_time=%s,subscription_id=%s WHERE provider_id=%s",(now_ms,sid,pid))
    from billing_entitlements import link_entitlement
    link_entitlement(conn,row[0],sid)
    from billing_promotions import settle_promotion
    settle_promotion(conn,row[0])
    return {"transaction":str(row[0]),"perform_time":now_ms,"state":2}


def cancel_transaction(conn, params, now_ms):
    """Authenticated internal handler; caller must roll back on exceptions."""
    from billing_subscriptions import _lock_owner
    pid, reason = params.get("id"), params.get("reason")
    if not isinstance(pid,str) or len(pid)!=24:
        raise PaymeError(-31003,"Transaction not found")
    if type(reason) is not int or reason not in (1,2,3,4,5,10):
        raise PaymeError(-32600,"Invalid cancellation reason")
    owner = conn.execute("""SELECT o.owner_id FROM payme_transactions t
        JOIN payment_orders o ON o.id=t.order_id
        WHERE t.provider_id=%s AND o.provider='payme'""",(pid,)).fetchone()
    if not owner:
        raise PaymeError(-31003,"Transaction not found")
    _lock_owner(conn,owner[0])
    row = conn.execute("""SELECT o.id,o.state,t.state,t.cancel_time,t.subscription_id
        FROM payment_orders o JOIN payme_transactions t ON t.order_id=o.id
        WHERE t.provider_id=%s AND o.owner_id=%s AND o.provider='payme'
        FOR UPDATE OF o,t""",(pid,owner[0])).fetchone()
    if not row:
        raise PaymeError(-31003,"Transaction not found")
    oid, order_state, state, canceled, sid = row
    if state in (-1,-2):
        return {"transaction":str(oid),"cancel_time":canceled,"state":state}
    if state==1 and order_state=="pending":
        target=-1
        conn.execute("UPDATE payment_orders SET state='failed' WHERE id=%s",(oid,))
        from billing_promotions import settle_promotion
        settle_promotion(conn,oid)
    elif state==2 and order_state=="paid" and sid:
        used=conn.execute("""SELECT 1 FROM quota_reservations
            WHERE subscription_id=%s AND state IN ('reserved','committed') LIMIT 1""",(sid,)).fetchone()
        if used:
            raise PaymeError(-31007,"Service already used or reserved")
        conn.execute("UPDATE subscriptions SET status='canceled' WHERE id=%s AND owner_id=%s",(sid,owner[0]))
        conn.execute("UPDATE payment_orders SET state='refunded' WHERE id=%s",(oid,))
        target=-2
    else:
        raise PaymeError(-31007,"Transaction cannot be canceled")
    conn.execute("UPDATE payme_transactions SET state=%s,cancel_time=%s,reason=%s WHERE provider_id=%s",(target,now_ms,reason,pid))
    return {"transaction":str(oid),"cancel_time":now_ms,"state":target}


def check_transaction(conn, params):
    """Authenticated read-only transaction lookup."""
    pid = params.get("id")
    if not isinstance(pid,str) or len(pid)!=24:
        raise PaymeError(-31003,"Transaction not found")
    row = conn.execute("""SELECT t.order_id,t.create_time,t.perform_time,t.cancel_time,t.state,t.reason
        FROM payme_transactions t JOIN payment_orders o ON o.id=t.order_id
        WHERE t.provider_id=%s AND o.provider='payme'""",(pid,)).fetchone()
    if not row:
        raise PaymeError(-31003,"Transaction not found")
    return dict(zip(("transaction","create_time","perform_time","cancel_time","state","reason"),
                    (str(row[0]),*row[1:])))

def get_statement(conn, params):
    """Authenticated reconciliation by provider timestamp, inclusive bounds."""
    start,end = params.get("from"),params.get("to")
    if type(start) is not int or type(end) is not int or not 0<=start<=end<=253402300799999:
        raise PaymeError(-32602,"Invalid statement interval")
    rows = conn.execute("""SELECT t.provider_id,t.provider_time,t.amount_minor,t.order_id,
        t.create_time,t.perform_time,t.cancel_time,t.state,t.reason
        FROM payme_transactions t JOIN payment_orders o ON o.id=t.order_id
        WHERE o.provider='payme' AND t.provider_time BETWEEN %s AND %s
        ORDER BY t.provider_time,t.provider_id LIMIT 10001""",(start,end)).fetchall()
    if len(rows)>10000:
        raise PaymeError(-32400,"Statement too large; request a shorter interval")
    return {"transactions":[{"id":r[0],"time":r[1],"amount":r[2],
        "account":{"order_id":str(r[3])},"transaction":str(r[3]),
        "create_time":r[4],"perform_time":r[5],"cancel_time":r[6],
        "state":r[7],"reason":r[8]} for r in rows]}


def dispatch_sandbox(conn, payload, header, login, secret):
    """Internal sandbox dispatcher, never exposed by the production application.
    Requires a dedicated local test database and an authenticated request.
    """
    import time
    rid = payload.get("id") if isinstance(payload,dict) else None
    if type(rid) is not int:
        rid = None
    try:
        authenticate(header,login,secret)
        if rid is None or not isinstance(payload.get("method"),str) or not isinstance(payload.get("params"),dict):
            raise PaymeError(-32600,"Invalid request")
        method, params = payload["method"], payload["params"]
        now_ms = time.time_ns() // 1000000
        handlers = {
            "CheckPerformTransaction": lambda: check_perform(conn,params),
            "CreateTransaction": lambda: create_transaction(conn,params,now_ms),
            "PerformTransaction": lambda: perform_transaction(conn,params,now_ms),
            "CancelTransaction": lambda: cancel_transaction(conn,params,now_ms),
            "CheckTransaction": lambda: check_transaction(conn,params),
            "GetStatement": lambda: get_statement(conn,params),
        }
        if method not in handlers:
            raise PaymeError(-32601,"Method unavailable",method)
        # Nested psycopg transaction rolls back mutations before returning errors.
        with conn.transaction():
            result = handlers[method]()
        return {"id":rid,"result":result}
    except PaymeError as exc:
        return {"id":rid,"error":{"code":exc.code,"message":exc.message,"data":exc.data}}
    except Exception:
        return {"id":rid,"error":{"code":-32400,"message":"Internal error","data":None}}
