"""Unmounted promotion quote router. Host must supply authenticated owner dependency."""
from datetime import datetime, timezone
from collections import deque
from threading import Lock
from time import monotonic
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field
from billing_promotions import quote_promotion

class PromotionQuoteRequest(BaseModel):
    plan_id: str = Field(min_length=1,max_length=16)
    code: str = Field(min_length=4,max_length=32)

def build_promotion_router(owner_dependency, connection_factory):
    """Only mount in an isolated billing test application.
    owner_dependency must return the authenticated parent's ID, never client input.
    connection_factory must supply an isolated PostgreSQL connection context.
    """
    router=APIRouter(prefix="/api/billing/promotions")
    attempts={}
    lock=Lock()

    def throttle(owner_id):
        with lock:
            now=monotonic()
            for key in list(attempts):
                queue=attempts[key]
                while queue and queue[0]<=now-60:
                    queue.popleft()
                if not queue:
                    del attempts[key]
            if owner_id not in attempts and len(attempts)>=1024:
                raise HTTPException(429,"Too many requests",headers={"Retry-After":"60","Cache-Control":"no-store"})
            queue=attempts.setdefault(owner_id,deque())
            if len(queue)>=20:
                raise HTTPException(429,"Too many requests",headers={"Retry-After":"60","Cache-Control":"no-store"})
            queue.append(now)

    @router.post("/quote")
    def quote(body: PromotionQuoteRequest, response: Response, owner_id: str=Depends(owner_dependency)):
        response.headers["Cache-Control"]="no-store"
        if not isinstance(owner_id,str) or not owner_id:
            raise HTTPException(401,"Authentication required")
        throttle(owner_id)
        try:
            with connection_factory() as conn:
                conn.execute("SET TRANSACTION READ ONLY")
                return quote_promotion(conn,owner_id,body.plan_id,body.code,datetime.now(timezone.utc))
        except ValueError:
            raise HTTPException(400,"Promotion unavailable",headers={"Cache-Control":"no-store"}) from None
    return router
