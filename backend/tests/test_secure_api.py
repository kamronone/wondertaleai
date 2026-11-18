"""Security regression tests: account isolation, token integrity and deletion."""
import importlib
import os
import secrets
import tempfile
from pathlib import Path

os.environ["AUTH_SECRET"]=secrets.token_urlsafe(48)
os.environ["DATABASE_URL"]="sqlite:///"+str(Path(tempfile.mkdtemp())/"wondertale-test.db")
os.environ["CORS_ORIGINS"]="http://localhost:5173"
os.environ["ENABLE_REGISTRATION"]="true"
import secure_main
from fastapi.testclient import TestClient

client=TestClient(secure_main.app)
PASSWORD="testing-strong-password-2026"

def signup(email):
    response=client.post("/api/auth/register",json={"email":email,"password":PASSWORD})
    assert response.status_code==201,response.text
    return response.json()["access_token"]

def headers(token):
    return {"Authorization":"Bearer "+token}

def test_requires_authentication():
    assert client.get("/api/books").status_code==401
    assert client.post("/api/books",json={"title":"x","child_name":"x","age":5,"story":"hi"}).status_code==401
    assert client.get("/api/me",headers=headers("invalid")).status_code==401

def test_parent_isolation_and_revocation():
    a=signup("parent-a@example.com")
    b=signup("parent-b@example.com")
    story={"title":"Звёзды","child_name":"Алия","age":6,"story":"Однажды появилась звезда"}
    result=client.post("/api/books",headers=headers(a),json=story)
    assert result.status_code==201,result.text
    bid=result.json()["id"]
    assert client.get("/api/books/"+bid,headers=headers(a)).status_code==200
    assert client.get("/api/books/"+bid,headers=headers(b)).status_code==404
    assert all(row["id"]!=bid for row in client.get("/api/books",headers=headers(b)).json())
    assert client.delete("/api/books/"+bid,headers=headers(b)).status_code==404
    assert client.get("/api/books/"+bid,headers=headers(a)).status_code==200
    assert client.delete("/api/me",headers=headers(a)).status_code==204
    assert client.get("/api/me",headers=headers(a)).status_code==401
    assert client.get("/api/books/"+bid,headers=headers(b)).status_code==404

def test_login_and_tampered_token():
    token=signup("parent-c@example.com")
    valid=client.post("/api/auth/login",json={"email":"parent-c@example.com","password":PASSWORD})
    assert valid.status_code==200
    assert client.get("/api/me",headers=headers(token)).status_code==200
    tampered=token[:-2]+("ab" if token[-2:]!="ab" else "cd")
    assert client.get("/api/me",headers=headers(tampered)).status_code==401
    assert client.post("/api/auth/login",json={"email":"parent-c@example.com","password":"not-my-password"}).status_code==422


def test_registration_is_disabled_by_default(monkeypatch):
    monkeypatch.setenv("ENABLE_REGISTRATION","false")
    response=client.post("/api/auth/register",json={"email":"disabled@example.com","password":PASSWORD})
    assert response.status_code==503
    monkeypatch.setenv("ENABLE_REGISTRATION","true")

def test_login_rate_limit_and_recovery(monkeypatch):
    token=signup("rate-test@example.com")
    for i in range(5):
        wrong=client.post("/api/auth/login",json={"email":"rate-test@example.com","password":"incorrect-password-2026"})
        assert wrong.status_code==401
    blocked=client.post("/api/auth/login",json={"email":"rate-test@example.com","password":PASSWORD})
    assert blocked.status_code==429
    assert client.get("/api/me",headers=headers(token)).status_code==200
    monkeypatch.setattr(secure_main,"LOGIN_WINDOW_SECONDS",0)
    recovered=client.post("/api/auth/login",json={"email":"rate-test@example.com","password":PASSWORD})
    assert recovered.status_code==200

def test_ai_allowlist_and_global_budget(monkeypatch):
    from ai_generation import GeneratedStory
    import uuid
    allowed="ai-"+str(uuid.uuid4())+"@example.com"
    other="ai-"+str(uuid.uuid4())+"@example.com"
    own=signup(allowed)
    second=signup(other)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-injected-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",allowed)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","2")
    monkeypatch.setattr(secure_main,"generate_story",lambda x:GeneratedStory(title="A gentle magical adventure",language=x.language,pages=["An uplifting adventure with many new friends and lessons in kindness."]*8))
    data={"name":"Amir","age":5,"language":"en","classic_title":"Little Red Riding Hood","idea":"Help a friend in a magical forest"}
    forbidden=client.post("/api/books/generate",headers=headers(second),json=data)
    assert forbidden.status_code==403
    first=client.post("/api/books/generate",headers=headers(own),json=data)
    assert first.status_code==201,first.text
    another=client.post("/api/books/generate",headers=headers(own),json=data)
    assert another.status_code==201,another.text
    exhausted=client.post("/api/books/generate",headers=headers(own),json=data)
    assert exhausted.status_code==429
    assert len(client.get("/api/books",headers=headers(own)).json())==2
    assert client.get("/api/books/"+first.json()["id"],headers=headers(second)).status_code==404
