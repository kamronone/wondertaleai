"""Durable AI queue tests with an isolated, mocked provider."""
import importlib
import uuid
import pytest
from fastapi.testclient import TestClient

@pytest.fixture
def api(monkeypatch,tmp_path):
    monkeypatch.setenv("AUTH_SECRET","local-tests-only-"+"x"*48)
    monkeypatch.setenv("DATABASE_URL","sqlite:///"+str(tmp_path/"queue.sqlite"))
    monkeypatch.setenv("APP_ENV","development")
    monkeypatch.setenv("ENABLE_REGISTRATION","true")
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","false")
    monkeypatch.setenv("ENABLE_AI_JOBS","true")
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","mock-only")
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","20")
    import secure_main
    module=importlib.reload(secure_main)
    client=TestClient(module.app)
    def register():
        email="queue-"+uuid.uuid4().hex+"@example.com"
        r=client.post("/api/auth/register",json={"email":email,"password":"strong-local-test-password"})
        assert r.status_code==201,r.text
        return email,{"Authorization":"Bearer "+r.json()["access_token"]}
    return client,module,register

def payload():
    return {"name":"Alex","age":7,"language":"en","idea":"A gentle story about a glowing magical garden"}

def test_queue_ownership_replay_and_worker(api,monkeypatch):
    from ai_generation import GeneratedStory
    client,module,register=api
    email,auth=register()
    _,foreign=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    calls=[]
    def fake(data):
        calls.append(data)
        return GeneratedStory(title="A Friendly Star",language="en",
                              pages=["A friendly star helps all the forest animals learn kindness."]*8)
    monkeypatch.setattr(module,"generate_story",fake)
    key="queue-"+uuid.uuid4().hex
    headers={**auth,"Idempotency-Key":key}
    created=client.post("/api/books/jobs",headers=headers,json=payload())
    assert created.status_code==202,created.text
    job=created.json()
    assert job["status"]=="queued"
    assert client.post("/api/books/jobs",headers=headers,json=payload()).json()==job
    assert client.get("/api/books/jobs/"+job["id"],headers=foreign).status_code==404
    assert client.post("/api/books/jobs",headers=headers,json={**payload(),"idea":"Another original forest story"}).status_code==409
    assert module.process_one_queued_ai_job()==job["id"]
    assert module.process_one_queued_ai_job() is None
    complete=client.get("/api/books/jobs/"+job["id"],headers=auth)
    assert complete.status_code==200
    assert complete.json()["status"]=="completed"
    assert complete.headers["Cache-Control"]=="private, no-store"
    book_id=complete.json()["book_id"]
    assert client.get("/api/books/"+book_id,headers=auth).status_code==200
    assert client.get("/api/books/"+book_id,headers=foreign).status_code==404
    assert len(calls)==1
    assert client.get("/api/billing/status",headers=auth).json()["ai_used_today"]==1
    assert client.delete("/api/books/"+book_id,headers=auth).status_code==204
    assert client.get("/api/books/jobs/"+job["id"],headers=auth).json()["status"]=="unavailable"


def test_queue_is_bounded_and_denies_anonymous_users(api,monkeypatch):
    client,module,register=api
    email,auth=register()
    _,other=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    body=payload()
    assert client.post("/api/books/jobs",json=body).status_code==401
    assert client.post("/api/books/jobs",headers={**other,"Idempotency-Key":"x"*32},json=body).status_code==403
    assert client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":"bad"},json=body).status_code==422
    for _ in range(2):
        r=client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":uuid.uuid4().hex},json=body)
        assert r.status_code==202,r.text
    assert client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":uuid.uuid4().hex},json=body).status_code==429
    assert client.get("/api/billing/status",headers=auth).json()["ai_used_today"]==0

def test_worker_failure_is_not_retried(api,monkeypatch):
    client,module,register=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    calls=[]
    def failing(_data):
        calls.append(1)
        raise RuntimeError("Mocked unavailable model")
    monkeypatch.setattr(module,"generate_story",failing)
    queued=client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":uuid.uuid4().hex},json=payload())
    assert queued.status_code==202
    job_id=queued.json()["id"]
    assert module.process_one_queued_ai_job()==job_id
    assert module.process_one_queued_ai_job() is None
    assert client.get("/api/books/jobs/"+job_id,headers=auth).json()["status"]=="failed"
    assert len(calls)==1
    assert client.get("/api/books",headers=auth).json()==[]


def test_stalled_worker_needs_review_without_another_request(api,monkeypatch):
    from datetime import datetime,timedelta,timezone
    client,module,register=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    queued=client.post("/api/books/jobs",headers={**auth,"Idempotency-Key":uuid.uuid4().hex},json=payload())
    assert queued.status_code==202
    job_id=queued.json()["id"]
    with module.connection() as c:
        started=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat()
        module.sql(c,"UPDATE ai_jobs SET status='processing',started_at=? WHERE id=?",(started,job_id))
        c.commit()
    assert client.get("/api/books/jobs/"+job_id,headers=auth).json()["status"]=="needs_review"
    assert module.process_one_queued_ai_job() is None
