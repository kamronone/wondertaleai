"""Private illustration media tests: no network, no image model, no real accounts."""
import importlib
import io
import json
import uuid

import pytest
from fastapi.testclient import TestClient
from PIL import Image,PngImagePlugin


@pytest.fixture
def api(tmp_path,monkeypatch):
    monkeypatch.setenv("AUTH_SECRET","unit-private-media-"+("x"*42))
    monkeypatch.setenv("DATABASE_URL","sqlite:///"+str(tmp_path/"media.sqlite"))
    monkeypatch.setenv("APP_ENV","development")
    monkeypatch.setenv("ENABLE_REGISTRATION","true")
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","false")
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS","true")
    import secure_main
    api_module=importlib.reload(secure_main)
    client=TestClient(api_module.app)
    def register():
        email="media-"+uuid.uuid4().hex+"@example.com"
        result=client.post("/api/auth/register",json={"email":email,"password":"private-media-test-password-2026"})
        assert result.status_code==201,result.text
        auth={"Authorization":"Bearer "+result.json()["access_token"]}
        consent=client.post("/api/illustrations/consent",headers=auth,
            json={"agreed":True,"policy_version":"illustration-pilot-v1"})
        assert consent.status_code==200,consent.text
        return email,auth
    def create_book(auth):
        result=client.post("/api/books",headers=auth,json={
            "title":"Friendly moon","child_name":"Alex","age":7,
            "story":json.dumps({"pages":[{"number":1,"text":"A gentle fox walks through a colorful garden."}]})
        })
        assert result.status_code==201,result.text
        return result.json()["id"]
    return client,api_module,register,create_book


def fake_png():
    metadata=PngImagePlugin.PngInfo()
    metadata.add_text("Comment","SECRET-METADATA-NEVER-KEEP")
    image=Image.new("RGB",(96,96),(60,160,200))
    buffer=io.BytesIO()
    image.save(buffer,format="PNG",pnginfo=metadata)
    return buffer.getvalue()


def test_media_owner_access_integrity_and_delete_cascade(api,monkeypatch):
    client,module,register,create_book=api
    email,auth=register()
    _,other=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book_id=create_book(auth)
    job=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book_id,"page_number":1,"style":"watercolor"
    })
    assert job.status_code==202,job.text
    job_id=job.json()["id"]
    route="/api/illustrations/media/"+job_id
    lookup="/api/illustrations/books/"+book_id+"/pages/1"
    assert client.get(lookup).status_code==401
    assert client.get(lookup,headers=other).status_code==404
    assert client.get(lookup,headers=auth).status_code==404
    assert client.get(route).status_code==401
    assert client.get(route,headers=other).status_code==404
    assert client.get(route,headers=auth).status_code==404
    with pytest.raises(ValueError):
        module.save_private_illustration_asset(job_id,fake_png())
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_jobs SET status='processing' WHERE id=?",(job_id,))
        c.commit()
    digest=module.save_private_illustration_asset(job_id,fake_png())
    assert len(digest)==64
    resolved=client.get(lookup,headers=auth)
    assert resolved.status_code==200,resolved.text
    assert resolved.json()=={"job_id":job_id}
    assert resolved.headers["Cache-Control"]=="private, no-store"
    assert client.get(lookup,headers=other).status_code==404
    assert client.get("/api/illustrations/books/"+book_id+"/pages/20",headers=auth).status_code==404
    response=client.get(route,headers=auth)
    assert response.status_code==200,response.text
    assert response.headers["content-type"]=="image/png"
    assert response.headers["cache-control"]=="private, no-store"
    assert response.headers["x-content-type-options"]=="nosniff"
    assert b"SECRET-METADATA-NEVER-KEEP" not in response.content
    assert client.get(route,headers=other).status_code==404
    assert len(client.get("/api/illustrations/jobs",headers=auth).json())==1
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="completed"
    with pytest.raises(ValueError):
        module.save_private_illustration_asset(job_id,fake_png())
    assert client.delete("/api/books/"+book_id,headers=auth).status_code==204
    assert client.get(route,headers=auth).status_code==404
    assert client.get(lookup,headers=auth).status_code==404
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_assets WHERE job_id=?",(job_id,)).fetchone()[0]==0


def test_image_validation_rejects_unsafe_inputs():
    from private_illustration_media import normalize_private_illustration
    for payload in (b"",b"not an image",b"x"*3_000_001):
        with pytest.raises(ValueError):
            normalize_private_illustration(payload)
    oversized=Image.new("RGB",(2050,65),"white")
    buffer=io.BytesIO()
    oversized.save(buffer,format="PNG")
    with pytest.raises(ValueError):
        normalize_private_illustration(buffer.getvalue())


