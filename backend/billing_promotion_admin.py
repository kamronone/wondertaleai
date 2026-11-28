"""Internal repository for isolated billing tests. Not an HTTP API.
Caller must authorize administrator and own transaction.
"""
from billing_promotions import normalize_code, discount_minor
from billing_domain import get_plan, utc

def create_promotion(conn, *, code, kind, value, plan_id, starts_at, ends_at, max_uses):
    code=normalize_code(code)
    if plan_id not in (None,"plus","family"):
        raise ValueError("Invalid plan")
    starts_at,ends_at=utc(starts_at),utc(ends_at)
    if ends_at<=starts_at or type(max_uses) is not int or not 1<=max_uses<=1000000:
        raise ValueError("Invalid promotion limits")
    for target in ([plan_id] if plan_id else ["plus","family"]):
        discount_minor(get_plan(target).price_minor,kind,value)
    conn.execute("""INSERT INTO billing_promotions
        (code,discount_kind,discount_value,plan_id,starts_at,ends_at,max_uses,enabled)
        VALUES (%s,%s,%s,%s,%s,%s,%s,FALSE)""",
        (code,kind,value,plan_id,starts_at,ends_at,max_uses))
    return code

def set_promotion_enabled(conn,code,enabled,now):
    code=normalize_code(code)
    now=utc(now)
    if type(enabled) is not bool:
        raise ValueError("Invalid status")
    row=conn.execute("SELECT ends_at FROM billing_promotions WHERE code=%s FOR UPDATE",(code,)).fetchone()
    if not row:
        raise LookupError("Promotion not found")
    if enabled and row[0]<=now:
        raise ValueError("Expired promotion")
    conn.execute("UPDATE billing_promotions SET enabled=%s WHERE code=%s",(enabled,code))

def list_promotions(conn,limit=50,after_code=None):
    if type(limit) is not int or not 1<=limit<=100:
        raise ValueError("Invalid limit")
    after=normalize_code(after_code) if after_code is not None else ""
    rows=conn.execute("""SELECT p.code,p.discount_kind,p.discount_value,p.plan_id,
        p.starts_at,p.ends_at,p.max_uses,p.enabled,
        COUNT(r.order_id) FILTER (WHERE r.state='reserved'),
        COUNT(r.order_id) FILTER (WHERE r.state='used')
        FROM billing_promotions p LEFT JOIN billing_promotion_redemptions r ON r.code=p.code
        WHERE p.code>%s GROUP BY p.code ORDER BY p.code LIMIT %s""",(after,limit)).fetchall()
    keys=("code","discount_kind","discount_value","plan_id","starts_at","ends_at","max_uses","enabled","reserved","used")
    return [dict(zip(keys,row)) for row in rows]
