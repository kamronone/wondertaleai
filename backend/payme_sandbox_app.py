"""Standalone test app; never mount in secure_main or production.
Requires disposable local PostgreSQL and manually applied billing migrations.
"""
import os
from urllib.parse import urlparse
from fastapi import FastAPI, Request, HTTPException
from billing_payme import dispatch_sandbox

app = FastAPI(title="WonderTale Payme local sandbox", docs_url=None,
              redoc_url=None, openapi_url=None)

def config():
    if os.getenv("ENABLE_PAYME_LOCAL_SANDBOX") != "true":
        raise HTTPException(503,"Sandbox disabled")
    dsn = os.getenv("BILLING_LOCAL_TEST_DSN","")
    parsed = urlparse(dsn)
    if (parsed.scheme not in ("postgres","postgresql") or
        parsed.hostname not in ("localhost","127.0.0.1","::1") or
        parsed.path != "/wondertale_billing_test" or parsed.query or parsed.fragment):
        raise HTTPException(503,"Local test database required")
    secret = os.getenv("PAYME_SANDBOX_SECRET","")
    if not secret:
        raise HTTPException(503,"Sandbox credentials missing")
    return dsn,secret

@app.post("/api/billing/payme/sandbox")
async def callback(request: Request):
    import json
    from starlette.concurrency import run_in_threadpool
    dsn,secret = config()
    data = bytearray()
    async for chunk in request.stream():
        data.extend(chunk)
        if len(data)>65536:
            raise HTTPException(413,"Request too large")
    try:
        payload=json.loads(data)
    except (ValueError,UnicodeError):
        return {"id":None,"error":{"code":-32700,"message":"Parse error","data":None}}
    header=request.headers.get("authorization","")
    def execute():
        import psycopg
        try:
            with psycopg.connect(dsn,connect_timeout=5) as conn:
                conn.execute("SET LOCAL statement_timeout = '5s'")
                return dispatch_sandbox(conn,payload,header,"Paycom",secret)
        except Exception:
            return {"id":None,"error":{"code":-32400,"message":"Internal error","data":None}}
    return await run_in_threadpool(execute)
