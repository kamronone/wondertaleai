"""Local-only gift API. Never mount in production or expose publicly."""
import os
import hmac
from contextlib import contextmanager
from urllib.parse import urlsplit
from fastapi import FastAPI, Header, HTTPException
from billing_gift_api import build_gift_router

app=FastAPI(title="Local gift sandbox",docs_url=None,redoc_url=None,openapi_url=None)

def config():
    if os.getenv("ENABLE_GIFT_LOCAL_SANDBOX")!="true":
        raise HTTPException(503,"Sandbox disabled")
    dsn=os.getenv("BILLING_LOCAL_TEST_DSN","")
    try:
        u=urlsplit(dsn)
        valid=(u.scheme in ("postgresql","postgres") and u.hostname in ("localhost","127.0.0.1","::1")
               and u.path=="/wondertale_billing_test" and not u.query and not u.fragment)
    except ValueError:
        valid=False
    if not valid:
        raise HTTPException(503,"Isolated database required")
    return dsn

def owner(authorization: str=Header(default="")):
    config()
    tokens=[os.getenv("GIFT_TEST_BUYER_TOKEN",""),os.getenv("GIFT_TEST_RECIPIENT_TOKEN","")]
    owners=[os.getenv("GIFT_TEST_BUYER_ID",""),os.getenv("GIFT_TEST_RECIPIENT_ID","")]
    if any(len(t)<32 for t in tokens) or tokens[0]==tokens[1] or not all(owners) or owners[0]==owners[1]:
        raise HTTPException(503,"Separate test identities required")
    matches=[hmac.compare_digest(authorization.encode(),("Bearer "+t).encode()) for t in tokens]
    if not any(matches):
        raise HTTPException(401,"Sandbox authentication required")
    return owners[matches.index(True)]

@contextmanager
def connection():
    import psycopg
    with psycopg.connect(config(),connect_timeout=5,options="-c statement_timeout=5000") as conn:
        yield conn

@app.middleware("http")
async def prevent_caching(request,call_next):
    response=await call_next(request)
    response.headers["Cache-Control"]="no-store"
    return response

app.include_router(build_gift_router(owner,connection))
