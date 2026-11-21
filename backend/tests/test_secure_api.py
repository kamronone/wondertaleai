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
os.environ["REQUIRE_EMAIL_VERIFICATION"]="false"
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

def test_private_billing_and_auth_responses_are_never_cacheable():
    token = signup("no-cache-parent@example.com")
    paths = ["/api/me", "/api/books", "/api/books/favorites",
             "/api/books/progress", "/api/children", "/api/billing/status"]
    for path in paths:
        response = client.get(path, headers=headers(token))
        assert response.status_code == 200, (path, response.text)
        assert response.headers.get("Cache-Control") == "private, no-store", path
        assert response.headers.get("Pragma") == "no-cache", path
        assert response.headers.get("X-Content-Type-Options") == "nosniff", path
    unauthenticated = client.get("/api/billing/status")
    assert unauthenticated.status_code == 401
    assert unauthenticated.headers.get("Cache-Control") == "private, no-store"


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
    assert client.post("/api/auth/login",json={"email":"parent-c@example.com","password":"not-my-password"}).status_code==401


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

def test_sessions_logout_and_revoke_all():
    import uuid
    email="session-"+str(uuid.uuid4())+"@example.com"
    first=signup(email)
    login_result=client.post("/api/auth/login",json={"email":email,"password":PASSWORD})
    assert login_result.status_code==200,login_result.text
    second=login_result.json()["access_token"]
    listed=client.get("/api/auth/sessions",headers=headers(second))
    assert listed.status_code==200
    assert len(listed.json())==2
    assert client.post("/api/auth/logout",headers=headers(first)).status_code==204
    assert client.get("/api/me",headers=headers(first)).status_code==401
    assert client.get("/api/me",headers=headers(second)).status_code==200
    assert client.post("/api/auth/logout-all",headers=headers(second)).status_code==204
    assert client.get("/api/me",headers=headers(second)).status_code==401
    assert client.get("/api/auth/sessions",headers=headers(second)).status_code==401

def test_signature_valid_but_unknown_session_is_rejected():
    import uuid
    token=signup("session-invalid-"+str(uuid.uuid4())+"@example.com")
    payload=secure_main.decode(token.split(".")[0])
    import json
    decoded=json.loads(payload)
    decoded["sid"]=str(uuid.uuid4())
    part=secure_main.encode(json.dumps(decoded,separators=(",",":")).encode())
    signature=secure_main.encode(__import__("hmac").new(secure_main.SECRET.encode(),part.encode(),__import__("hashlib").sha256).digest())
    forged=part+"."+signature
    assert client.get("/api/me",headers=headers(forged)).status_code==401

def test_password_change_invalidates_all_previous_tokens():
    import uuid
    email="pw-"+str(uuid.uuid4())+"@example.com"
    token=signup(email)
    new_password="wondertale-new-strong-password-2026"
    invalid=client.post("/api/auth/change-password",headers=headers(token),json={"current_password":"wrong-strong-password","new_password":new_password})
    assert invalid.status_code==401
    changed=client.post("/api/auth/change-password",headers=headers(token),json={"current_password":PASSWORD,"new_password":new_password})
    assert changed.status_code==200,changed.text
    next_token=changed.json()["access_token"]
    assert client.get("/api/me",headers=headers(token)).status_code==401
    assert client.get("/api/me",headers=headers(next_token)).status_code==200
    assert client.post("/api/auth/login",json={"email":email,"password":PASSWORD}).status_code==401
    assert client.post("/api/auth/login",json={"email":email,"password":new_password}).status_code==200


def test_parent_child_profiles_are_private():
    import uuid
    a=signup("family-a-"+str(uuid.uuid4())+"@example.com")
    b=signup("family-b-"+str(uuid.uuid4())+"@example.com")
    child=client.post("/api/children",headers=headers(a),json={"nickname":"Little Hero","age":6})
    assert child.status_code==201,child.text
    cid=child.json()["id"]
    assert len(client.get("/api/children",headers=headers(a)).json())==1
    assert client.get("/api/children",headers=headers(b)).json()==[]
    assert client.delete("/api/children/"+cid,headers=headers(b)).status_code==404
    assert client.delete("/api/children/"+cid,headers=headers(a)).status_code==204
    assert client.get("/api/children",headers=headers(a)).json()==[]