def test_deleted_parent_cascades_private_media(api,monkeypatch):
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book=create_book(auth)
    job=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"storybook"
    })
    assert job.status_code==202,job.text
    job_id=job.json()["id"]
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_jobs SET status='processing' WHERE id=?",(job_id,))
        c.commit()
    module.save_private_illustration_asset(job_id,fake_png())
    assert client.delete("/api/me",headers=auth).status_code==204
    assert client.get("/api/illustrations/media/"+job_id,headers=auth).status_code==401
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_assets WHERE job_id=?",(job_id,)).fetchone()[0]==0


def test_mock_worker_completes_one_image_and_enforces_daily_quota(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book_id=create_book(auth)
    jobs=[]
    for style in ("watercolor","storybook"):
        response=client.post("/api/illustrations/jobs",headers=auth,json={
            "book_id":book_id,"page_number":1,"style":style
        })
        assert response.status_code==202,response.text
        jobs.append(response.json()["id"])
    calls=[]
    def renderer(prompt):
        calls.append(prompt)
        return fake_png()
    checks=[]
    def check_png(data):
        checks.append(data)
        return data[:4] == bytes((137,80,78,71))
    first=process_one_illustration_job(
        renderer=renderer,moderator=lambda prompt: "no identifying information" in prompt,
        image_moderator=check_png
    )
    assert first==jobs[0]
    completed=client.get("/api/illustrations/jobs",headers=auth).json()
    assert next(j for j in completed if j["id"]==jobs[0])["status"]=="completed"
    assert len(calls)==1 and len(checks)==1
    assert "Alex" not in calls[0]
    assert process_one_illustration_job(
        renderer=renderer,moderator=lambda _:True,image_moderator=lambda _:True
    )==jobs[1]
    assert len(calls)==1
    assert next(j for j in client.get("/api/illustrations/jobs",headers=auth).json() if j["id"]==jobs[1])["status"]=="failed"
    with module.connection() as c:
        today=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).date().isoformat()
        assert module.sql(c,"SELECT used FROM illustration_daily_quota WHERE day=?",(today,)).fetchone()[0]==1
        assert module.sql(c,"SELECT used FROM illustration_parent_quota WHERE day=?",(today,)).fetchone()[0]==1


def test_mock_worker_rejects_unmoderated_image_and_never_retries(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","3")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","3")
    book_id=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book_id,"page_number":1,"style":"pencil"
    })
    assert queued.status_code==202
    called=[]
    def renderer(prompt):
        called.append(prompt)
        return fake_png()
    worker=lambda:process_one_illustration_job(renderer=renderer,
        moderator=lambda _:True,image_moderator=lambda _:False)
    assert worker()==queued.json()["id"]
    assert worker() is None
    assert len(called)==1
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="failed"
    assert client.get("/api/illustrations/media/"+queued.json()["id"],headers=auth).status_code==404


def test_worker_disabled_and_moderation_fail_closed(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book_id=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book_id,"page_number":1,"style":"watercolor"
    })
    assert queued.status_code==202
    with pytest.raises(RuntimeError,match="worker disabled"):
        process_one_illustration_job(renderer=lambda _:fake_png(),
            moderator=lambda _:True,image_moderator=lambda _:True)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    with pytest.raises(ValueError):
        process_one_illustration_job(renderer=lambda _:fake_png(),
            moderator=lambda _:True,image_moderator=None)
    called=[]
    result=process_one_illustration_job(renderer=lambda _:called.append(1),
        moderator=lambda _:False,image_moderator=lambda _:True)
    assert result==queued.json()["id"]
    assert not called
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="failed"


def test_approved_runner_end_to_end_with_mock_image_and_moderation(api,monkeypatch):
    import base64
    from types import SimpleNamespace
    from approved_illustration_runner import run_one_approved_illustration
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("APP_ENV","preview")
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("ENABLE_OPENAI_IMAGE_PROVIDER","true")
    monkeypatch.setenv("ENABLE_OPENAI_IMAGE_MODERATION","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book=create_book(auth)
    created=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"storybook"
    })
    assert created.status_code==202,created.text
    job=created.json()["id"]
    class ImageClient:
        def __init__(self):self.calls=0
        def generate(self,**kwargs):
            self.calls+=1
            return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(fake_png()).decode())])
    class ModerationClient:
        def __init__(self,deny_image=False):
            self.calls=[]
            self.deny_image=deny_image
        def create(self,**kwargs):
            self.calls.append(kwargs)
            flagged=self.deny_image and kwargs["input"][0]["type"]=="image_url"
            return SimpleNamespace(results=[SimpleNamespace(flagged=flagged,categories={
                "violence":flagged,"sexual":False
            })])
    images=ImageClient()
    moderation=ModerationClient()
    completed=run_one_approved_illustration(
        image_client=SimpleNamespace(images=images),
        moderation_client=SimpleNamespace(moderations=moderation)
    )
    assert completed==job
    assert images.calls==1
    assert [req["input"][0]["type"] for req in moderation.calls]==["text","image_url"]
    assert client.get("/api/illustrations/media/"+job,headers=auth).status_code==200
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="completed"


