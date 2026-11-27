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


def test_promotion_lifecycle(db):
    from datetime import timedelta
    from billing_promotion_admin import create_promotion, set_promotion_enabled
    from billing_promotions import quote_promotion, create_promotional_order, cancel_promotional_order
    now=datetime.now(timezone.utc)
    create_promotion(db,code="TEST20",kind="percent",value=20,plan_id="plus",
                     starts_at=now-timedelta(days=1),ends_at=now+timedelta(days=1),max_uses=1)
    with pytest.raises(ValueError):
        quote_promotion(db,"alice","plus","TEST20",now)
    set_promotion_enabled(db,"TEST20",True,now)
    assert quote_promotion(db,"alice","plus","test20",now)["total_minor"]==3120000
    with pytest.raises(ValueError):
        quote_promotion(db,"alice","family","TEST20",now)
    first=create_promotional_order(db,"alice","plus","TEST20","promo-one",now)
    assert not create_promotional_order(db,"alice","plus","TEST20","promo-one",now)["created"]
    with pytest.raises(ValueError):
        quote_promotion(db,"bob","plus","TEST20",now)
    assert cancel_promotional_order(db,"alice",first["order_id"])=="released"
    second=create_promotional_order(db,"alice","plus","TEST20","promo-two",now)
    assert confirm_sandbox_order(db,"alice",second["order_id"],"promo-event","promo-tx",3120000,now)
    assert not confirm_sandbox_order(db,"alice",second["order_id"],"promo-event","promo-tx",3120000,now)
    assert db.execute("SELECT state FROM billing_promotion_redemptions WHERE order_id=%s",(second["order_id"],)).fetchone()[0]=="used"
    with pytest.raises(ValueError):
        quote_promotion(db,"bob","plus","TEST20",now)


def test_quota_exhaustion(db):
    now=datetime.now(timezone.utc)
    order=create_sandbox_order(db,"alice","plus","quota-order")
    assert confirm_sandbox_order(db,"alice",order,"quota-event","quota-tx",3900000,now)
    for i in range(20):
        key=f"quota_request_{i:04}"
        assert reserve_generation(db,"alice",key,now)["remaining"]==19-i
        assert settle_generation(db,"alice",key,"saved")
    with pytest.raises(PermissionError):
        reserve_generation(db,"alice","quota_request_extra",now)
    assert not reserve_generation(db,"alice","quota_request_0000",now)["may_start"]


@pytest.mark.parametrize("provider",["payme","click"])
def test_provider_lifecycle(db,provider):
    from uuid import uuid4
    import hashlib
    from billing_payme import create_transaction,perform_transaction,check_transaction
    from billing_click import prepare,complete
    now=datetime.now(timezone.utc)
    stamp=int(now.timestamp()*1000)
    oid=uuid4()
    db.execute("""INSERT INTO payment_orders
        (id,owner_id,plan_id,plan_version,amount_minor,currency,provider,state,idempotency_key)
        VALUES (%s,'alice','plus',1,3900000,'UZS',%s,'pending','provider-test')""",(oid,provider))
    if provider=="payme":
        pid="a"*24
        params={"id":pid,"time":stamp,"amount":3900000,"account":{"order_id":str(oid)}}
        first=create_transaction(db,params,stamp)
        assert first==create_transaction(db,params,stamp)
        paid=perform_transaction(db,{"id":pid},stamp)
        assert paid["state"]==2
        assert paid==perform_transaction(db,{"id":pid},stamp+1)
        assert check_transaction(db,{"id":pid})["state"]==2
    else:
        service,secret="123","local-test-secret"
        params={"click_trans_id":"456","service_id":service,"merchant_trans_id":str(oid),
                "amount":"39000.00","action":"0","sign_time":"2026-11-27 12:00:00","error":"0"}
        def sign():
            parts=[params["click_trans_id"],service,secret,str(oid)]
            if params["action"]=="1":
                parts.append(params["merchant_prepare_id"])
            parts.extend([params["amount"],params["action"],params["sign_time"]])
            params["sign_string"]=hashlib.md5("".join(parts).encode()).hexdigest()
        sign()
        first=prepare(db,params,service,secret)
        assert first["error"]==0
        assert first==prepare(db,params,service,secret)
        params.update(action="1",merchant_prepare_id=str(first["merchant_prepare_id"]))
        sign()
        assert complete(db,params,service,secret,now)["error"]==0
        assert complete(db,params,service,secret,now)["error"]==-4
    assert db.execute("SELECT state FROM payment_orders WHERE id=%s",(oid,)).fetchone()[0]=="paid"
    assert db.execute("SELECT count(*) FROM subscriptions WHERE owner_id='alice'").fetchone()[0]==1
    assert db.execute("SELECT count(*) FROM billing_order_entitlements WHERE order_id=%s",(oid,)).fetchone()[0]==1
