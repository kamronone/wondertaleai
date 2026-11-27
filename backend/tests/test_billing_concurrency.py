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

def test_parallel_last_quota():
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
            conn.execute("INSERT INTO parents VALUES ('alice')")
            order=create_sandbox_order(conn,"alice","plus","race-order")
            assert confirm_sandbox_order(conn,"alice",order,"race-event","race-tx",3900000,now)
            for i in range(19):
                key=f"race_seed_{i:04}"
                reserve_generation(conn,"alice",key,now)
                settle_generation(conn,"alice",key,"saved")
        barrier=Barrier(2,timeout=10)
        def attempt(i):
            with connect() as conn:
                conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(ident))
                barrier.wait()
                try:
                    result=reserve_generation(conn,"alice",f"race_parallel_{i}",now)
                    return result["may_start"]
                except PermissionError:
                    return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(attempt,range(2)))
        assert sorted(results)==[False,True]
        with connect() as conn:
            conn.execute(sql.SQL("SET LOCAL search_path TO {}").format(ident))
            assert conn.execute("SELECT count(*) FROM quota_reservations WHERE state IN ('reserved','committed')").fetchone()[0]==20
    finally:
        with connect() as conn:
            conn.execute(sql.SQL("DROP SCHEMA IF EXISTS {} CASCADE").format(ident))