def test_approved_runner_rejects_mock_flagged_output_without_saving(api,monkeypatch):
    import base64
    from types import SimpleNamespace
    from approved_illustration_runner import run_one_approved_illustration
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("APP_ENV","preview")
    for name in ("ENABLE_AI_ILLUSTRATIONS_WORKER","ENABLE_OPENAI_IMAGE_PROVIDER","ENABLE_OPENAI_IMAGE_MODERATION"):
        monkeypatch.setenv(name,"true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book=create_book(auth)
    created=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"pencil"
    })
    assert created.status_code==202
    job=created.json()["id"]
    class Images:
        def generate(self,**kwargs):
            return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(fake_png()).decode())])
    class Moderations:
        def create(self,**kwargs):
            flagged=kwargs["input"][0]["type"]=="image_url"
            return SimpleNamespace(results=[SimpleNamespace(
                flagged=flagged,categories={"violence":flagged,"sexual":False})])
    result=run_one_approved_illustration(
        image_client=SimpleNamespace(images=Images()),
        moderation_client=SimpleNamespace(moderations=Moderations())
    )
    assert result==job
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="failed"
    assert client.get("/api/illustrations/media/"+job,headers=auth).status_code==404



def test_illustration_kill_switch_blocks_new_claims(api,monkeypatch):
    from illustration_worker import process_one_illustration_job,illustration_attempt_snapshot
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"watercolor"
    })
    assert queued.status_code==202
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_runtime_control SET paused=1 WHERE singleton=1")
        c.commit()
    called=[]
    with pytest.raises(RuntimeError,match="emergency stop"):
        process_one_illustration_job(renderer=lambda _:called.append(1),
            moderator=lambda _:True,image_moderator=lambda _:True)
    assert not called
    snap=illustration_attempt_snapshot()
    assert snap["paused"] is True
    assert snap["reserved_attempts_today"]==0
    assert snap["job_counts"]["queued"]==1
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="queued"
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_runtime_control SET paused=0 WHERE singleton=1")
        c.commit()
    monkeypatch.setenv("ILLUSTRATION_EMERGENCY_STOP","true")
    with pytest.raises(RuntimeError,match="emergency stop"):
        process_one_illustration_job(renderer=lambda _:called.append(1),
            moderator=lambda _:True,image_moderator=lambda _:True)
    assert not called


def test_illustration_kill_switch_interrupts_after_prompt_review(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"storybook"
    })
    assert queued.status_code==202
    job=queued.json()["id"]
    def pause_during_moderation(_prompt):
        with module.connection() as c:
            module.sql(c,"UPDATE illustration_runtime_control SET paused=1 WHERE singleton=1")
            c.commit()
        return True
    calls=[]
    processed=process_one_illustration_job(renderer=lambda _:calls.append(1),
        moderator=pause_during_moderation,image_moderator=lambda _:True)
    assert processed==job
    assert not calls
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="needs_review"
    assert client.get("/api/illustrations/media/"+job,headers=auth).status_code==404



def test_illustration_audit_tracks_lifecycle_without_personal_data(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","1")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","1")
    book=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"watercolor"
    })
    assert queued.status_code==202,queued.text
    job=queued.json()["id"]
    assert process_one_illustration_job(renderer=lambda _:fake_png(),
        moderator=lambda _:True,image_moderator=lambda _:True)==job
    with module.connection() as c:
        rows=module.sql(c,"SELECT event FROM illustration_job_events WHERE job_id=? ORDER BY created_at,id",(job,)).fetchall()
    # Exact order is a lifecycle contract, not a per-process print log.
    assert sorted(event[0] for event in rows)==["completed","processing","queued"]
    assert client.delete("/api/books/"+book,headers=auth).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_job_events WHERE job_id=?",(job,)).fetchone()[0]==0


def test_read_only_reconciliation_reports_stalled_job_without_retry(api,monkeypatch):
    from datetime import datetime,timedelta,timezone
    from illustration_reconciliation import unresolved_illustration_report
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book=create_book(auth)
    queued=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"pencil"
    })
    assert queued.status_code==202,queued.text
    job=queued.json()["id"]
    old=(datetime.now(timezone.utc)-timedelta(minutes=9)).isoformat()
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_jobs SET status='processing',started_at=? WHERE id=?",(old,job))
        c.commit()
    report=unresolved_illustration_report(older_than_seconds=180)
    assert len(report["unresolved"])==1
    assert report["unresolved"][0]["job_id"]==job
    assert report["unresolved"][0]["status"]=="needs_review"
    assert report["unresolved"][0]["age_seconds"]>=180
    assert "example.com" not in str(report)
    assert "Alex" not in str(report)
    assert "Friendly moon" not in str(report)
    assert report["attempts"]["reserved_attempts_today"]==0
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="processing"
    monkeypatch.setenv("APP_ENV","production")
    with pytest.raises(RuntimeError,match="refuse production"):
        unresolved_illustration_report()


