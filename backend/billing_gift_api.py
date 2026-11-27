"""Unmounted gift API for isolated sandbox use only."""
from datetime import datetime, timezone
from uuid import UUID
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.routing import APIRoute
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from billing_gifts import create_gift_order, redeem_gift, rotate_gift_code, list_gifts

class GiftOrder(BaseModel):
    plan_id: Literal["plus", "family"]
    request_key: str = Field(min_length=1, max_length=128)

class GiftRedeem(BaseModel):
    code: str = Field(min_length=43, max_length=43)

class PrivateGiftRoute(APIRoute):
    def get_route_handler(self):
        handler=super().get_route_handler()
        async def private_handler(request: Request):
            try:
                return await handler(request)
            except RequestValidationError:
                return JSONResponse(status_code=422,content={"detail":"Invalid gift request"},
                                    headers={"Cache-Control":"no-store"})
        return private_handler

def build_gift_router(owner_dependency, connection_factory):
    router = APIRouter(prefix="/api/billing/gifts",route_class=PrivateGiftRoute)
    def run(owner, response, operation):
        response.headers["Cache-Control"] = "no-store"
        if not isinstance(owner,str) or not owner:
            raise HTTPException(401,"Authentication required")
        try:
            with connection_factory() as conn:
                with conn.transaction():
                    return operation(conn,datetime.now(timezone.utc))
        except (ValueError, LookupError):
            raise HTTPException(400,"Gift operation unavailable",headers={"Cache-Control":"no-store"}) from None

    @router.post("/orders")
    def create(body: GiftOrder,response: Response,owner=Depends(owner_dependency)):
        return run(owner,response,lambda conn,now:create_gift_order(
            conn,owner,body.plan_id,body.request_key,now,provider="sandbox"))

    @router.post("/redeem")
    def redeem(body: GiftRedeem,response: Response,owner=Depends(owner_dependency)):
        return run(owner,response,lambda conn,now:redeem_gift(conn,owner,body.code,now))

    @router.post("/{gift_id}/rotate")
    def rotate(gift_id: UUID,response: Response,owner=Depends(owner_dependency)):
        return run(owner,response,lambda conn,now:rotate_gift_code(conn,owner,gift_id,now))

    @router.get("")
    def history(response: Response,direction: Literal["purchased","received"]="purchased",
                limit: int=20,before_time: datetime|None=None,before_id: UUID|None=None,
                owner=Depends(owner_dependency)):
        return run(owner,response,lambda conn,now:list_gifts(conn,owner,now,
            direction=direction,limit=limit,before_time=before_time,before_id=before_id))
    return router
