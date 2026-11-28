from contextlib import contextmanager
from fastapi import FastAPI, Header
from fastapi.testclient import TestClient
import billing_gift_api as gifts

def test_gift_rate_limit_and_privacy(monkeypatch):
    calls=[]
    class Connection:
        @contextmanager
        def transaction(self):
            yield
    @contextmanager
    def database():
        yield Connection()
    def owner(x_test_owner: str=Header()):
        return x_test_owner
    def redeem(conn,owner,code,now):
        calls.append(owner)
        return {"ok":True}
    monkeypatch.setattr(gifts,"redeem_gift",redeem)
    clock=[100.0]
    monkeypatch.setattr(gifts,"monotonic",lambda:clock[0])
    app=FastAPI()
    app.include_router(gifts.build_gift_router(owner,database))
    with TestClient(app) as client:
        def send(owner,code="a"*43):
            return client.post("/api/billing/gifts/redeem",headers={"X-Test-Owner":owner},json={"code":code})
        for _ in range(10):
            assert send("alice").status_code==200
        blocked=send("alice")
        assert blocked.status_code==429
        assert blocked.headers["Retry-After"]=="60"
        assert calls==["alice"]*10
        assert send("bob").status_code==200
        invalid=send("bob","private-invalid-code")
        assert invalid.status_code==422
        assert "private-invalid-code" not in invalid.text
        assert invalid.headers["Cache-Control"]=="no-store"
        clock[0]+=60
        assert send("alice").status_code==200