def test_immutable_manual_billing_review_preserves_job_and_quota(api,monkeypatch):
    import hashlib
    from illustration_billing_reconciliation import record_verified_charge,billing_review_snapshot
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book=create_book(auth)
    created=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"watercolor"
    })
    assert created.status_code==202
    job=created.json()["id"]
    digest=hashlib.sha256(b"fake external billing evidence").hexdigest()
    monkeypatch.setenv("ENABLE_ILLUSTRATION_BILLING_RECONCILIATION","false")
    with pytest.raises(RuntimeError,match="disabled"):
        record_verified_charge(job_id=job,charge_status="charged",amount_micro_usd=1234,evidence_sha256=digest)
    monkeypatch.setenv("ENABLE_ILLUSTRATION_BILLING_RECONCILIATION","true")
    with pytest.raises(ValueError,match="terminal"):
        record_verified_charge(job_id=job,charge_status="charged",amount_micro_usd=1234,evidence_sha256=digest)
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_jobs SET status='needs_review' WHERE id=?",(job,))
        c.commit()
    expected={"job_id":job,"charge_status":"charged","amount_micro_usd":1234}
    result=record_verified_charge(job_id=job,charge_status="charged",amount_micro_usd=1234,evidence_sha256=digest)
    assert result==expected
    with pytest.raises(ValueError,match="already been reconciled"):
        record_verified_charge(job_id=job,charge_status="not_charged",amount_micro_usd=0,evidence_sha256=digest)
    summary=billing_review_snapshot()
    assert summary["confirmed_micro_usd"]==1234
    assert summary["reviewed_counts"]=={"charged":1}
    assert client.get("/api/illustrations/jobs",headers=auth).json()[0]["status"]=="needs_review"
    assert "evidence" not in str(summary)
    assert client.delete("/api/books/"+book,headers=auth).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_billing_reviews WHERE job_id=?",(job,)).fetchone()[0]==0


def test_manual_charge_review_validation_and_production_gate(api,monkeypatch):
    from illustration_billing_reconciliation import record_verified_charge
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_ILLUSTRATION_BILLING_RECONCILIATION","true")
    book=create_book(auth)
    created=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"pencil"
    })
    assert created.status_code==202
    job=created.json()["id"]
    with module.connection() as c:
        module.sql(c,"UPDATE illustration_jobs SET status='failed' WHERE id=?",(job,))
        c.commit()
    import hashlib
    digest=hashlib.sha256(b"review evidence").hexdigest()
    bad=[
        ("charged",None,digest),
        ("charged",0,digest),
        ("unknown",100,digest),
        ("not_charged",1,digest),
        ("charged",True,digest),
        ("charged",100,"not-a-digest"),
    ]
    for status,amount,evidence in bad:
        with pytest.raises(ValueError):
            record_verified_charge(job_id=job,charge_status=status,
                                   amount_micro_usd=amount,evidence_sha256=evidence)
    monkeypatch.setenv("APP_ENV","production")
    with pytest.raises(RuntimeError,match="refuses production"):
        record_verified_charge(job_id=job,charge_status="not_charged",
                               amount_micro_usd=0,evidence_sha256=digest)
    monkeypatch.setenv("APP_ENV","development")
    saved=record_verified_charge(job_id=job,charge_status="not_charged",
                                 amount_micro_usd=0,evidence_sha256=digest)
    assert saved["amount_micro_usd"]==0


def test_parent_consent_revocation_blocks_new_jobs_and_clears_queued(api,monkeypatch):
    client,module,register,create_book=api
    email,auth=register()
    _,other=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book=create_book(auth)
    data={"book_id":book,"page_number":1,"style":"storybook"}
    assert client.get("/api/illustrations/consent").status_code==401
    assert client.get("/api/illustrations/consent",headers=auth).json()=={
        "agreed":True,"policy_version":"illustration-pilot-v1"}
    assert client.post("/api/illustrations/consent",headers=auth,json={
        "agreed":True,"policy_version":"illustration-pilot-v0"
    }).status_code==422
    first=client.post("/api/illustrations/jobs",headers=auth,json=data)
    assert first.status_code==202,first.text
    assert client.get("/api/illustrations/jobs",headers=other).json()==[]
    revoked=client.post("/api/illustrations/consent",headers=auth,json={
        "agreed":False,"policy_version":"illustration-pilot-v1"
    })
    assert revoked.status_code==200,revoked.text
    assert revoked.json()["agreed"] is False
    assert client.get("/api/illustrations/consent",headers=auth).json()["agreed"] is False
    assert client.get("/api/illustrations/jobs",headers=auth).json()==[]
    assert client.post("/api/illustrations/jobs",headers=auth,json=data).status_code==403
    restored=client.post("/api/illustrations/consent",headers=auth,json={
        "agreed":True,"policy_version":"illustration-pilot-v1"
    })
    assert restored.status_code==200
    second=client.post("/api/illustrations/jobs",headers=auth,json=data)
    assert second.status_code==202
    assert second.json()["id"]!=first.json()["id"]
    assert client.delete("/api/me",headers=auth).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_parent_consent WHERE owner_id NOT IN (SELECT id FROM parents)").fetchone()[0]==0


