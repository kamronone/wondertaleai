"""Internal read-only analytics; sandbox figures are not real revenue."""
from datetime import datetime

def billing_summary(conn, start: datetime, end: datetime, now: datetime):
    for value in (start, end, now):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Timezone required")
    if start >= end or (end-start).days > 366:
        raise ValueError("Invalid reporting interval")
    row = conn.execute("""
        SELECT count(*),
               count(*) FILTER (WHERE state IN ('paid','partially_refunded','refunded')),
               COALESCE(sum(amount_minor) FILTER (WHERE state IN ('paid','partially_refunded','refunded')),0),
               count(DISTINCT owner_id),
               count(DISTINCT owner_id) FILTER (WHERE state IN ('paid','partially_refunded','refunded'))
        FROM payment_orders
        WHERE provider='sandbox' AND created_at >= %s AND created_at < %s
    """,(start,end)).fetchone()
    refunded = conn.execute("""
        SELECT COALESCE(sum(r.amount_minor),0)
        FROM refunds r JOIN payment_orders o ON o.id=r.order_id
        WHERE o.provider='sandbox' AND o.created_at >= %s AND o.created_at < %s
          AND r.state='completed'
    """,(start,end)).fetchone()[0]
    active = conn.execute("""
        SELECT s.plan_id,count(*),COALESCE(sum(p.price_minor),0)
        FROM subscriptions s JOIN billing_plans p
          ON p.id=s.plan_id AND p.version=s.plan_version
        WHERE s.status='active' AND s.period_start <= %s AND s.period_end > %s
          AND EXISTS (
            SELECT 1 FROM payment_orders o
            WHERE o.provider='sandbox' AND (
              EXISTS (SELECT 1 FROM billing_order_entitlements e WHERE e.order_id=o.id AND e.subscription_id=s.id)
              OR EXISTS (SELECT 1 FROM billing_gift_orders g JOIN billing_gift_codes c ON c.id=g.gift_id
                         WHERE g.order_id=o.id AND c.subscription_id=s.id)
            )
          )
        GROUP BY s.plan_id ORDER BY s.plan_id
    """,(now,now)).fetchall()
    daily = conn.execute("""
        WITH orders AS (
          SELECT id, (created_at AT TIME ZONE 'UTC')::date AS day, amount_minor, state
          FROM payment_orders WHERE provider='sandbox' AND created_at >= %s AND created_at < %s
        ), refund_totals AS (
          SELECT r.order_id, sum(r.amount_minor) AS amount FROM refunds r JOIN orders o ON o.id=r.order_id
          WHERE r.state='completed' GROUP BY r.order_id
        )
        SELECT o.day, count(*), count(*) FILTER (WHERE o.state IN ('paid','partially_refunded','refunded')),
          COALESCE(sum(o.amount_minor) FILTER (WHERE o.state IN ('paid','partially_refunded','refunded')),0),
          COALESCE(sum(r.amount),0)
        FROM orders o LEFT JOIN refund_totals r ON r.order_id=o.id GROUP BY o.day ORDER BY o.day
    """,(start,end)).fetchall()
    return {
        "daily":[{"day":d.isoformat(),"orders":int(n),"paid_orders":int(p),"gross_minor":int(g),"refund_minor":int(r),"net_minor":int(g)-int(r)} for d,n,p,g,r in daily],
        "mode":"sandbox","currency":"UZS","amount_unit":"tiyin",
        "basis":"order_creation_cohort_current_state",
        "start":start.isoformat(),"end":end.isoformat(),"as_of":now.isoformat(),
        "orders":int(row[0]),"paid_orders":int(row[1]),
        "gross_minor":int(row[2]),"refund_minor":int(refunded),
        "net_minor":int(row[2])-int(refunded),
        "ordering_accounts":int(row[3]),"paying_accounts":int(row[4]),
        "order_conversion":float(row[1]/row[0]) if row[0] else None,
        "active_plans":[{"plan":p,"count":int(n),"monthly_list_value_minor":int(v)} for p,n,v in active],
        "active_subscriptions":sum(int(n) for _,n,_ in active),
        "monthly_list_value_minor":sum(int(v) for _,_,v in active),
        "auto_renewal":False
    }
