"""PostgreSQL integration tests. Never run against a production database.

Run independently from SQLite unit tests, with:
ALLOW_WONDERTALE_PG_INTEGRATION_TESTS=1
PG_TEST_DATABASE_URL=postgresql://... (dedicated WonderTale preview branch ONLY)
pytest -q tests/test_postgres_integration.py

The tests create synthetic parent accounts and remove them in a fixture teardown.
SMTP and text AI stay disabled; no real mail or third-party AI calls occur.
"""
import os
import secrets
import uuid

import pytest

if os.getenv("ALLOW_WONDERTALE_PG_INTEGRATION_TESTS") != "1":
    pytest.skip("PostgreSQL integration tests require explicit opt-in", allow_module_level=True)

url=os.getenv("PG_TEST_DATABASE_URL","")
if not url.startswith(("postgresql://","postgres://")):
    pytest.fail("PG_TEST_DATABASE_URL must reference an explicit PostgreSQL test branch")
if os.getenv("PG_TEST_BRANCH_NAME")!="wondertale-preview":
    pytest.fail("Only the named WonderTale preview branch may be used")
os.environ["DATABASE_URL"]=url
os.environ["APP_ENV"]="preview"
os.environ["AUTH_SECRET"]=secrets.token_urlsafe(48)
os.environ["ENABLE_REGISTRATION"]="true"
os.environ["REQUIRE_EMAIL_VERIFICATION"]="false"
os.environ["ENABLE_TEXT_AI"]="false"

from fastapi.testclient import TestClient
import secure_main

client=TestClient(secure_main.app)
PASSWORD="a-strong-private-password-2026"


@pytest.fixture(scope="module")
def parents():
    """Two distinct synthetic parents; cleanup is limited to exact generated email IDs."""
    suffix=uuid.uuid4().hex
    emails=[f"pg-int-a-{suffix}@example.invalid",f"pg-int-b-{suffix}@example.invalid"]
    tokens=[]
    try:
        for email in emails:
            r=client.post("/api/auth/register",json={"email":email,"password":PASSWORD})
            assert r.status_code==201,r.text
            tokens.append(r.json()["access_token"])
        yield {"emails":emails,"tokens":tokens}
    finally:
        with secure_main.connection() as c:
            for email in emails:
                # Cascading relationships remove sessions, children, favorites and book progress.
                secure_main.sql(c,"DELETE FROM parents WHERE email=?",(email,))
            c.commit()


def bearer(token):
    return {"Authorization":"Bearer "+token}


def test_postgres_health_and_database_ready():
    assert secure_main.IS_PG is True
    assert client.get("/api/ready").status_code==200


def test_isolation_of_parent_books_favorites_progress_and_children(parents):
    a,b=parents["tokens"]
    assert client.get("/api/me",headers=bearer(a)).status_code==200
    assert client.get("/api/me",headers=bearer(b)).status_code==200
    assert client.get("/api/books").status_code==401

    story='{"language":"en","pages":[{"number":1,"text":"A","image_url":""},{"number":2,"text":"B","image_url":""}]}'
    created=client.post("/api/books",headers=bearer(a),json={
        "title":"Postgres test story","child_name":"Little Hero","age":6,"story":story
    })
    assert created.status_code==201,created.text
    book_id=created.json()["id"]

    assert client.get("/api/books/"+book_id,headers=bearer(a)).status_code==200
    assert client.get("/api/books/"+book_id,headers=bearer(b)).status_code==404
    assert client.delete("/api/books/"+book_id,headers=bearer(b)).status_code==404
    assert client.post("/api/books/"+book_id+"/favorite",headers=bearer(b)).status_code==404
    assert client.post("/api/books/"+book_id+"/progress",headers=bearer(b),json={"page":1}).status_code==404
    assert client.get("/api/books/favorites",headers=bearer(b)).json()=={"ids":[]}
    assert client.get("/api/books/progress",headers=bearer(b)).json()==[]

    fav=client.post("/api/books/"+book_id+"/favorite",headers=bearer(a))
    assert fav.status_code==200 and fav.json()["favorite"] is True
    progress=client.post("/api/books/"+book_id+"/progress",headers=bearer(a),json={"page":1})
    assert progress.status_code==200,progress.text
    assert client.post("/api/books/"+book_id+"/progress",headers=bearer(a),json={"page":2}).status_code==422
    assert client.get("/api/books/favorites",headers=bearer(a)).json()=={"ids":[book_id]}
    assert client.get("/api/books/progress",headers=bearer(a)).json()[0]["page"]==1

    child=client.post("/api/children",headers=bearer(a),json={"nickname":"Hero","age":6})
    assert child.status_code==201,child.text
    child_id=child.json()["id"]
    assert client.get("/api/children",headers=bearer(b)).json()==[]
    assert client.delete("/api/children/"+child_id,headers=bearer(b)).status_code==404

    assert client.delete("/api/books/"+book_id,headers=bearer(a)).status_code==204
    assert client.get("/api/books/favorites",headers=bearer(a)).json()=={"ids":[]}
    assert client.get("/api/books/progress",headers=bearer(a)).json()==[]


def test_postgres_book_quota_and_invalid_values(parents,monkeypatch):
    a,b=parents["tokens"]
    monkeypatch.setattr(secure_main,"MAX_BOOKS_PER_PARENT",1)
    body={"title":"Limited book","child_name":"Child","age":6,"story":"A short story"}
    first=client.post("/api/books",headers=bearer(b),json=body)
    assert first.status_code==201,first.text
    assert client.post("/api/books",headers=bearer(b),json=body).status_code==409
    assert client.post("/api/books",headers=bearer(a),json=body).status_code==201
    assert client.post("/api/books",headers=bearer(a),json={**body,"story":" "}).status_code==422


def test_sessions_are_revoked_with_postgresql(parents):
    _,b=parents["tokens"]
    assert client.get("/api/me",headers=bearer(b)).status_code==200
    result=client.post("/api/auth/logout-all",headers=bearer(b))
    assert result.status_code==204,result.text
    assert client.get("/api/me",headers=bearer(b)).status_code==401


def test_registration_stays_fail_closed_without_smtp(monkeypatch):
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","true")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:False)
    new_email=f"pg-denied-{uuid.uuid4().hex}@example.invalid"
    denied=client.post("/api/auth/register",json={"email":new_email,"password":PASSWORD})
    assert denied.status_code==503
    with secure_main.connection() as c:
        assert secure_main.sql(c,"SELECT id FROM parents WHERE email=?",(new_email,)).fetchone() is None