def test_revoking_consent_during_moderation_never_calls_renderer(api,monkeypatch):
    from illustration_worker import process_one_illustration_job
    client,module,register,create_book=api
    email,auth=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","2")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","2")
    book=create_book(auth)
    job=client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"pencil"
    }).json()["id"]
    def revoke(_prompt):
        response=client.post("/api/illustrations/consent",headers=auth,json={
            "agreed":False,"policy_version":"illustration-pilot-v1"})
        assert response.status_code==200
        return True
    called=[]
    assert process_one_illustration_job(renderer=lambda _:called.append(1),
        moderator=revoke,image_moderator=lambda _:True)==job
    assert called==[]
    current=client.get("/api/illustrations/jobs",headers=auth).json()
    assert current[0]["status"]=="needs_review"
    assert client.get("/api/illustrations/media/"+job,headers=auth).status_code==404
    assert client.post("/api/illustrations/jobs",headers=auth,json={
        "book_id":book,"page_number":1,"style":"watercolor"
    }).status_code==403
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM illustration_assets WHERE job_id=?",(job,)).fetchone()[0]==0


def test_full_twenty_page_book_private_png_roundtrip_after_login(api,monkeypatch):
    """20 illustrated chapters, two simulated quota days, logout/login, isolation.

    Uses real API and DB paths with an in-memory deterministic renderer.
    No image provider or external accounts are contacted.
    """
    from datetime import datetime,timedelta,timezone
    import illustration_worker as worker

    client,module,register,_=api
    # Earlier tests can reload secure_main; bind the worker to this test DB.
    monkeypatch.setattr(worker,"db",module)
    email,auth=register()
    _,other=register()
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("MAX_ILLUSTRATIONS_PER_DAY","10")
    monkeypatch.setenv("MAX_PARENT_ILLUSTRATIONS_PER_DAY","10")

    secret="PrivateChildIdentityMustNeverReachRenderer"
    pages=[
        {"number":i+1,"text":(
            "Our friends discovered a secret map in a hollow tree. "
            if i==2 else "Finally the travelers returned home at sunrise. "
            if i==19 else f"Chapter {i+1}: The forest friends learned something new. "
        )+secret,"image_url":""}
        for i in range(20)
    ]
    made=client.post("/api/books",headers=auth,json={
        "title":"Twenty chapters and twenty illustrations","child_name":secret,
        "age":7,"story":json.dumps({"version":1,"language":"en","pages":pages})
    })
    assert made.status_code==201,made.text
    book_id=made.json()["id"]
    assert client.get("/api/illustrations/consent",headers=auth).json()["agreed"] is True
    with module.connection() as check:
        parents=module.sql(check,"SELECT id,email FROM parents WHERE email=?",(email,)).fetchall()
        assert len(parents)==1
        assert module.illustration_consent_active(parents[0][0],check)
        assert module.sql(check,"SELECT id FROM books WHERE id=? AND owner_id=?",
                          (book_id,parents[0][0])).fetchone() is not None
    assert worker._cap("MAX_ILLUSTRATIONS_PER_DAY")==10
    assert worker._cap("MAX_PARENT_ILLUSTRATIONS_PER_DAY")==10

    class TestClock(datetime):
        day_offset=0
        @classmethod
        def now(cls,tz=None):
            return datetime.now(tz)+timedelta(days=cls.day_offset)

    monkeypatch.setattr(worker,"datetime",TestClock)
    prompts=[]
    jobs=[]
    def renderer(prompt):
        assert secret not in prompt
        assert book_id not in prompt
        assert email not in prompt
        prompts.append(prompt)
        idx=len(prompts)
        output=io.BytesIO()
        Image.new("RGB",(96,96),(idx*11%255,idx*7%255,idx*13%255)).save(output,format="PNG")
        return output.getvalue()

    for page in range(1,21):
        if page==11:
            TestClock.day_offset=1
        queued=client.post("/api/illustrations/jobs",headers=auth,json={
            "book_id":book_id,"page_number":page,"style":"storybook"
        })
        assert queued.status_code==202,queued.text
        job=queued.json()["id"]
        jobs.append(job)
        completed=worker.process_one_illustration_job(
            renderer=renderer,
            moderator=lambda prompt:"no identifying information" in prompt and secret not in prompt,
            image_moderator=lambda binary:binary.startswith(bytes((137,80,78,71,13,10,26,10)))
        )
        assert completed==job
        details=client.get(f"/api/illustrations/books/{book_id}/pages/{page}",headers=auth)
        assert details.status_code==200,(page,details.text)
        assert details.json()=={"job_id":job}
        assert client.get(f"/api/illustrations/books/{book_id}/pages/{page}",headers=other).status_code==404
        assert client.get(f"/api/illustrations/media/{job}",headers=other).status_code==404

    assert len(set(prompts))==20
    assert len(jobs)==20
    assert len(set(jobs))==20
    assert all(secret not in prompt for prompt in prompts)
    assert worker.process_one_illustration_job(
        renderer=renderer,moderator=lambda _:True,image_moderator=lambda _:True
    ) is None

    assert client.post("/api/auth/logout",headers=auth).status_code==204
    assert client.get(f"/api/illustrations/media/{jobs[0]}",headers=auth).status_code==401
    again=client.post("/api/auth/login",json={
        "email":email,"password":"private-media-test-password-2026"
    })
    assert again.status_code==200,again.text
    new_auth={"Authorization":"Bearer "+again.json()["access_token"]}
    library=client.get("/api/books",headers=new_auth)
    assert library.status_code==200
    assert any(row["id"]==book_id for row in library.json())

    digests=[]
    for page,job in enumerate(jobs,start=1):
        lookup=client.get(f"/api/illustrations/books/{book_id}/pages/{page}",headers=new_auth)
        assert lookup.status_code==200
        assert lookup.json()["job_id"]==job
        media=client.get(f"/api/illustrations/media/{job}",headers=new_auth)
        assert media.status_code==200
        assert media.headers["content-type"]=="image/png"
        assert media.headers["cache-control"]=="private, no-store"
        assert media.content.startswith(bytes((137,80,78,71,13,10,26,10)))
        digests.append(__import__("hashlib").sha256(media.content).hexdigest())
    assert len(set(digests))==20
    assert client.get(f"/api/illustrations/media/{jobs[0]}",headers=other).status_code==404


