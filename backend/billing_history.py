"""Read-only PostgreSQL billing history. Not wired into live API."""
from datetime import datetime
from uuid import UUID
from billing_domain import utc

def list_orders(conn, owner_id: str, *, limit: int = 20,
                before_time: datetime | None = None,
                before_id: UUID | None = None) -> dict:
    if type(limit) is not int or not 1 <= limit <= 100:
        raise ValueError("Invalid page size")
    if (before_time is None) != (before_id is None):
        raise ValueError("Both cursor fields required")
    if before_time is None:
        rows = conn.execute("""SELECT id,plan_id,plan_version,amount_minor,currency,
            provider,state,created_at FROM payment_orders
            WHERE owner_id=%s ORDER BY created_at DESC,id DESC LIMIT %s""",
            (owner_id,limit+1)).fetchall()
    else:
        rows = conn.execute("""SELECT id,plan_id,plan_version,amount_minor,currency,
            provider,state,created_at FROM payment_orders
            WHERE owner_id=%s AND (created_at,id)<(%s,%s)
            ORDER BY created_at DESC,id DESC LIMIT %s""",
            (owner_id,utc(before_time),UUID(str(before_id)),limit+1)).fetchall()
    page = rows[:limit]
    items = [{"id":str(r[0]),"plan":r[1],"plan_version":r[2],
              "amount_minor":r[3],"currency":r[4],"provider":r[5],
              "status":r[6],"created_at":utc(r[7]).isoformat()} for r in page]
    cursor = None
    if len(rows)>limit:
        cursor = {"before_time":items[-1]["created_at"],"before_id":items[-1]["id"]}
    return {"items":items,"next_cursor":cursor,"payments_enabled":False}

def get_order(conn, owner_id: str, order_id: UUID) -> dict | None:
    row = conn.execute("""SELECT id,plan_id,plan_version,amount_minor,currency,
        provider,state,created_at FROM payment_orders WHERE owner_id=%s AND id=%s""",
        (owner_id,UUID(str(order_id)))).fetchone()
    if not row:
        return None
    return {"id":str(row[0]),"plan":row[1],"plan_version":row[2],
            "amount_minor":row[3],"currency":row[4],"provider":row[5],
            "status":row[6],"created_at":utc(row[7]).isoformat()}
