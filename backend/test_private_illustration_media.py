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
        return email,{"Authorization":"Bearer "+result.json()["access_token"]}
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
