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
            migration = (Path(__file__).resolve().parents[1]/"migrations"/"001_billing.sql").read_text()
            migration = migration.replace("BEGIN;","",1).rsplit("COMMIT;",1)[0]
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
