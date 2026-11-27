"""Local-only promotion API; never mount in production."""
import os
import hmac
from contextlib import contextmanager
from urllib.parse import urlsplit
from fastapi import FastAPI, Header, HTTPException
from billing_promotion_api import build_promotion_router
from billing_promotion_admin_api import build_promotion_admin_router

app=FastAPI(title="Local promotion sandbox",docs_url=None,redoc_url=None,openapi_url=None)

def config():
    if os.getenv("ENABLE_PROMOTION_LOCAL_SANDBOX")!="true":
        raise HTTPException(503,"Sandbox disabled")
    dsn=os.getenv("BILLING_LOCAL_TEST_DSN","")
    u=urlsplit(dsn)
    if u.scheme not in ("postgresql","postgres") or u.hostname not in ("localhost","127.0.0.1","::1") or u.path!="/wondertale_billing_test" or u.query or u.fragment:
        raise HTTPException(503,"Isolated database required")
    return dsn

def verify(header, env):
    config()
    secret=os.getenv(env,"")
    if len(secret)<32 or not header or not hmac.compare_digest(header.encode(),("Bearer "+secret).encode()):
        raise HTTPException(401,"Sandbox authentication required")

def owner(authorization: str=Header(default="")):
    verify(authorization,"PROMOTION_TEST_USER_TOKEN")
    owner_id=os.getenv("PROMOTION_TEST_OWNER_ID","")
    if not owner_id:
        raise HTTPException(503,"Test owner missing")
    return owner_id

def admin(authorization: str=Header(default="")):
    verify(authorization,"PROMOTION_TEST_ADMIN_TOKEN")
    if os.getenv("PROMOTION_TEST_ADMIN_TOKEN")==os.getenv("PROMOTION_TEST_USER_TOKEN"):
        raise HTTPException(503,"Separate tokens required")
    return True

@contextmanager
def connection():
    import psycopg
    with psycopg.connect(config(),connect_timeout=5,options="-c statement_timeout=5000") as conn:
        yield conn

app.include_router(build_promotion_router(owner,connection))
app.include_router(build_promotion_admin_router(admin,connection))
