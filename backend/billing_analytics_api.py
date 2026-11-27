"""Unmounted admin router for isolated billing analytics."""
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response
from billing_analytics import billing_summary

def build_analytics_router(admin_dependency, connection_factory):
    router = APIRouter(prefix="/api/billing/admin/analytics", tags=["billing-analytics"])

    @router.get("/summary")
    def summary(response: Response, start: datetime, end: datetime,
                admin=Depends(admin_dependency)):
        if admin is not True:
            raise HTTPException(status_code=403, detail="Admin access required")
        if any(v.tzinfo is None or v.utcoffset() is None for v in (start,end)):
            raise HTTPException(status_code=400, detail="Timezone required")
        start, end = start.astimezone(timezone.utc), end.astimezone(timezone.utc)
        if not timedelta(0) < end-start <= timedelta(days=366):
            raise HTTPException(status_code=400, detail="Invalid reporting interval")
        response.headers["Cache-Control"] = "no-store"
        with connection_factory() as conn:
            with conn.transaction():
                conn.execute("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY")
                conn.execute("SET LOCAL statement_timeout = '5000ms'")
                return billing_summary(conn,start,end,datetime.now(timezone.utc))

    return router