def test_book_favorites_and_progress_belong_to_parent():
    import uuid
    a=signup("reading-a-"+str(uuid.uuid4())+"@example.com")
    b=signup("reading-b-"+str(uuid.uuid4())+"@example.com")
    story='{"language":"en","pages":["A","B","C"]}'
    created=client.post("/api/books",headers=headers(a),json={"title":"A friendly tale","child_name":"Mira","age":6,"story":story})
    assert created.status_code==201
    bid=created.json()["id"]
    assert client.post("/api/books/"+bid+"/favorite",headers=headers(b)).status_code==404
    assert client.post("/api/books/"+bid+"/progress",headers=headers(b),json={"page":1}).status_code==404
    assert client.get("/api/books/favorites",headers=headers(b)).json()=={"ids":[]}
    assert client.get("/api/books/progress",headers=headers(b)).json()==[]
    assert client.post("/api/books/"+bid+"/favorite",headers=headers(a)).json()["favorite"] is True
    assert client.get("/api/books/favorites",headers=headers(a)).json()["ids"]==[bid]
    assert client.post("/api/books/"+bid+"/progress",headers=headers(a),json={"page":2}).status_code==200
    assert client.post("/api/books/"+bid+"/progress",headers=headers(a),json={"page":3}).status_code==422
    assert client.get("/api/books/progress",headers=headers(a)).json()[0]["page"]==2
    assert client.post("/api/books/"+bid+"/favorite",headers=headers(a)).json()["favorite"] is False
    assert client.delete("/api/books/"+bid,headers=headers(a)).status_code==204
    assert client.get("/api/books/favorites",headers=headers(a)).json()=={"ids":[]}
    assert client.get("/api/books/progress",headers=headers(a)).json()==[]


def test_verified_signup_requires_delivery_and_a_one_time_token(monkeypatch):
    import uuid
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","true")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:True)
    seen=[]
    monkeypatch.setattr(secure_main,"send_account_email",lambda email,token,kind:seen.append((email,token,kind)))
    email="verified-"+str(uuid.uuid4())+"@example.com"
    result=client.post("/api/auth/register",json={"email":email,"password":PASSWORD})
    assert result.status_code==201,result.text
    assert result.json()=={"status":"verification_sent"}
    assert len(seen)==1 and seen[0][2]=="verify"
    assert client.post("/api/auth/login",json={"email":email,"password":PASSWORD}).status_code==403
    ok=client.post("/api/auth/verify-email",json={"token":seen[0][1]})
    assert ok.status_code==200,ok.text
    assert client.post("/api/auth/verify-email",json={"token":seen[0][1]}).status_code==400
    logged=client.post("/api/auth/login",json={"email":email,"password":PASSWORD})
    assert logged.status_code==200,logged.text
    assert client.get("/api/me",headers=headers(logged.json()["access_token"])).status_code==200
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","false")

def test_unconfigured_mail_rejects_verified_signup(monkeypatch):
    import uuid
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","true")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:False)
    result=client.post("/api/auth/register",json={"email":"no-smtp-"+str(uuid.uuid4())+"@example.com","password":PASSWORD})
    assert result.status_code==503
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","false")

def test_password_recovery_token_invalidates_existing_sessions(monkeypatch):
    import uuid
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","false")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:True)
    seen=[]
    monkeypatch.setattr(secure_main,"send_account_email",lambda email,token,kind:seen.append((email,token,kind)))
    email="recovery-"+str(uuid.uuid4())+"@example.com"
    old_token=signup(email)
    started=client.post("/api/auth/forgot-password",json={"email":email})
    assert started.status_code==200
    assert len(seen)==1 and seen[0][2]=="recover"
    new_password="another-strong-password-2026"
    reset=client.post("/api/auth/reset-password",json={"token":seen[0][1],"new_password":new_password})
    assert reset.status_code==200,reset.text
    assert client.post("/api/auth/reset-password",json={"token":seen[0][1],"new_password":new_password}).status_code==400
    assert client.get("/api/me",headers=headers(old_token)).status_code==401
    assert client.post("/api/auth/login",json={"email":email,"password":new_password}).status_code==200
    assert client.post("/api/auth/login",json={"email":email,"password":PASSWORD}).status_code==401

def test_recovery_does_not_reveal_unknown_email(monkeypatch):
    import uuid
    monkeypatch.setattr(secure_main,"mail_configured",lambda:True)
    monkeypatch.setattr(secure_main,"send_account_email",lambda *args: (_ for _ in ()).throw(AssertionError("Unexpected email")))
    unknown="missing-"+str(uuid.uuid4())+"@example.com"
    r=client.post("/api/auth/forgot-password",json={"email":unknown})
    assert r.status_code==200
    assert r.json()=={"status":"if_account_exists_email_sent"}


