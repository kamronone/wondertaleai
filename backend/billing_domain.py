"""Billing domain primitives. No database writes or payment provider calls."""
from calendar import monthrange
from dataclasses import dataclass
from datetime import datetime, timezone
from types import MappingProxyType

@dataclass(frozen=True)
class Plan:
    id: str
    version: int
    price_minor: int
    story_limit: int
    currency: str = "UZS"

PLANS = MappingProxyType({
    "free": Plan("free", 1, 0, 0),
    "plus": Plan("plus", 1, 3900000, 20),
    "family": Plan("family", 1, 7900000, 60),
})

def get_plan(plan_id: str) -> Plan:
    if not isinstance(plan_id, str) or plan_id not in PLANS:
        raise ValueError("Unknown billing plan")
    return PLANS[plan_id]

def utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Timezone required")
    return value.astimezone(timezone.utc)

def period_end(start: datetime) -> datetime:
    start = utc(start)
    year = start.year + (start.month == 12)
    month = start.month % 12 + 1
    return start.replace(year=year, month=month,
                         day=min(start.day, monthrange(year, month)[1]))

def remaining_stories(plan_id: str, used: int, reserved: int,
                      start: datetime, end: datetime, now: datetime) -> int:
    plan = get_plan(plan_id)
    if type(used) is not int or type(reserved) is not int or min(used, reserved) < 0:
        raise ValueError("Invalid quota counters")
    start, end, now = utc(start), utc(end), utc(now)
    if end <= start:
        raise ValueError("Invalid subscription period")
    if not start <= now < end:
        return 0
    return max(0, plan.story_limit - used - reserved)

def public_plans() -> list[dict]:
    return [{"id": p.id, "version": p.version, "price_minor": p.price_minor,
             "currency": p.currency, "story_limit": p.story_limit,
             "payments_enabled": False, "pricing_is_proposed": True}
            for p in PLANS.values()]