def test_photo_reference_normalizer_is_safe_but_not_publicly_exposed():
    """Run core reference-photo safety assertions in the existing backend CI suite."""
    from private_photo_reference import normalize_private_reference_photo
    marker="CHILD_GPS_SECRET_NEVER_KEEP"
    metadata=PngImagePlugin.PngInfo()
    metadata.add_text("Comment",marker)
    src=io.BytesIO()
    Image.new("RGB",(112,160),(80,150,230)).save(src,format="PNG",pnginfo=metadata)
    result=normalize_private_reference_photo(src.getvalue())
    assert result.startswith(bytes((255,216,255)))
    assert marker.encode() not in result
    with Image.open(io.BytesIO(result)) as clean:
        assert clean.size==(112,160)
        assert clean.getexif()=={}
    with pytest.raises(ValueError):
        normalize_private_reference_photo(b"invalid upload")
    from pathlib import Path
    routes=Path(__file__).with_name("secure_main.py").read_text()
    assert 'normalize_private_reference_photo' in routes
    assert 'APP_ENV=="development"' in routes
    assert '/api/photos/upload' not in routes
    assert 'ENABLE_DEV_PHOTO_UPLOAD' in routes
    assert 'APP_ENV=="development"' in routes


def test_photo_consent_is_separate_explicit_and_owner_scoped(api):
    client,module,register,_=api
    _,alice=register()
    _,bob=register()
    path="/api/photos/consent"
    expected="photo-reference-v1"

    assert client.get(path).status_code==401
    assert client.post(path,json={"agreed":True,"policy_version":expected}).status_code==401
    assert client.get(path,headers=alice).json()=={
        "agreed":False,"policy_version":expected,"photo_upload_enabled":False
    }
    assert client.get(path,headers=bob).json()["agreed"] is False
    assert client.post(path,headers=alice,json={
        "agreed":True,"policy_version":"obsolete-policy"
    }).status_code==422
    accepted=client.post(path,headers=alice,json={
        "agreed":True,"policy_version":expected
    })
    assert accepted.status_code==200,accepted.text
    assert accepted.json()["photo_upload_enabled"] is False
    assert client.get(path,headers=alice).json()["agreed"] is True
    assert client.get(path,headers=bob).json()["agreed"] is False
    # Photo consent cannot silently opt anyone into AI illustration consent.
    assert client.get("/api/illustrations/consent",headers=bob).json()["agreed"] is True
    revoked=client.post(path,headers=alice,json={
        "agreed":False,"policy_version":expected
    })
    assert revoked.status_code==200
    assert client.get(path,headers=alice).json()["agreed"] is False
    # No upload, no storage of photograph bytes and no third-party provider calls.
    assert client.post("/api/photos/upload",headers=alice,files={
        "file":("example.png",fake_png(),"image/png")
    }).status_code==404


def test_photo_consent_deleted_with_parent_account(api):
    client,module,register,_=api
    _,auth=register()
    version="photo-reference-v1"
    assert client.post("/api/photos/consent",headers=auth,json={
        "agreed":True,"policy_version":version
    }).status_code==200
    with module.connection() as c:
        parent=module.current_parent(auth["Authorization"])
        assert module.sql(c,"SELECT COUNT(*) FROM photo_parent_consent WHERE owner_id=?",(parent,)).fetchone()[0]==1
    assert client.delete("/api/me",headers=auth).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM photo_parent_consent WHERE owner_id=?",(parent,)).fetchone()[0]==0