def test_private_library_rejects_blank_content_and_enforces_quota(monkeypatch):
    import uuid
    token=signup("quota-"+str(uuid.uuid4())+"@example.com")
    auth=headers(token)
    for field in ("title","child_name","story"):
        body={"title":"Story","child_name":"Mira","age":6,"story":"A thoughtful story."}
        body[field]="   "
        response=client.post("/api/books",headers=auth,json=body)
        assert response.status_code==422,(field,response.text)
    # A small isolated limit exercises the enforcement without creating 100 books.
    monkeypatch.setattr(secure_main,"MAX_BOOKS_PER_PARENT",2)
    for title in ("First","Second"):
        result=client.post("/api/books",headers=auth,json={
            "title":title,"child_name":"Mira","age":6,"story":"A gentle adventure."
        })
        assert result.status_code==201,result.text
    rejected=client.post("/api/books",headers=auth,json={
        "title":"Third","child_name":"Mira","age":6,"story":"A gentle adventure."
    })
    assert rejected.status_code==409
    listed=client.get("/api/books",headers=auth)
    assert listed.status_code==200
    assert len(listed.json())==2

def test_personal_library_limit_does_not_affect_other_parents(monkeypatch):
    import uuid
    monkeypatch.setattr(secure_main,"MAX_BOOKS_PER_PARENT",1)
    a=signup("limit-a-"+str(uuid.uuid4())+"@example.com")
    b=signup("limit-b-"+str(uuid.uuid4())+"@example.com")
    for token in (a,b):
        result=client.post("/api/books",headers=headers(token),json={
            "title":"One book","child_name":"Hero","age":6,"story":"An independent private story."
        })
        assert result.status_code==201,result.text
    assert len(client.get("/api/books",headers=headers(a)).json())==1
    assert len(client.get("/api/books",headers=headers(b)).json())==1


def test_resend_verification_remains_single_use_and_throttled(monkeypatch):
    import uuid
    email="resend-"+str(uuid.uuid4())+"@example.com"
    sent=[]
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION","true")
    monkeypatch.setattr(secure_main,"mail_configured",lambda:True)
    monkeypatch.setattr(secure_main,"send_account_email",lambda address,token,kind:sent.append((address,token,kind)))
    registered=client.post("/api/auth/register",json={"email":email,"password":PASSWORD})
    assert registered.status_code==201,registered.text
    assert len(sent)==1
    # Registration issues a confirmation token, so an immediate repeat is throttled.
    immediate=client.post("/api/auth/resend-verification",json={"email":email})
    assert immediate.status_code==200
    assert immediate.json()=={"status":"if_account_exists_email_sent"}
    assert len(sent)==1
    # Move only the synthetic test token's issued_at into the past.
    with secure_main.connection() as c:
        owner=secure_main.sql(c,"SELECT id FROM parents WHERE email=?",(email,)).fetchone()[0]
        secure_main.sql(c,"UPDATE email_action_tokens SET issued_at=issued_at-130 WHERE owner_id=?",(owner,))
        c.commit()
    again=client.post("/api/auth/resend-verification",json={"email":email})
    assert again.status_code==200
    assert len(sent)==2 and sent[-1][2]=="verify"
    assert client.post("/api/auth/verify-email",json={"token":sent[-1][1]}).status_code==200
    assert client.post("/api/auth/resend-verification",json={"email":email}).status_code==200
    assert len(sent)==2


