"""Standalone local analytics service. Never mount in production."""
import os
import hmac
from contextlib import contextmanager
from urllib.parse import urlsplit
from fastapi import FastAPI, Header, HTTPException
from billing_analytics_api import build_analytics_router

app = FastAPI(title="Billing analytics sandbox", docs_url=None, redoc_url=None, openapi_url=None)

def config():
    if os.getenv("ENABLE_ANALYTICS_LOCAL_SANDBOX") != "true":
        raise HTTPException(503, "Sandbox disabled")
    dsn = os.getenv("BILLING_LOCAL_TEST_DSN", "")
    u = urlsplit(dsn)
    if u.scheme not in ("postgresql", "postgres") or u.hostname not in ("localhost", "127.0.0.1", "::1") or u.path != "/wondertale_billing_test" or u.query or u.fragment:
        raise HTTPException(503, "Isolated database required")
    return dsn

def admin(authorization: str = Header(default="")):
    config()
    token = os.getenv("ANALYTICS_TEST_ADMIN_TOKEN", "")
    if len(token) < 32 or not hmac.compare_digest(authorization.encode(), ("Bearer " + token).encode()):
        raise HTTPException(401, "Sandbox authentication required")
    return True

@contextmanager
def connection():
    import psycopg
    with psycopg.connect(config(), connect_timeout=5, options="-c statement_timeout=5000") as conn:
        yield conn

@app.middleware("http")
async def no_cache(request, call_next):
    response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    return response

app.include_router(build_analytics_router(admin, connection))
