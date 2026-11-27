"""Unmounted admin router for isolated billing tests only."""
from datetime import datetime, timezone
from collections import deque
from threading import Lock
from time import monotonic
from typing import Literal, Optional
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, StrictBool, conint
from billing_promotion_admin import create_promotion, set_promotion_enabled, list_promotions

class PromotionCreate(BaseModel):
    code: str = Field(min_length=4,max_length=32)
    kind: Literal["percent","fixed"]
    value: conint(strict=True,gt=0,le=7900000)
    plan_id: Optional[Literal["plus","family"]] = None
    starts_at: datetime
    ends_at: datetime
    max_uses: conint(strict=True,ge=1,le=1000000)

class PromotionStatus(BaseModel):
    enabled: StrictBool

def build_promotion_admin_router(admin_dependency, connection_factory):
    """Host must authenticate and authorize admin; dependency returns literal True.
    Connection factory must target isolated test PostgreSQL and rollback on errors.
    """
    router=APIRouter(prefix="/api/billing/admin/promotions")
    attempts=deque()
    lock=Lock()
    def authorize(admin=Depends(admin_dependency)):
        if admin is not True:
            raise HTTPException(403,"Administrator required")
        with lock:
            now=monotonic()
            while attempts and attempts[0]<=now-60:
                attempts.popleft()
            if len(attempts)>=30:
                raise HTTPException(429,"Too many requests",headers={"Retry-After":"60","Cache-Control":"no-store"})
            attempts.append(now)
    @router.get("",dependencies=[Depends(authorize)])
    def listing(response: Response, limit: int=50, after_code: Optional[str]=None):
        response.headers["Cache-Control"]="no-store"
        try:
            with connection_factory() as conn:
                conn.execute("SET TRANSACTION READ ONLY")
                return {"items":list_promotions(conn,limit,after_code)}
        except ValueError:
            raise HTTPException(400,"Invalid pagination") from None
    @router.post("",status_code=201,dependencies=[Depends(authorize)])
    def create(body: PromotionCreate,response: Response):
        from psycopg.errors import UniqueViolation
        response.headers["Cache-Control"]="no-store"
        try:
            with connection_factory() as conn:
                code=create_promotion(conn,**body.dict())
                return {"code":code,"enabled":False}
        except UniqueViolation:
            raise HTTPException(409,"Promotion already exists") from None
        except ValueError:
            raise HTTPException(400,"Invalid promotion") from None
    @router.patch("/{code}",dependencies=[Depends(authorize)])
    def change(code: str,body: PromotionStatus,response: Response):
        response.headers["Cache-Control"]="no-store"
        try:
            with connection_factory() as conn:
                set_promotion_enabled(conn,code,body.enabled,datetime.now(timezone.utc))
                return {"code":code.strip().upper(),"enabled":body.enabled}
        except LookupError:
            raise HTTPException(404,"Promotion not found") from None
        except ValueError:
            raise HTTPException(400,"Invalid promotion status") from None
    return router
