"""Run only against a disposable local PostgreSQL database.
Creates a temporary schema and rolls back all changes.
"""
import os
from pathlib import Path
from datetime import datetime, timezone
from uuid import uuid4
import pytest
from billing_orders import create_sandbox_order, confirm_sandbox_order
from billing_ai import reserve_generation, settle_generation
from billing_history import list_orders

@pytest.fixture
def db():
    url = os.getenv("BILLING_LOCAL_TEST_DSN")
    if not url:
        pytest.skip("Disposable local PostgreSQL required")
    from urllib.parse import urlparse
    parsed = urlparse(url)
    if parsed.scheme not in ("postgresql","postgres") or parsed.hostname not in ("localhost","127.0.0.1","::1") or parsed.path != "/wondertale_billing_test" or parsed.query:
        pytest.fail("Only local wondertale_billing_test database permitted")
    import psycopg
    from psycopg import sql
    with psycopg.connect(url) as conn:
        try:
            schema = "billing_test_" + uuid4().hex
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(sql.Identifier(schema)))
            conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(sql.Identifier(schema)))
            conn.execute("CREATE TABLE parents(id TEXT PRIMARY KEY)")
            migrations = sorted((Path(__file__).resolve().parents[1]/"migrations").glob("00[1-8]_*.sql"))
            assert [p.name[:3] for p in migrations] == [f"{i:03}" for i in range(1,9)]
            for file in migrations:
                migration = file.read_text().replace("BEGIN;","",1).rsplit("COMMIT;",1)[0]
                conn.execute(migration)
            conn.execute("INSERT INTO parents(id) VALUES ('alice'),('bob')")
            yield conn
        finally:
            conn.rollback()

def test_lifecycle(db):
    now = datetime(2026,11,27,tzinfo=timezone.utc)
    order = create_sandbox_order(db,"alice","plus","order-one")
    assert create_sandbox_order(db,"alice","plus","order-one")==order
    assert confirm_sandbox_order(db,"alice",order,"event-one","tx-one",3900000,now)
    assert not confirm_sandbox_order(db,"alice",order,"event-one","tx-one",3900000,now)
    key = "request_key_00001"
    assert reserve_generation(db,"alice",key,now)["remaining"]==19
    assert not reserve_generation(db,"alice",key,now)["may_start"]
    assert settle_generation(db,"alice",key,"saved")
    assert not settle_generation(db,"alice",key,"saved")
    assert list_orders(db,"bob")["items"]==[]
    assert list_orders(db,"alice")["items"][0]["status"]=="paid"
    with pytest.raises(PermissionError):
        reserve_generation(db,"bob",key,now)

def test_amount_mismatch(db):
    now = datetime(2026,11,27,tzinfo=timezone.utc)
    order = create_sandbox_order(db,"alice","family","order-two")
    with pytest.raises(ValueError):
        confirm_sandbox_order(db,"alice",order,"event-two","tx-two",1,now)
    assert list_orders(db,"alice")["items"][0]["status"]=="pending"


def test_gift_lifecycle(db):
    from billing_gifts import create_gift_order, redeem_gift, rotate_gift_code, list_gifts
    now=datetime(2026,11,27,tzinfo=timezone.utc)
    gift=create_gift_order(db,"alice","plus","gift-one",now)
    repeat=create_gift_order(db,"alice","plus","gift-one",now)
    assert repeat["order_id"]==gift["order_id"] and repeat["code"] is None
    with pytest.raises(ValueError):
        redeem_gift(db,"bob",gift["code"],now)
    assert confirm_sandbox_order(db,"alice",gift["order_id"],"gift-event","gift-tx",3900000,now)
    assert not confirm_sandbox_order(db,"alice",gift["order_id"],"gift-event","gift-tx",3900000,now)
    assert not db.execute("SELECT 1 FROM subscriptions WHERE owner_id='alice'").fetchone()
    with pytest.raises(ValueError):
        rotate_gift_code(db,"bob",gift["gift_id"],now)
    rotated=rotate_gift_code(db,"alice",gift["gift_id"],now)
    with pytest.raises(ValueError):
        redeem_gift(db,"bob",gift["code"],now)
    result=redeem_gift(db,"bob",rotated["code"],now)
    assert result["created"]
    assert not redeem_gift(db,"bob",rotated["code"],now)["created"]
    assert list_gifts(db,"bob",now,direction="purchased")["items"]==[]
    assert list_gifts(db,"bob",now,direction="received")["items"][0]["gift_id"]==gift["gift_id"]
    with pytest.raises(ValueError):
        rotate_gift_code(db,"alice",gift["gift_id"],now)

def test_gift_refund(db):
    from billing_gifts import create_gift_order, redeem_gift, reconcile_gift_refund
    now=datetime(2026,11,27,tzinfo=timezone.utc)
    gift=create_gift_order(db,"alice","family","gift-refund",now)
    assert confirm_sandbox_order(db,"alice",gift["order_id"],"refund-event","refund-tx",7900000,now)
    assert reconcile_gift_refund(db,"alice",gift["order_id"],7900000,now)
    assert not reconcile_gift_refund(db,"alice",gift["order_id"],7900000,now)
    with pytest.raises(ValueError):
        redeem_gift(db,"bob",gift["code"],now)


def test_financial_summary(db):
    from datetime import timedelta
    from billing_analytics import billing_summary
    from billing_gifts import create_gift_order, reconcile_gift_refund
    now = datetime.now(timezone.utc)
    order = create_sandbox_order(db,"alice","plus","analytics-personal")
    assert confirm_sandbox_order(db,"alice",order,"analytics-event","analytics-tx",3900000,now)
    gift = create_gift_order(db,"bob","family","analytics-gift",now)
    assert confirm_sandbox_order(db,"bob",gift["order_id"],"analytics-gift-event","analytics-gift-tx",7900000,now)
    assert reconcile_gift_refund(db,"bob",gift["order_id"],7900000,now)
    report = billing_summary(db,now-timedelta(days=1),now+timedelta(days=1),now)
    assert report["mode"]=="sandbox"
    assert report["orders"]==2
    assert report["paid_orders"]==2
    assert report["gross_minor"]==11800000
    assert report["refund_minor"]==7900000
    assert report["net_minor"]==3900000
    assert report["active_subscriptions"]==1
    assert report["monthly_list_value_minor"]==3900000
    assert sum(d["net_minor"] for d in report["daily"])==report["net_minor"]
    assert report["gifts"][0]["refunded"]==1
    assert report["promotions"]==[]
