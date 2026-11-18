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
    assert client.get("/api/books/favorites",headers=headers(a)).json()==[]
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