def test_parent_ai_quota_rejection_does_not_consume_global_budget(monkeypatch):
    """A rejected third request must not block another authorized family."""
    from ai_generation import GeneratedStory
    import uuid
    first_email="quota-a-"+str(uuid.uuid4())+"@example.com"
    second_email="quota-b-"+str(uuid.uuid4())+"@example.com"
    first=signup(first_email)
    second=signup(second_email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-injected-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",first_email+","+second_email)
    # Other tests share this SQLite database; use a high global ceiling so
    # unrelated prior generations do not make this regression flaky.
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    monkeypatch.setattr(secure_main,"generate_story",lambda x:GeneratedStory(
        title="A gentle magical adventure",language=x.language,
        pages=["A calm adventure where children help their friends and learn kindness together."]*x.pages_count))
    body={"name":"Amir","age":5,"language":"en","idea":"A friendly adventure in a magical garden"}
    for _ in range(2):
        response=client.post("/api/books/generate",headers=headers(first),json=body)
        assert response.status_code==201,response.text
    today=__import__("datetime").datetime.now(__import__("datetime").timezone.utc).date().isoformat()
    with secure_main.connection() as connection:
        before=secure_main.sql(connection,"SELECT used FROM generation_global_quota WHERE day=?",(today,)).fetchone()[0]
    denied=client.post("/api/books/generate",headers=headers(first),json=body)
    assert denied.status_code==429,denied.text
    with secure_main.connection() as connection:
        after=secure_main.sql(connection,"SELECT used FROM generation_global_quota WHERE day=?",(today,)).fetchone()[0]
    assert after==before,"Rejected parent quota must not consume global quota"
    other=client.post("/api/books/generate",headers=headers(second),json=body)
    assert other.status_code==201,other.text


def test_family_profile_limit_and_owner_isolation():
    import uuid
    first=signup("family-limit-a-"+str(uuid.uuid4())+"@example.com")
    second=signup("family-limit-b-"+str(uuid.uuid4())+"@example.com")
    created=[]
    for index in range(5):
        response=client.post("/api/children",headers=headers(first),json={"nickname":f"Child {index+1}","age":index+4})
        assert response.status_code==201,response.text
        created.append(response.json()["id"])
    assert len(client.get("/api/children",headers=headers(first)).json())==5
    assert client.post("/api/children",headers=headers(first),json={"nickname":"Sixth","age":6}).status_code==409
    assert client.get("/api/children",headers=headers(second)).json()==[]
    assert client.delete("/api/children/"+created[0],headers=headers(second)).status_code==404
    assert client.delete("/api/children/"+created[0],headers=headers(first)).status_code==204
    assert client.post("/api/children",headers=headers(first),json={"nickname":"Replacement","age":7}).status_code==201
    assert len(client.get("/api/children",headers=headers(first)).json())==5


def test_family_profile_age_and_name_validation():
    import uuid
    parent=signup("family-validation-"+str(uuid.uuid4())+"@example.com")
    for age in (1,15):
        response=client.post("/api/children",headers=headers(parent),json={"nickname":"Child","age":age})
        assert response.status_code==422,response.text
    for nickname in ("   ","x"*46):
        response=client.post("/api/children",headers=headers(parent),json={"nickname":nickname,"age":6})
        assert response.status_code==422,response.text
    assert client.get("/api/children",headers=headers(parent)).json()==[]


def test_failed_ai_provider_refunds_both_daily_quotas(monkeypatch):
    """A provider failure must not charge the parent or exhaust the service budget."""
    import uuid
    from datetime import datetime, timezone
    email="provider-failure-"+str(uuid.uuid4())+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-injected-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    def unavailable(_body):
        raise RuntimeError("Simulated upstream outage")
    monkeypatch.setattr(secure_main,"generate_story",unavailable)
    day=datetime.now(timezone.utc).date().isoformat()
    with secure_main.connection() as connection:
        before=secure_main.sql(connection,"SELECT used FROM generation_global_quota WHERE day=?",(day,)).fetchone()
        global_before=before[0] if before else 0
    body={"name":"Amir","age":5,"language":"en","idea":"A friendly adventure in a magical garden"}
    for _ in range(2):
        response=client.post("/api/books/generate",headers=headers(token),json=body)
        assert response.status_code==502,response.text
        assert "Simulated upstream outage" not in response.text
    with secure_main.connection() as connection:
        after=secure_main.sql(connection,"SELECT used FROM generation_global_quota WHERE day=?",(day,)).fetchone()
        owner=secure_main.sql(connection,"SELECT id FROM parents WHERE email=?",(email,)).fetchone()[0]
        parent=secure_main.sql(connection,"SELECT used FROM generation_quota WHERE owner_id=? AND day=?",(owner,day)).fetchone()
    assert (after[0] if after else 0)==global_before
    assert (parent[0] if parent else 0)==0
    assert client.get("/api/books",headers=headers(token)).json()==[]


def test_ai_idempotency_retries_return_original_book_without_spending_twice(monkeypatch):
    import uuid
    from ai_generation import GeneratedStory
    email="ai-idempotent-"+str(uuid.uuid4())+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    calls=[]
    def generate(payload):
        calls.append(payload)
        return GeneratedStory(title="A magical forest",language="en",pages=["An original warm and gentle adventure with a friendly magical fox."]*8)
    monkeypatch.setattr(secure_main,"generate_story",generate)
    body={"name":"Sam","age":7,"language":"en","idea":"A quiet journey with a kind fox"}
    key="safe-request-"+uuid.uuid4().hex
    auth={**headers(token),"Idempotency-Key":key}
    first=client.post("/api/books/generate",headers=auth,json=body)
    assert first.status_code==201,first.text
    again=client.post("/api/books/generate",headers=auth,json=body)
    assert again.status_code==201,again.text
    assert again.json()==first.json()
    assert len(calls)==1
    assert len(client.get("/api/books",headers=headers(token)).json())==1
    status=client.get("/api/billing/status",headers=headers(token)).json()
    assert status["ai_used_today"]==1
    changed=client.post("/api/books/generate",headers=auth,json={**body,"idea":"A completely different magical adventure"})
    assert changed.status_code==409
    assert len(calls)==1


def test_ai_idempotency_is_scoped_to_parent_and_rejects_pending(monkeypatch):
    import uuid
    from ai_generation import GeneratedStory
    suffix=uuid.uuid4().hex
    emails=["idempotent-a-"+suffix+"@example.com","idempotent-b-"+suffix+"@example.com"]
    tokens=[signup(email) for email in emails]
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",",".join(emails))
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    calls=[]
    def generate(payload):
        calls.append(payload)
        return GeneratedStory(title="A gentle story",language="en",pages=["A child and their friends explore a magical place together."]*8)
    monkeypatch.setattr(secure_main,"generate_story",generate)
    body={"name":"Alex","age":6,"language":"en","idea":"A journey to a friendly starlit forest"}
    key="key-"+uuid.uuid4().hex
    a=client.post("/api/books/generate",headers={**headers(tokens[0]),"Idempotency-Key":key},json=body)
    b=client.post("/api/books/generate",headers={**headers(tokens[1]),"Idempotency-Key":key},json=body)
    assert a.status_code==201,a.text
    assert b.status_code==201,b.text
    assert a.json()["id"]!=b.json()["id"]
    assert len(calls)==2
    with secure_main.connection() as c:
        owner=secure_main.sql(c,"SELECT id FROM parents WHERE email=?",(emails[0],)).fetchone()[0]
        secure_main.sql(c,"INSERT INTO ai_idempotency(owner_id,request_key,payload_digest,book_id,created_at) VALUES(?,?,?,NULL,?)",(owner,"pending-"+uuid.uuid4().hex,__import__("hashlib").sha256(secure_main.GenerateStoryInput(**body).model_dump_json().encode()).hexdigest(),"2026-11-21"))
        pending_key=secure_main.sql(c,"SELECT request_key FROM ai_idempotency WHERE owner_id=? AND book_id IS NULL",(owner,)).fetchone()[0]
        c.commit()
    pending=client.post("/api/books/generate",headers={**headers(tokens[0]),"Idempotency-Key":pending_key},json=body)
    assert pending.status_code==409
    assert len(calls)==2


def test_failed_ai_generation_releases_idempotency_reservation(monkeypatch):
    import uuid
    from ai_generation import GeneratedStory
    email="ai-retry-"+str(uuid.uuid4())+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    calls=[]
    def generate(payload):
        calls.append(payload)
        if len(calls)==1:
            raise RuntimeError("Simulated provider failure")
        return GeneratedStory(title="A magical return",language="en",pages=["A gentle journey continues under the glowing stars tonight."]*8)
    monkeypatch.setattr(secure_main,"generate_story",generate)
    data={"name":"Sam","age":6,"language":"en","idea":"A friendly adventure on a magical hill"}
    auth={**headers(token),"Idempotency-Key":"safe-retry-"+uuid.uuid4().hex}
    first=client.post("/api/books/generate",headers=auth,json=data)
    assert first.status_code==502
    again=client.post("/api/books/generate",headers=auth,json=data)
    assert again.status_code==201,again.text
    assert len(calls)==2
    assert client.get("/api/billing/status",headers=headers(token)).json()["ai_used_today"]==1


def test_invalid_ai_idempotency_key_rejected_without_provider(monkeypatch):
    import uuid
    email="ai-bad-key-"+str(uuid.uuid4())+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","test-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    monkeypatch.setattr(secure_main,"generate_story",lambda _payload: (_ for _ in ()).throw(AssertionError("Must not call model")))
    data={"name":"Sam","age":7,"language":"en","idea":"An adventure beyond the magical river"}
    for key in ("short","a space "+"x"*15,"x"*129):
        response=client.post("/api/books/generate",headers={**headers(token),"Idempotency-Key":key},json=data)
        assert response.status_code==422


def test_ai_generation_request_status_is_owner_scoped(monkeypatch):
    import uuid
    from ai_generation import GeneratedStory
    email_a="job-owner-"+uuid.uuid4().hex+"@example.com"
    email_b="job-foreign-"+uuid.uuid4().hex+"@example.com"
    a=signup(email_a)
    b=signup(email_b)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","fake-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email_a)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    monkeypatch.setattr(secure_main,"generate_story",lambda req:GeneratedStory(
        title="A kind hidden garden",language=req.language,
        pages=["A calm adventure with friendly animals in a colorful peaceful garden."]*8
    ))
    key="generation-"+uuid.uuid4().hex
    body={"name":"Alex","age":7,"language":"en","idea":"Help a little star find a hidden garden"}
    unauth=client.get("/api/books/generation-requests/"+key)
    assert unauth.status_code==401
    assert client.get("/api/books/generation-requests/"+key,headers=headers(b)).status_code==404
    created=client.post("/api/books/generate",headers={**headers(a),"Idempotency-Key":key},json=body)
    assert created.status_code==201,created.text
    completed=client.get("/api/books/generation-requests/"+key,headers=headers(a))
    assert completed.status_code==200
    assert completed.json()=={"status":"completed","book_id":created.json()["id"]}
    assert completed.headers["Cache-Control"]=="private, no-store"
    assert client.get("/api/books/generation-requests/"+key,headers=headers(b)).status_code==404
    assert client.delete("/api/books/"+created.json()["id"],headers=headers(a)).status_code==204
    deleted=client.get("/api/books/generation-requests/"+key,headers=headers(a))
    assert deleted.status_code==200 and deleted.json()=={"status":"unavailable","book_id":None}


