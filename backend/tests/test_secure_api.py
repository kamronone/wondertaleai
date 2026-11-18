"""Security regression tests: account isolation, token integrity and deletion."""
import importlib
import os
import secrets
import tempfile
from pathlib import Path

os.environ["AUTH_SECRET"]=secrets.token_urlsafe(48)
os.environ["DATABASE_URL"]="sqlite:///"+str(Path(tempfile.mkdtemp())/"wondertale-test.db")
os.environ["CORS_ORIGINS"]="http://localhost:5173"
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
