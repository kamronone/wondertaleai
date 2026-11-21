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
    emails=[f"pg-int-a-{suffix}@example.com",f"pg-int-b-{suffix}@example.com"]
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
    new_email=f"pg-denied-{uuid.uuid4().hex}@example.com"
    denied=client.post("/api/auth/register",json={"email":new_email,"password":PASSWORD})
    assert denied.status_code==503
    with secure_main.connection() as c:
        assert secure_main.sql(c,"SELECT id FROM parents WHERE email=?",(new_email,)).fetchone() is None


def test_postgres_email_verification_and_password_recovery(monkeypatch):
    """Real token rows and session revocation in PostgreSQL; fake SMTP only."""
    new_email=f"pg-email-{uuid.uuid4().hex}@example.com"
    sent=[]
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","true")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:True)
    monkeypatch.setattr(secure_main,"send_account_email",lambda to,token,kind:sent.append((to,token,kind)))
    try:
        reg=client.post("/api/auth/register",json={"email":new_email,"password":PASSWORD})
        assert reg.status_code==201,reg.text
        assert reg.json()=={"status":"verification_sent"}
        assert len(sent)==1 and sent[0][2]=="verify"
        assert client.post("/api/auth/login",json={"email":new_email,"password":PASSWORD}).status_code==403
        verified=client.post("/api/auth/verify-email",json={"token":sent[0][1]})
        assert verified.status_code==200,verified.text
        assert client.post("/api/auth/verify-email",json={"token":sent[0][1]}).status_code==400
        logged=client.post("/api/auth/login",json={"email":new_email,"password":PASSWORD})
        assert logged.status_code==200,logged.text
        bearer_token=logged.json()["access_token"]
        assert client.get("/api/me",headers=bearer(bearer_token)).status_code==200
        forgotten=client.post("/api/auth/forgot-password",json={"email":new_email})
        assert forgotten.status_code==200,forgotten.text
        assert len(sent)==2 and sent[1][2]=="recover"
        new_password="pg-test-new-password-2026"
        changed=client.post("/api/auth/reset-password",json={"token":sent[1][1],"new_password":new_password})
        assert changed.status_code==200,changed.text
        assert client.post("/api/auth/reset-password",json={"token":sent[1][1],"new_password":new_password}).status_code==400
        assert client.get("/api/me",headers=bearer(bearer_token)).status_code==401
        assert client.post("/api/auth/login",json={"email":new_email,"password":new_password}).status_code==200
    finally:
        with secure_main.connection() as c:
            secure_main.sql(c,"DELETE FROM parents WHERE email=?",(new_email,))
            c.commit()


def test_postgres_concurrent_book_writes_obey_quota(monkeypatch):
    """The parent row lock serializes two inserts, so only one can pass quota=1."""
    from concurrent.futures import ThreadPoolExecutor
    new_email=f"pg-concurrent-{uuid.uuid4().hex}@example.com"
    monkeypatch.setattr(secure_main,"MAX_BOOKS_PER_PARENT",1)
    registration=client.post("/api/auth/register",json={"email":new_email,"password":PASSWORD})
    assert registration.status_code==201,registration.text
    token=registration.json()["access_token"]
    def create(index):
        return client.post("/api/books",headers=bearer(token),json={
            "title":f"Concurrent {index}","child_name":"Test child","age":6,"story":"A private test story"
        }).status_code
    try:
        with ThreadPoolExecutor(max_workers=2) as pool:
            codes=list(pool.map(create,[1,2]))
        assert sorted(codes)==[201,409],codes
        library=client.get("/api/books",headers=bearer(token))
        assert library.status_code==200
        assert len(library.json())==1
    finally:
        with secure_main.connection() as c:
            secure_main.sql(c,"DELETE FROM parents WHERE email=?",(new_email,))
            c.commit()


def test_postgres_ai_queue_claims_distinct_jobs_with_two_workers(monkeypatch):
    """Two workers cannot claim the same queued request; no provider network."""
    from concurrent.futures import ThreadPoolExecutor
    from ai_generation import GeneratedStory
    email=f"pg-queue-{uuid.uuid4().hex}@example.com"
    reg=client.post("/api/auth/register",json={"email":email,"password":PASSWORD})
    assert reg.status_code==201,reg.text
    auth=bearer(reg.json()["access_token"])
    monkeypatch.setenv("ENABLE_AI_JOBS","true")
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","isolated-mock-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    generated=[]
    def fake_model(body):
        generated.append(body.idea)
        return GeneratedStory(
            title="A Friendly Moon",language="en",
            pages=["A gentle magical story teaches friends to help each other."]*8
        )
    monkeypatch.setattr(secure_main,"generate_story",fake_model)
    try:
        ids=[]
        for n in range(2):
            result=client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":"job"+uuid.uuid4().hex},json={
                "name":"Alex","age":7,"language":"en",
                "idea":f"The magical forest adventure number {n} welcomes new friends"
            })
            assert result.status_code==202,result.text
            ids.append(result.json()["id"])
        with ThreadPoolExecutor(max_workers=2) as pool:
            processed=list(pool.map(lambda _:secure_main.process_one_queued_ai_job(),range(2)))
        assert sorted(processed)==sorted(ids)
        assert len(generated)==2
        assert client.get("/api/ai/jobs",headers=auth).status_code==200
        assert len(client.get("/api/books",headers=auth).json())==2
        assert all(client.get("/api/books/jobs/"+job_id,headers=auth).json()["status"]=="completed" for job_id in ids)
        assert secure_main.process_one_queued_ai_job() is None
    finally:
        with secure_main.connection() as c:
            secure_main.sql(c,"DELETE FROM parents WHERE email=?",(email,))
            c.commit()