def test_uncertain_old_ai_generation_is_not_automatically_retried(monkeypatch):
    import hashlib
    import uuid
    from datetime import datetime, timedelta, timezone
    email="ai-stale-"+uuid.uuid4().hex+"@example.com"
    token=signup(email)
    key="stale-"+uuid.uuid4().hex
    data=secure_main.GenerateStoryInput(
        name="Alex",age=6,language="en",
        idea="The adventure starts in a gentle magical forest"
    )
    with secure_main.connection() as c:
        owner=secure_main.sql(c,"SELECT id FROM parents WHERE email=?",(email,)).fetchone()[0]
        digest=hashlib.sha256(data.model_dump_json().encode()).hexdigest()
        created=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat()
        secure_main.sql(c,"INSERT INTO ai_idempotency(owner_id,request_key,payload_digest,book_id,created_at) VALUES(?,?,?,NULL,?)",(owner,key,digest,created))
        c.commit()
    state=client.get("/api/books/generation-requests/"+key,headers=headers(token))
    assert state.status_code==200 and state.json()["status"]=="needs_review"
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","fake-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setattr(secure_main,"generate_story",lambda _data: (_ for _ in ()).throw(AssertionError("Must not call model")))
    retried=client.post("/api/books/generate",headers={**headers(token),"Idempotency-Key":key},json=data.model_dump())
    assert retried.status_code==409
    assert client.get("/api/billing/status",headers=headers(token)).json()["ai_used_today"]==0


