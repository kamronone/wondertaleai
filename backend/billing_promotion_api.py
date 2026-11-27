"""Unmounted promotion quote router. Host must supply authenticated owner dependency."""
from datetime import datetime, timezone
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
    @router.post("/quote")
    def quote(body: PromotionQuoteRequest, response: Response, owner_id: str=Depends(owner_dependency)):
        response.headers["Cache-Control"]="no-store"
        if not isinstance(owner_id,str) or not owner_id:
            raise HTTPException(401,"Authentication required")
        try:
            with connection_factory() as conn:
                conn.execute("SET TRANSACTION READ ONLY")
                return quote_promotion(conn,owner_id,body.plan_id,body.code,datetime.now(timezone.utc))
        except ValueError:
            raise HTTPException(400,"Promotion unavailable",headers={"Cache-Control":"no-store"}) from None
    return router
