"""Standalone local Click test application; never mount in production."""
import os
from datetime import datetime, timezone
from urllib.parse import urlparse, parse_qsl
from fastapi import FastAPI, Request, HTTPException
from starlette.concurrency import run_in_threadpool
from billing_click import prepare, complete

app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

def config():
    if os.getenv("ENABLE_CLICK_LOCAL_SANDBOX") != "true":
        raise HTTPException(503,"Sandbox disabled")
    dsn=os.getenv("BILLING_LOCAL_TEST_DSN","")
    p=urlparse(dsn)
    if p.scheme not in ("postgres","postgresql") or p.hostname not in ("localhost","127.0.0.1","::1") or p.path!="/wondertale_billing_test" or p.query or p.fragment:
        raise HTTPException(503,"Local test database required")
    service=os.getenv("CLICK_SANDBOX_SERVICE_ID","")
    secret=os.getenv("CLICK_SANDBOX_SECRET","")
    if not service or not secret:
        raise HTTPException(503,"Sandbox credentials missing")
    return dsn,service,secret

@app.post("/api/billing/click/sandbox/{operation}")
async def callback(operation: str, request: Request):
    if operation not in ("prepare","complete"):
        raise HTTPException(404)
    dsn,service,secret=config()
    if request.headers.get("content-type","").split(";")[0].strip().lower()!="application/x-www-form-urlencoded":
        raise HTTPException(415)
    data=bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>16384:
            raise HTTPException(413)
    try:
        pairs=parse_qsl(data.decode("utf-8"),keep_blank_values=True,strict_parsing=True,max_num_fields=32,errors="strict")
        params=dict(pairs)
        if len(params)!=len(pairs):
            raise ValueError("Duplicate field")
    except (ValueError,UnicodeError):
        raise HTTPException(400,"Invalid form")
    def execute():
        import psycopg
        try:
            with psycopg.connect(dsn,connect_timeout=5) as conn:
                conn.execute("SET LOCAL statement_timeout = '5s'")
                if operation=="prepare":
                    return prepare(conn,params,service,secret)
                return complete(conn,params,service,secret,datetime.now(timezone.utc))
        except Exception:
            return {"click_trans_id":params.get("click_trans_id"),"merchant_trans_id":params.get("merchant_trans_id"),"error":-7,"error_note":"Internal error"}
    return await run_in_threadpool(execute)