def test_reference_upload_is_dev_only_requires_consent_and_has_ttl(api,monkeypatch):
    client,module,register,_=api
    _,parent=register()
    _,stranger=register()
    uri="/api/photos/reference"
    image=fake_png()
    headers={**parent,"Content-Type":"image/png"}
    assert client.post(uri,headers=headers,content=image).status_code==503
    assert client.get(uri,headers=parent).status_code==503
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    assert client.post(uri,headers=headers,content=image).status_code==403
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":True,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.post(uri,headers={**parent,"Content-Type":"text/plain"},content=image).status_code==415
    assert client.post(uri,headers=headers,content=b"fake").status_code==422
    assert client.post(uri,headers=headers,content=b"x"*5_000_001).status_code==413
    saved=client.post(uri,headers=headers,content=image)
    assert saved.status_code==201,saved.text
    assert saved.json()["photo_generation_enabled"] is False
    assert saved.json()["expires_at"]>int(__import__("time").time())
    assert client.get(uri,headers=parent).json()["stored"] is True
    assert client.get(uri,headers=stranger).json()["stored"] is False
    with module.connection() as c:
        owner=module.current_parent(parent["Authorization"])
        row=module.sql(c,"SELECT jpeg_bytes,sha256 FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()
        assert row and bytes(row[0]).startswith(bytes((255,216,255)))
        assert row[1]==__import__("hashlib").sha256(bytes(row[0])).hexdigest()
        assert b"SECRET-METADATA-NEVER-KEEP" not in bytes(row[0])
        assert image!=bytes(row[0])
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":False,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.get(uri,headers=parent).json()["stored"] is False
    assert client.post(uri,headers=headers,content=image).status_code==403
    # Missing consent remains private to the account.
    assert client.get(uri).status_code==401


def test_reference_expires_and_can_be_deleted_even_if_feature_switched_off(api,monkeypatch):
    client,module,register,_=api
    _,parent=register()
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    consent={"agreed":True,"policy_version":"photo-reference-v1"}
    assert client.post("/api/photos/consent",headers=parent,json=consent).status_code==200
    uri="/api/photos/reference"
    headers={**parent,"Content-Type":"image/png"}
    assert client.post(uri,headers=headers,content=fake_png()).status_code==201
    with module.connection() as c:
        owner=module.current_parent(parent["Authorization"])
        module.sql(c,"UPDATE photo_reference_temp SET expires_at=0 WHERE owner_id=?",(owner,))
        c.commit()
    assert client.get(uri,headers=parent).json()["stored"] is False
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()[0]==0
    assert client.post(uri,headers=headers,content=fake_png()).status_code==201
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","false")
    assert client.post(uri,headers=headers,content=fake_png()).status_code==503
    assert client.delete(uri,headers=parent).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()[0]==0


def test_reference_storage_is_removed_when_parent_deleted(api,monkeypatch):
    client,module,register,_=api
    _,parent=register()
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":True,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.post("/api/photos/reference",headers={
        **parent,"Content-Type":"image/png"
    },content=fake_png()).status_code==201
    with module.connection() as c:
        owner=module.current_parent(parent["Authorization"])
    assert client.delete("/api/me",headers=parent).status_code==204
    with module.connection() as c:
        assert module.sql(c,"SELECT COUNT(*) FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()[0]==0


def test_reference_upload_blocked_when_environment_is_preview(api,monkeypatch):
    _,module,_,_=api
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    monkeypatch.setattr(module,"APP_ENV","preview")
    assert module.photo_reference_upload_enabled() is False
    monkeypatch.setattr(module,"APP_ENV","production")
    assert module.photo_reference_upload_enabled() is False


def test_local_portrait_preview_is_private_and_not_an_ai_generation(api,monkeypatch):
    client,module,register,_=api
    _,parent=register()
    _,other=register()
    uri="/api/photos/reference/preview"
    upload="/api/photos/reference"
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    assert client.get(uri).status_code==401
    assert client.get(uri,headers=parent).status_code==403
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":True,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.get(uri,headers=parent).status_code==404
    assert client.post(upload,headers={**parent,"Content-Type":"image/png"},
                       content=fake_png()).status_code==201
    assert client.get(uri,headers=other).status_code==403
    preview=client.get(uri,headers=parent)
    assert preview.status_code==200,preview.text
    assert preview.headers["content-type"]=="image/png"
    assert preview.headers["cache-control"]=="private, no-store"
    assert preview.headers["x-content-type-options"]=="nosniff"
    assert preview.content.startswith(bytes((137,80,78,71,13,10,26,10)))
    with Image.open(io.BytesIO(preview.content)) as art:
        assert art.size==(512,512)
        assert art.getexif()=={}
    with module.connection() as c:
        owner=module.current_parent(parent["Authorization"])
        count=module.sql(c,"SELECT COUNT(*) FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()[0]
        assert count==1
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":False,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.get(uri,headers=parent).status_code==403
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","false")
    assert client.get(uri,headers=parent).status_code==503


def test_portrait_preview_expiry_integrity_and_no_outbound_calls(api,monkeypatch):
    client,module,register,_=api
    _,parent=register()
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":True,"policy_version":"photo-reference-v1"
    }).status_code==200
    uri="/api/photos/reference"
    assert client.post(uri,headers={**parent,"Content-Type":"image/png"},content=fake_png()).status_code==201
    with module.connection() as c:
        owner=module.current_parent(parent["Authorization"])
        module.sql(c,"UPDATE photo_reference_temp SET sha256=? WHERE owner_id=?",("0"*64,owner))
        c.commit()
    assert client.get(uri+"/preview",headers=parent).status_code==503
    with module.connection() as c:
        module.sql(c,"UPDATE photo_reference_temp SET expires_at=0 WHERE owner_id=?",(owner,))
        c.commit()
    assert client.get(uri+"/preview",headers=parent).status_code==404
    from pathlib import Path
    source=Path(__file__).with_name("private_photo_preview.py").read_text()
    assert "openai" not in source.lower()
    assert "import requests" not in source
    assert "requests.get(" not in source
    assert "requests.post(" not in source.lower()
    assert "write_bytes" not in source
    assert "image model" not in source.lower()


