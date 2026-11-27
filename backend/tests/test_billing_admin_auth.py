import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from billing_analytics_api import build_analytics_router
from billing_promotion_admin_api import build_promotion_admin_router

@pytest.mark.parametrize("identity",[False,None,1,"true",{"admin":True}])
def test_admin_requires_literal_authorization(identity):
    app=FastAPI()
    def admin():
        return identity
    def database():
        pytest.fail("Unauthorized request reached database")
    app.include_router(build_analytics_router(admin,database))
    app.include_router(build_promotion_admin_router(admin,database))
    with TestClient(app) as client:
        assert client.get("/api/billing/admin/analytics/summary",params={
            "start":"2026-11-01T00:00:00Z","end":"2026-11-02T00:00:00Z"}).status_code==403
        assert client.get("/api/billing/admin/promotions").status_code==403
        assert client.post("/api/billing/admin/promotions",json={
            "code":"TEST20","kind":"percent","value":20,"plan_id":"plus",
            "starts_at":"2026-11-01T00:00:00Z","ends_at":"2026-12-01T00:00:00Z",
            "max_uses":1}).status_code==403
        assert client.patch("/api/billing/admin/promotions/TEST20",json={"enabled":True}).status_code==403