def test_full_library_does_not_leave_stuck_ai_idempotency_marker(monkeypatch):
    import uuid
    email="ai-full-library-"+uuid.uuid4().hex+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("OPENAI_API_KEY","fake-no-network")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY","200")
    monkeypatch.setattr(secure_main,"MAX_BOOKS_PER_PARENT",0)
    monkeypatch.setattr(secure_main,"generate_story",lambda _data: (_ for _ in ()).throw(AssertionError("Must not call model")))
    key="library-full-"+uuid.uuid4().hex
    data={"name":"Alex","age":6,"language":"en","idea":"A little fox visits a friendly magical forest"}
    response=client.post("/api/books/generate",headers={**headers(token),"Idempotency-Key":key},json=data)
    assert response.status_code==409
    assert client.get("/api/books/generation-requests/"+key,headers=headers(token)).status_code==404
    assert client.get("/api/billing/status",headers=headers(token)).json()["ai_used_today"]==0


def test_private_illustrations_queue_owner_isolation_and_cancel(monkeypatch):
    import json
    import uuid
    email_a="image-a-"+uuid.uuid4().hex+"@example.com"
    a=signup(email_a)
    b=signup("image-b-"+uuid.uuid4().hex+"@example.com")
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS","true")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email_a)
    saved=client.post("/api/books",headers=headers(a),json={
        "title":"Forest friendship","child_name":"Alex","age":6,
        "story":json.dumps({"pages":[{"number":1,"text":"A very friendly fox visits the magical garden."}]})
    })
    assert saved.status_code==201,saved.text
    bid=saved.json()["id"]
    data={"book_id":bid,"page_number":1,"style":"watercolor"}
    assert client.post("/api/illustrations/jobs",json=data).status_code==401
    assert client.post("/api/illustrations/jobs",headers=headers(b),json=data).status_code==403
    first=client.post("/api/illustrations/jobs",headers=headers(a),json=data)
    assert first.status_code==202,first.text
    assert first.json()["status"]=="queued"
    assert client.post("/api/illustrations/jobs",headers=headers(a),json=data).json()==first.json()
    listing=client.get("/api/illustrations/jobs",headers=headers(a))
    assert listing.status_code==200
    assert listing.headers["Cache-Control"]=="private, no-store"
    assert [j["id"] for j in listing.json()]==[first.json()["id"]]
    assert client.get("/api/illustrations/jobs",headers=headers(b)).json()==[]
    assert client.delete("/api/illustrations/jobs/"+first.json()["id"],headers=headers(b)).status_code==404
    assert client.delete("/api/illustrations/jobs/"+first.json()["id"],headers=headers(a)).status_code==204
    assert client.get("/api/illustrations/jobs",headers=headers(a)).json()==[]


