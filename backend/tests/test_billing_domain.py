from datetime import datetime, timezone
import pytest
from billing_domain import get_plan, period_end, remaining_stories, public_plans

def test_catalog():
    assert get_plan("plus").price_minor == 3900000
    assert get_plan("family").story_limit == 60
    assert all(not p["payments_enabled"] for p in public_plans())
    with pytest.raises(ValueError):
        get_plan("unknown")

def test_calendar_and_quota():
    start = datetime(2028, 1, 31, tzinfo=timezone.utc)
    end = period_end(start)
    assert end == datetime(2028, 2, 29, tzinfo=timezone.utc)
    assert remaining_stories("plus", 5, 3, start, end, start) == 12
    assert remaining_stories("plus", 5, 3, start, end, end) == 0
    assert remaining_stories("plus", 20, 1, start, end, start) == 0
    with pytest.raises(ValueError):
        remaining_stories("plus", -1, 0, start, end, start)
    with pytest.raises(ValueError):
        period_end(datetime(2028, 1, 31))
