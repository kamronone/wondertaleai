import os
from concurrent.futures import ThreadPoolExecutor
from threading import Barrier
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit
from uuid import uuid4
import pytest
from billing_orders import create_sandbox_order, confirm_sandbox_order
from billing_ai import reserve_generation, settle_generation

@pytest.mark.parametrize("scenario",["quota","payment","promotion","gift"])
def test_parallel_billing(scenario):
    dsn=os.getenv("BILLING_LOCAL_TEST_DSN","")
    if not dsn:
        pytest.skip("Local disposable PostgreSQL required")
    u=urlsplit(dsn)
    assert u.scheme in ("postgresql","postgres") and u.hostname in ("localhost","127.0.0.1","::1") and u.path=="/wondertale_billing_test" and not u.query and not u.fragment
    import psycopg
    from psycopg import sql
    schema="billing_race_"+uuid4().hex
    ident=sql.Identifier(schema)
    now=datetime.now(timezone.utc)
    def connect():
        return psycopg.connect(dsn,connect_timeout=5,options="-c statement_timeout=10000 -c lock_timeout=8000")
    try:
        with connect() as conn:
            conn.execute(sql.SQL("CREATE SCHEMA {}").format(ident))
            conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(ident))
            conn.execute("CREATE TABLE parents(id TEXT PRIMARY KEY)")
            files=sorted((Path(__file__).resolve().parents[1]/"migrations").glob("00[1-8]_*.sql"))
            assert len(files)==8
            for file in files:
                conn.execute(file.read_text().replace("BEGIN;","",1).rsplit("COMMIT;",1)[0])
            conn.execute("INSERT INTO parents VALUES ('alice'),('bob'),('carol')")
            order=create_sandbox_order(conn,"alice","plus","race-order")
            if scenario=="quota":
                assert confirm_sandbox_order(conn,"alice",order,"race-event","race-tx",3900000,now)
                for i in range(19):
                    key=f"race_seed_{i:04}"
                    reserve_generation(conn,"alice",key,now)
                    settle_generation(conn,"alice",key,"saved")
            elif scenario=="promotion":
                from datetime import timedelta
                from billing_promotion_admin import create_promotion,set_promotion_enabled
                create_promotion(conn,code="RACE20",kind="percent",value=20,plan_id="plus",starts_at=now-timedelta(days=1),ends_at=now+timedelta(days=1),max_uses=1)
                set_promotion_enabled(conn,"RACE20",True,now)
            elif scenario=="gift":
                from billing_gifts import create_gift_order
                gift=create_gift_order(conn,"alice","plus","race-gift",now)
                assert confirm_sandbox_order(conn,"alice",gift["order_id"],"gift-event","gift-tx",3900000,now)
        barrier=Barrier(2,timeout=10)
        def attempt(i):
            with connect() as conn:
                conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(ident))
                barrier.wait()
                try:
                    if scenario=="quota":
                        return reserve_generation(conn,"alice",f"race_parallel_{i}",now)["may_start"]
                    if scenario=="payment":
                        return confirm_sandbox_order(conn,"alice",order,"race-event","race-tx",3900000,now)
                    owner=("bob","carol")[i]
                    if scenario=="promotion":
                        from billing_promotions import create_promotional_order
                        return create_promotional_order(conn,owner,"plus","RACE20",f"race-promo-{i}",now)["created"]
                    from billing_gifts import redeem_gift
                    return redeem_gift(conn,owner,gift["code"],now)["created"]
                except PermissionError:
                    if scenario!="quota":
                        raise
                    return False
                except ValueError as exc:
                    expected={"promotion":"Promotion exhausted","gift":"Gift unavailable"}.get(scenario)
                    if expected is None or str(exc)!=expected:
                        raise
                    return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(attempt,range(2)))
        assert sorted(results)==[False,True]
        with connect() as conn:
            conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(ident))
            checks={
                "quota":("SELECT count(*) FROM quota_reservations WHERE state IN ('reserved','committed')",20),
                "payment":("SELECT count(*) FROM subscriptions WHERE owner_id='alice'",1),
                "promotion":("SELECT count(*) FROM billing_promotion_redemptions WHERE state='reserved'",1),
                "gift":("SELECT count(*) FROM subscriptions WHERE owner_id IN ('bob','carol')",1),
            }
            query,expected=checks[scenario]
            assert conn.execute(query).fetchone()[0]==expected
            if scenario=="payment":
                assert conn.execute("SELECT count(*) FROM billing_order_entitlements").fetchone()[0]==1
    finally:
        with connect() as conn:
            conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(ident))