def test_illustration_jobs_deny_invalid_page_and_stop_at_two(monkeypatch):
    import json
    import uuid
    email="image-limits-"+uuid.uuid4().hex+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS","true")
    monkeypatch.setenv("AI_ALLOWED_EMAILS",email)
    book=client.post("/api/books",headers=headers(token),json={
        "title":"Kind stars","child_name":"Sam","age":7,
        "story":json.dumps({"pages":[{"number":1,"text":"A first page."},{"number":2,"text":"A second page."}]})
    })
    assert book.status_code==201
    bid=book.json()["id"]
    for data in (
        {"book_id":bid,"page_number":3,"style":"watercolor"},
        {"book_id":bid,"page_number":1,"style":"photorealistic"},
        {"book_id":str(uuid.uuid4()),"page_number":1,"style":"watercolor"}
    ):
        result=client.post("/api/illustrations/jobs",headers=headers(token),json=data)
        assert result.status_code in (404,422)
    for page in (1,2):
        result=client.post("/api/illustrations/jobs",headers=headers(token),json={
            "book_id":bid,"page_number":page,"style":"watercolor"
        })
        assert result.status_code==202,result.text
    limited=client.post("/api/illustrations/jobs",headers=headers(token),json={
        "book_id":bid,"page_number":1,"style":"pencil"
    })
    assert limited.status_code==429
    assert len(client.get("/api/illustrations/jobs",headers=headers(token)).json())==2
    assert client.delete("/api/me",headers=headers(token)).status_code==204
    with secure_main.connection() as c:
        count=secure_main.sql(c,"SELECT COUNT(*) FROM illustration_jobs WHERE book_id=?",(bid,)).fetchone()[0]
    assert count==0


def test_illustrations_feature_disabled_and_cors_key_allowed(monkeypatch):
    import uuid
    email="image-disabled-"+uuid.uuid4().hex+"@example.com"
    token=signup(email)
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS","false")
    result=client.post("/api/illustrations/jobs",headers=headers(token),json={
        "book_id":str(uuid.uuid4()),"page_number":1,"style":"storybook"
    })
    assert result.status_code==503
    preflight=client.options("/api/books/jobs",headers={
        "Origin":"http://localhost:5173",
        "Access-Control-Request-Method":"POST",
        "Access-Control-Request-Headers":"authorization,content-type,idempotency-key"
    })
    assert preflight.status_code==200,preflight.text
    allowed=preflight.headers["access-control-allow-headers"].lower()
    assert "idempotency-key" in allowed