def test_storyboard_consistent_portrait_mockup_and_varying_scenes(api,monkeypatch):
    """Identical portrait region across pages; backgrounds differ; never AI."""
    client,module,register,_=api
    _,parent=register()
    _,other=register()
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    consent={"agreed":True,"policy_version":"photo-reference-v1"}
    assert client.post("/api/photos/consent",headers=parent,json=consent).status_code==200
    assert client.post("/api/photos/reference",headers={
        **parent,"Content-Type":"image/png"
    },content=fake_png()).status_code==201
    base="/api/photos/reference/pages/"
    assert client.get(base+"1").status_code==401
    assert client.get(base+"1",headers=other).status_code==403
    assert client.get(base+"0",headers=parent).status_code==422
    assert client.get(base+"9",headers=parent).status_code==422
    assert client.get(base+"1?page_count=9",headers=parent).status_code==422
    assert client.get(base+"21?page_count=20",headers=parent).status_code==422

    first=client.get(base+"1",headers=parent)
    second=client.get(base+"2",headers=parent)
    repeated=client.get(base+"1",headers=parent)
    assert first.status_code==second.status_code==repeated.status_code==200
    assert first.content==repeated.content
    assert first.content!=second.content
    assert first.headers["cache-control"]=="private, no-store"
    assert first.headers["content-type"]=="image/png"
    with Image.open(io.BytesIO(first.content)) as art1,Image.open(io.BytesIO(second.content)) as art2:
        assert art1.size==art2.size==(512,512)
        # Stable portrait crop and frame, irrespective of surrounding scene.
        assert art1.crop((145,145,355,355)).tobytes()==art2.crop((145,145,355,355)).tobytes()
        assert art1.getpixel((4,4))!=art2.getpixel((4,4))
        assert art1.getexif()=={}
    long_page=client.get(base+"20?page_count=20",headers=parent)
    assert long_page.status_code==200
    assert long_page.content.startswith(bytes((137,80,78,71,13,10,26,10)))
    assert client.post("/api/photos/consent",headers=parent,json={
        "agreed":False,"policy_version":"photo-reference-v1"
    }).status_code==200
    assert client.get(base+"1",headers=parent).status_code==403
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","false")
    assert client.get(base+"1",headers=parent).status_code==503


def test_storyboard_mockup_rejects_invalid_pages_without_external_provider():
    from private_photo_preview import render_local_story_page
    ref=fake_png()
    for number,count in ((0,8),(9,8),(21,20),(1,7),(1,21),(True,8),(1,True)):
        with pytest.raises(ValueError):
            render_local_story_page(ref,number,count)
    from pathlib import Path
    code=Path(__file__).with_name("private_photo_preview.py").read_text()
    assert "from openai import" not in code
    assert "images.generate(" not in code
    assert "write_bytes(" not in code



# Existing backend CI explicitly selects this file. Import the new isolated
# photo-edit adapter contract tests so they run in that controlled test suite.
from test_private_reference_image_edits import (
    enabled,
    test_mock_edit_normalizes_photo_and_uses_only_curated_scene,
    test_identical_character_guide_across_pages_but_different_scene,
    test_prompt_rejects_unapproved_values,
    test_all_edit_flags_required,
    test_never_calls_provider_outside_local_development,
    test_parent_must_explicitly_consent_to_external_transfer,
    test_bad_provider_response_rejected,
    test_provider_error_has_no_automatic_paid_retry,
    test_adapter_has_no_api_route_or_implicit_database_access,
)
