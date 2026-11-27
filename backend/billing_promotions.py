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
    if conn.execute("SELECT 1 FROM billing_promotion_redemptions WHERE code=%s AND owner_id=%s",(code,owner_id)).fetchone():
        raise ValueError("Promotion already claimed")
    count=conn.execute("SELECT COUNT(*) FROM billing_promotion_redemptions WHERE code=%s AND state IN ('reserved','used')",(code,)).fetchone()[0]
    if count>=row[5]:
        raise ValueError("Promotion exhausted")
    discount=discount_minor(plan.price_minor,row[0],row[1])
    return {"code":code,"plan_id":plan_id,"original_minor":plan.price_minor,
            "discount_minor":discount,"total_minor":plan.price_minor-discount,
            "currency":plan.currency,"guaranteed":False}
