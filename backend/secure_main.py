"""WonderTale secure API foundation. Standalone, NOT connected to production preview.
Run: uvicorn secure_main:app --reload
Requires AUTH_SECRET (32+ chars) and DATABASE_URL (postgres or sqlite).
All content endpoints require a bearer token and enforce owner_id.
"""
import base64
import hashlib
import binascii
import hmac
import json
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

from fastapi import Depends, FastAPI, Header, HTTPException, Request, status
from fastapi.responses import Response
from private_illustration_media import normalize_private_illustration
from private_photo_reference import MAX_UPLOAD_BYTES, normalize_private_reference_photo
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from email_auth import verification_required, mail_configured, new_code, digest_code, send_account_email

SECRET = os.getenv("AUTH_SECRET", "")
if len(SECRET) < 32:
    raise RuntimeError("AUTH_SECRET must be set to a random 32+ character secret")
# Vercel Neon installs prefixed secrets; never expose these to Vite.
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("WONDERTALE_DB_DATABASE_URL")
    or os.getenv("WONDERTALE_DB_POSTGRES_URL")
)
APP_ENV = os.getenv("APP_ENV", "development").lower()
if not DATABASE_URL:
    if APP_ENV in ("production", "preview", "staging"):
        raise RuntimeError("A dedicated WonderTale PostgreSQL DATABASE_URL is required")
    DATABASE_URL = "sqlite:///./secure_dev.sqlite3"
if APP_ENV in ("production", "preview", "staging") and not (
    DATABASE_URL.startswith("postgres://") or DATABASE_URL.startswith("postgresql://")
):
    raise RuntimeError("Production and preview must use dedicated PostgreSQL")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
IS_PG = DATABASE_URL.startswith("postgresql://")
app = FastAPI(title="WonderTale Secure API", docs_url=None, redoc_url=None)
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=["GET","POST","PUT","DELETE"],allow_headers=["Authorization","Content-Type","Idempotency-Key"])

@app.middleware("http")
async def protect_private_responses(request, call_next):
    """Prevent private books, sessions and account responses from being cached."""
    response=await call_next(request)
    if request.url.path.startswith(("/api/books", "/api/auth", "/api/me", "/api/children", "/api/billing", "/api/ai", "/api/illustrations", "/api/photos")):
        response.headers["Cache-Control"]="private, no-store"
        response.headers["Pragma"]="no-cache"
        response.headers["X-Content-Type-Options"]="nosniff"
    return response

@contextmanager
def connection():
    if IS_PG:
        import psycopg
        with psycopg.connect(DATABASE_URL) as c:
            yield c
    else:
        if not DATABASE_URL.startswith("sqlite:///"):
            raise RuntimeError("DATABASE_URL must be postgres or sqlite")
        location = DATABASE_URL[10:]
        with sqlite3.connect(location) as c:
            c.execute("PRAGMA foreign_keys=ON")
            yield c

def sql(c, query, args=()):
    # All SQL is static and parameters are bound, never string-concatenated from input.
    return c.execute(query.replace("?", "%s") if IS_PG else query, args)

def init_schema():
    with connection() as c:
        sql(c, "CREATE TABLE IF NOT EXISTS parents (id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, created_at TEXT NOT NULL)")
        sql(c, "CREATE TABLE IF NOT EXISTS books (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, title TEXT NOT NULL, child_name TEXT NOT NULL, age INTEGER NOT NULL, story TEXT NOT NULL, created_at TEXT NOT NULL)")
        sql(c, "CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, issued_at TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)")
        sql(c, "CREATE INDEX IF NOT EXISTS sessions_owner_idx ON sessions(owner_id)")
        sql(c, "CREATE TABLE IF NOT EXISTS login_attempts (email_key TEXT PRIMARY KEY, window_started INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0)")
        sql(c, "CREATE TABLE IF NOT EXISTS generation_global_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)")
        sql(c, "CREATE TABLE IF NOT EXISTS ai_idempotency (owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, request_key TEXT NOT NULL, payload_digest TEXT NOT NULL, book_id TEXT REFERENCES books(id) ON DELETE SET NULL, created_at TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', PRIMARY KEY(owner_id,request_key))")
        sql(c, "CREATE TABLE IF NOT EXISTS ai_jobs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, request_key TEXT NOT NULL, payload_digest TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, book_id TEXT REFERENCES books(id) ON DELETE SET NULL, UNIQUE(owner_id,request_key))")
        sql(c, "CREATE INDEX IF NOT EXISTS ai_jobs_status_created_idx ON ai_jobs(status,created_at)")
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_parent_consent (owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE, policy_version TEXT NOT NULL, granted_at TEXT, revoked_at TEXT)")
        sql(c, "CREATE TABLE IF NOT EXISTS photo_parent_consent (owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE, policy_version TEXT NOT NULL, granted_at TEXT, revoked_at TEXT)")
        sql(c, "CREATE TABLE IF NOT EXISTS photo_external_transfer_consent (owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE, policy_version TEXT NOT NULL, granted_at TEXT, revoked_at TEXT)")
        sql(c, f"CREATE TABLE IF NOT EXISTS photo_reference_temp (owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE, jpeg_bytes {('BYTEA' if IS_PG else 'BLOB')} NOT NULL, sha256 TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL)")
        sql(c, "CREATE INDEX IF NOT EXISTS photo_reference_temp_expiry_idx ON photo_reference_temp(expires_at)")
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_jobs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, page_number INTEGER NOT NULL, style TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', created_at TEXT NOT NULL, started_at TEXT, completed_at TEXT, storage_key TEXT, UNIQUE(owner_id,book_id,page_number,style))")
        # Separate photo-personalization request ledger: no raw or rendered image
        # is copied into this table. No worker consumes these records.
        sql(c, "CREATE TABLE IF NOT EXISTS photo_illustration_requests (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, page_number INTEGER NOT NULL, style TEXT NOT NULL, hero_mode TEXT NOT NULL, reference_sha256 TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('pending_review','cancelled')), created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, UNIQUE(owner_id,book_id,page_number,style,hero_mode))")
        sql(c, "CREATE INDEX IF NOT EXISTS photo_illustration_requests_owner_idx ON photo_illustration_requests(owner_id,created_at)")
        sql(c, "CREATE INDEX IF NOT EXISTS illustration_jobs_owner_created_idx ON illustration_jobs(owner_id,created_at)")
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_runtime_control (singleton INTEGER PRIMARY KEY CHECK (singleton=1), paused INTEGER NOT NULL DEFAULT 0 CHECK (paused IN (0,1)), updated_at TEXT NOT NULL)")
        sql(c, "INSERT INTO illustration_runtime_control(singleton,paused,updated_at) VALUES(1,0,?) ON CONFLICT(singleton) DO NOTHING",(datetime.now(timezone.utc).isoformat(),))
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_job_events (id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES illustration_jobs(id) ON DELETE CASCADE, event TEXT NOT NULL, created_at TEXT NOT NULL)")
        sql(c, "CREATE INDEX IF NOT EXISTS illustration_events_job_created_idx ON illustration_job_events(job_id,created_at)")
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_billing_reviews (job_id TEXT PRIMARY KEY REFERENCES illustration_jobs(id) ON DELETE CASCADE, charge_status TEXT NOT NULL CHECK(charge_status IN ('charged','not_charged','unknown')), amount_micro_usd INTEGER CHECK(amount_micro_usd>=0 AND amount_micro_usd<=100000000), evidence_sha256 TEXT NOT NULL, reviewed_at TEXT NOT NULL)")

        sql(c, "CREATE TABLE IF NOT EXISTS illustration_daily_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)")
        sql(c, "CREATE TABLE IF NOT EXISTS illustration_parent_quota (owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, day TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,day))")
        media_type="BYTEA" if IS_PG else "BLOB"
        sql(c, f"CREATE TABLE IF NOT EXISTS illustration_assets (job_id TEXT PRIMARY KEY REFERENCES illustration_jobs(id) ON DELETE CASCADE, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, png_bytes {media_type} NOT NULL, sha256 TEXT NOT NULL, byte_length INTEGER NOT NULL, created_at TEXT NOT NULL)")
        sql(c, "CREATE INDEX IF NOT EXISTS illustration_assets_owner_book_idx ON illustration_assets(owner_id,book_id)")
        # Existing preview databases may already have the ledger without state.
        # Preserve completed tombstones so deleting a book does not make an
        # old, paid request look like a new in-flight operation.
        if IS_PG:
            sql(c, "ALTER TABLE ai_idempotency ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'pending'")
        elif "state" not in [row[1] for row in c.execute("PRAGMA table_info(ai_idempotency)")]:
            c.execute("ALTER TABLE ai_idempotency ADD COLUMN state TEXT NOT NULL DEFAULT 'pending'")
        sql(c, "UPDATE ai_idempotency SET state='completed' WHERE book_id IS NOT NULL AND state='pending'")
        sql(c, "CREATE TABLE IF NOT EXISTS parent_email_status (owner_id TEXT PRIMARY KEY REFERENCES parents(id) ON DELETE CASCADE, verified_at TEXT)")
        sql(c, "CREATE TABLE IF NOT EXISTS email_action_tokens (token_digest TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, purpose TEXT NOT NULL, expires_at INTEGER NOT NULL, used_at INTEGER, issued_at INTEGER NOT NULL)")
        sql(c, "CREATE INDEX IF NOT EXISTS email_action_owner_idx ON email_action_tokens(owner_id,purpose,issued_at)")
        sql(c, "CREATE TABLE IF NOT EXISTS children (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, nickname TEXT NOT NULL, age INTEGER NOT NULL, created_at TEXT NOT NULL)")
        sql(c, "CREATE INDEX IF NOT EXISTS children_owner_idx ON children(owner_id)")
        sql(c, "CREATE TABLE IF NOT EXISTS book_favorites (owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, created_at TEXT NOT NULL, PRIMARY KEY(owner_id,book_id))")
        sql(c, "CREATE TABLE IF NOT EXISTS reading_progress (owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, book_id TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE, page INTEGER NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY(owner_id,book_id))")
        c.commit()

init_schema()

class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=12,max_length=128)

class Token(BaseModel):
    access_token: str
    token_type: str="bearer"

class BookIn(BaseModel):
    title: str=Field(min_length=1,max_length=120)
    child_name: str=Field(min_length=1,max_length=60)
    age: int=Field(ge=2,le=14)
    story: str=Field(min_length=1,max_length=12000)

def encode(data: bytes):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def decode(data: str):
    return base64.urlsafe_b64decode(data + "=" * (-len(data)%4))

def password_hash(password: str):
    salt=secrets.token_bytes(16)
    derived=hashlib.scrypt(password.encode(),salt=salt,n=2**14,r=8,p=1,dklen=32)
    return encode(salt)+"."+encode(derived)

def password_matches(password: str, hashed: str):
    try:
        salt,expected=hashed.split(".")
        result=hashlib.scrypt(password.encode(),salt=decode(salt),n=2**14,r=8,p=1,dklen=32)
        return hmac.compare_digest(result,decode(expected))
    except (ValueError,TypeError,binascii.Error):
        return False

def make_token(parent_id: str):
    expiry=int(time.time())+3600*12
    session_id=str(uuid.uuid4())
    with connection() as c:
        sql(c,"INSERT INTO sessions(id,owner_id,issued_at,expires_at,revoked) VALUES(?,?,?,?,0)",(session_id,parent_id,datetime.now(timezone.utc).isoformat(),expiry))
        c.commit()
    payload=encode(json.dumps({"sub":parent_id,"sid":session_id,"exp":expiry},separators=(",",":")).encode())
    signature=encode(hmac.new(SECRET.encode(),payload.encode(),hashlib.sha256).digest())
    return payload+"."+signature

def current_parent(authorization: str | None=Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,"Authentication required")
    token=authorization[7:]
    # Signed sessions are small; reject oversized values before decoding and hashing.
    if not token or len(token)>4096 or not token.isascii():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,"Invalid or expired token")
    try:
        payload,signature=token.split(".")
        expected=encode(hmac.new(SECRET.encode(),payload.encode(),hashlib.sha256).digest())
        if not hmac.compare_digest(signature,expected):
            raise ValueError("signature")
        data=json.loads(decode(payload))
        if int(data["exp"])<=int(time.time()) or not re.fullmatch(r"[0-9a-f-]{36}",data["sub"]) or not re.fullmatch(r"[0-9a-f-]{36}",data["sid"]):
            raise ValueError("expired or invalid session")
        with connection() as c:
            row=sql(c,"SELECT owner_id FROM sessions WHERE id=? AND owner_id=? AND revoked=0 AND expires_at>?",(data["sid"],data["sub"],int(time.time()))).fetchone()
        if row is None:raise ValueError("session revoked or not found")
        if verification_required():
            with connection() as c:
                verified=sql(c,"SELECT verified_at FROM parent_email_status WHERE owner_id=?",(row[0],)).fetchone()
            if not verified or not verified[0]:
                raise ValueError("email verification required")
        return row[0]
    except (ValueError,TypeError,KeyError,OverflowError,UnicodeDecodeError,binascii.Error,json.JSONDecodeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,"Invalid or expired token")

@app.get("/api/health")
def health():
    return {"ok":True}

@app.get("/api/ready")
def ready():
    """Check that the private application's database is reachable without exposing details."""
    try:
        with connection() as c:
            value=sql(c,"SELECT 1").fetchone()
        if not value or int(value[0])!=1:
            raise RuntimeError("Unexpected database result")
    except Exception:
        raise HTTPException(503,"Database is unavailable")
    return {"ok":True,"database":"connected","email_configured":mail_configured(),"registration_enabled":os.getenv("ENABLE_REGISTRATION","false").lower()=="true" and (not verification_required() or mail_configured()),"password_recovery_enabled":mail_configured()}


LOGIN_WINDOW_SECONDS=15*60
MAX_LOGIN_FAILURES=5

def _email_key(email:str)->str:
    return hmac.new(SECRET.encode(),email.strip().lower().encode(),hashlib.sha256).hexdigest()

def _login_locked(email:str)->bool:
    now=int(time.time())
    with connection() as c:
        row=sql(c,"SELECT window_started,failures FROM login_attempts WHERE email_key=?",(_email_key(email),)).fetchone()
    return bool(row and now-int(row[0])<LOGIN_WINDOW_SECONDS and int(row[1])>=MAX_LOGIN_FAILURES)

def _record_login_failure(email:str)->None:
    now=int(time.time())
    key=_email_key(email)
    with connection() as c:
        sql(c,"INSERT INTO login_attempts(email_key,window_started,failures) VALUES(?,?,1) ON CONFLICT(email_key) DO UPDATE SET failures=CASE WHEN login_attempts.window_started<? THEN 1 ELSE login_attempts.failures+1 END, window_started=CASE WHEN login_attempts.window_started<? THEN excluded.window_started ELSE login_attempts.window_started END",(key,now,now-LOGIN_WINDOW_SECONDS,now-LOGIN_WINDOW_SECONDS))
        c.commit()

def _clear_login_failures(email:str)->None:
    with connection() as c:
        sql(c,"DELETE FROM login_attempts WHERE email_key=?",(_email_key(email),))
        c.commit()

@app.post("/api/auth/register",status_code=201)
def register(body:Credentials):
    if os.getenv("ENABLE_REGISTRATION","false").lower()!="true":
        raise HTTPException(503,"Registration is not enabled")
    required=verification_required()
    if required and not mail_configured():
        raise HTTPException(503,"Email verification provider is not configured")
    email=str(body.email).strip().lower()
    uid=str(uuid.uuid4())
    with connection() as c:
        if sql(c,"SELECT id FROM parents WHERE email=?",(email,)).fetchone():
            raise HTTPException(409,"Account already exists")
        sql(c,"INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",(uid,email,password_hash(body.password),datetime.now(timezone.utc).isoformat()))
        if required:
            token=new_code()
            now=int(time.time())
            sql(c,"INSERT INTO parent_email_status(owner_id,verified_at) VALUES(?,NULL)",(uid,))
            sql(c,"INSERT INTO email_action_tokens(token_digest,owner_id,purpose,expires_at,used_at,issued_at) VALUES(?,?,?,?,NULL,?)",(digest_code(token,SECRET),uid,"verify",now+1800,now))
            try:
                send_account_email(email,token,"verify")
            except Exception as exc:
                raise HTTPException(503,"Email delivery failed") from exc
        else:
            sql(c,"INSERT INTO parent_email_status(owner_id,verified_at) VALUES(?,?)",(uid,datetime.now(timezone.utc).isoformat()))
        c.commit()
    if required:
        return {"status":"verification_sent"}
    return Token(access_token=make_token(uid))

@app.post("/api/auth/login",response_model=Token)
def login(body:Credentials):
    email=str(body.email).lower()
    if _login_locked(email):
        raise HTTPException(429,"Too many login attempts. Try again later.")
    with connection() as c:
        row=sql(c,"SELECT id,password_hash FROM parents WHERE email=?",(email,)).fetchone()
    if not row or not password_matches(body.password,row[1]):
        _record_login_failure(email)
        raise HTTPException(401,"Invalid email or password")
    if verification_required():
        with connection() as c:
            verified=sql(c,"SELECT verified_at FROM parent_email_status WHERE owner_id=?",(row[0],)).fetchone()
        if not verified or not verified[0]:
            raise HTTPException(403,"Email confirmation required")
    _clear_login_failures(email)
    return Token(access_token=make_token(row[0]))

class EmailOnly(BaseModel):
    email: EmailStr

class EmailAction(BaseModel):
    token: str=Field(min_length=35,max_length=100)

class PasswordRecovery(EmailAction):
    new_password: str=Field(min_length=12,max_length=128)

def _consume_email_token(token:str,purpose:str):
    try:
        token_digest=digest_code(token,SECRET)
    except ValueError:
        raise HTTPException(400,"Invalid or expired link")
    with connection() as c:
        result=sql(c,"SELECT owner_id FROM email_action_tokens WHERE token_digest=? AND purpose=? AND used_at IS NULL AND expires_at>?",(token_digest,purpose,int(time.time()))).fetchone()
    if not result:
        raise HTTPException(400,"Invalid or expired link")
    return token_digest,result[0]

@app.post("/api/auth/verify-email")
def verify_email(body:EmailAction):
    digest,owner=_consume_email_token(body.token,"verify")
    now=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        updated=sql(c,"UPDATE email_action_tokens SET used_at=? WHERE token_digest=? AND owner_id=? AND used_at IS NULL AND expires_at>?",(int(time.time()),digest,owner,int(time.time())))
        if updated.rowcount!=1:
            raise HTTPException(400,"Invalid or expired link")
        sql(c,"INSERT INTO parent_email_status(owner_id,verified_at) VALUES(?,?) ON CONFLICT(owner_id) DO UPDATE SET verified_at=excluded.verified_at",(owner,now))
        c.commit()
    return {"status":"verified"}

def _request_email_action(email:str,purpose:str):
    if not mail_configured():
        raise HTTPException(503,"Email delivery provider is not configured")
    now=int(time.time())
    with connection() as c:
        parent=sql(c,"SELECT id FROM parents WHERE email=?",(email,)).fetchone()
        if not parent:return
        owner=parent[0]
        # One live message per purpose every 2 minutes, at most ten in a day.
        recent=sql(c,"SELECT issued_at FROM email_action_tokens WHERE owner_id=? AND purpose=? ORDER BY issued_at DESC LIMIT 10",(owner,purpose)).fetchall()
        if any(now-int(r[0])<120 for r in recent) or sum(now-int(r[0])<86400 for r in recent)>=10:
            return
        token=new_code()
        sql(c,"INSERT INTO email_action_tokens(token_digest,owner_id,purpose,expires_at,used_at,issued_at) VALUES(?,?,?,?,NULL,?)",(digest_code(token,SECRET),owner,purpose,now+1800,now))
        try:
            send_account_email(email,token,purpose)
        except Exception as exc:
            raise HTTPException(503,"Email delivery failed") from exc
        c.commit()

@app.post("/api/auth/resend-verification")
def resend_verification(body:EmailOnly):
    email=str(body.email).strip().lower()
    with connection() as c:
        row=sql(c,"SELECT p.id,v.verified_at FROM parents p LEFT JOIN parent_email_status v ON p.id=v.owner_id WHERE p.email=?",(email,)).fetchone()
    if row and not row[1]:
        _request_email_action(email,"verify")
    return {"status":"if_account_exists_email_sent"}

@app.post("/api/auth/forgot-password")
def forgot_password(body:EmailOnly):
    _request_email_action(str(body.email).strip().lower(),"recover")
    return {"status":"if_account_exists_email_sent"}

@app.post("/api/auth/reset-password")
def reset_password(body:PasswordRecovery):
    digest,owner=_consume_email_token(body.token,"recover")
    with connection() as c:
        updated=sql(c,"UPDATE email_action_tokens SET used_at=? WHERE token_digest=? AND owner_id=? AND used_at IS NULL AND expires_at>?",(int(time.time()),digest,owner,int(time.time())))
        if updated.rowcount!=1:
            raise HTTPException(400,"Invalid or expired link")
        sql(c,"UPDATE parents SET password_hash=? WHERE id=?",(password_hash(body.new_password),owner))
        sql(c,"UPDATE sessions SET revoked=1 WHERE owner_id=?",(owner,))
        sql(c,"DELETE FROM email_action_tokens WHERE owner_id=? AND purpose='recover' AND token_digest<>?",(owner,digest))
        c.commit()
    return {"status":"password_changed"}

def _authenticated_session(authorization:str|None):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401,"Authentication required")
    current_parent(authorization)
    payload=authorization[7:].split(".",1)[0]
    return json.loads(decode(payload))["sid"]

@app.post("/api/auth/logout",status_code=204)
def logout(owner:str=Depends(current_parent),authorization:str|None=Header(default=None)):
    sid=_authenticated_session(authorization)
    with connection() as c:
        sql(c,"UPDATE sessions SET revoked=1 WHERE id=? AND owner_id=?",(sid,owner))
        c.commit()

@app.post("/api/auth/logout-all",status_code=204)
def logout_all(owner:str=Depends(current_parent)):
    with connection() as c:
        sql(c,"UPDATE sessions SET revoked=1 WHERE owner_id=?",(owner,))
        c.commit()

@app.get("/api/auth/sessions")
def list_sessions(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT id,issued_at,expires_at FROM sessions WHERE owner_id=? AND revoked=0 AND expires_at>? ORDER BY issued_at DESC",(owner,int(time.time()))).fetchall()
    return [{"id":row[0],"created_at":row[1],"expires_at":row[2]} for row in rows]

class ChangePassword(BaseModel):
    current_password: str=Field(min_length=12,max_length=128)
    new_password: str=Field(min_length=12,max_length=128)

@app.post("/api/auth/change-password",response_model=Token)
def change_password(body:ChangePassword,owner:str=Depends(current_parent)):
    if body.current_password==body.new_password:
        raise HTTPException(400,"New password must differ from old password")
    with connection() as c:
        row=sql(c,"SELECT password_hash FROM parents WHERE id=?",(owner,)).fetchone()
        if row is None or not password_matches(body.current_password,row[0]):
            raise HTTPException(401,"Invalid current password")
        sql(c,"UPDATE parents SET password_hash=? WHERE id=?",(password_hash(body.new_password),owner))
        sql(c,"UPDATE sessions SET revoked=1 WHERE owner_id=?",(owner,))
        c.commit()
    return Token(access_token=make_token(owner))

@app.get("/api/me")
def me(owner: str=Depends(current_parent)):
    return {"id":owner}

@app.get("/api/billing/status")
def billing_status(owner:str=Depends(current_parent)):
    """Read-only subscription status. Never grant paid entitlements from UI."""
    today=datetime.now(timezone.utc).date().isoformat()
    with connection() as c:
        row=sql(c,"SELECT used FROM generation_quota WHERE owner_id=? AND day=?",(owner,today)).fetchone()
        parent=sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
        global_row=sql(c,"SELECT used FROM generation_global_quota WHERE day=?",(today,)).fetchone()
    allowed={email.strip().lower() for email in os.getenv("AI_ALLOWED_EMAILS","").split(",") if email.strip()}
    pilot=bool(parent and parent[0].lower() in allowed)
    ai_ready=(os.getenv("ENABLE_TEXT_AI","false").lower()=="true" and bool(os.getenv("OPENAI_API_KEY")))
    used=max(0,int(row[0])) if row else 0
    daily_cap=max(0,min(200,int(os.getenv("MAX_AI_STORIES_PER_DAY","10"))))
    global_remaining=max(0,daily_cap-(max(0,int(global_row[0])) if global_row else 0))
    limit=2 if pilot and ai_ready and daily_cap>0 else 0
    return {
        "plan":"free",
        "subscription_status":"not_available",
        "payments_enabled":False,
        "ai_pilot_access":pilot and ai_ready and daily_cap>0,
        "ai_daily_limit":limit,
        "ai_used_today":used,
        "ai_remaining_today":min(max(0,limit-used),global_remaining),
        "quota_period":"daily",
        "quota_timezone":"UTC",
        "pricing_is_proposed":True,
    }

@app.get("/api/books")
def books(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT id,title,child_name,age,story,created_at FROM books WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",(owner,)).fetchall()
    return [{"id":r[0],"title":r[1],"child_name":r[2],"age":r[3],"story":r[4],"created_at":r[5]} for r in rows]

MAX_BOOKS_PER_PARENT=100

@app.post("/api/books",status_code=201)
def create_book(body:BookIn,owner:str=Depends(current_parent)):
    # The endpoint accepts bounded UTF-8 story text, not multipart file uploads.
    if not body.title.strip() or not body.child_name.strip() or not body.story.strip():
        raise HTTPException(422,"Book title, child name, and story must not be blank")
    book_id=str(uuid.uuid4())
    created=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        if IS_PG:
            # Serialize inserts from concurrent requests belonging to one parent.
            sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
        else:
            c.execute("BEGIN IMMEDIATE")
        # Idempotent device-library import. Serialize by parent before checking
        # source_id so concurrent retries cannot create duplicate books.
        source_id=None
        try:
            imported=json.loads(body.story)
            if isinstance(imported,dict) and isinstance(imported.get("source_id"),str):
                candidate=imported["source_id"]
                if re.fullmatch(r"local-[A-Za-z0-9_-]{1,120}",candidate):
                    source_id=candidate
        except (ValueError,TypeError):
            pass
        if source_id:
            existing=sql(c,"SELECT id,created_at,story FROM books WHERE owner_id=?",(owner,)).fetchall()
            for old_id,old_created,old_story in existing:
                try:
                    if json.loads(old_story).get("source_id")==source_id:
                        return {"id":old_id,"created_at":old_created}
                except (ValueError,TypeError,AttributeError):
                    continue
        count=sql(c,"SELECT COUNT(*) FROM books WHERE owner_id=?",(owner,)).fetchone()[0]
        if count>=MAX_BOOKS_PER_PARENT:
            raise HTTPException(409,"Library limit reached")
        sql(c,"INSERT INTO books(id,owner_id,title,child_name,age,story,created_at) VALUES(?,?,?,?,?,?,?)",
            (book_id,owner,body.title.strip(),body.child_name.strip(),body.age,body.story,created))
        c.commit()
    return {"id":book_id,"created_at":created}

# Family profiles store a nickname and approximate age only. No photos or birth dates.
class ChildIn(BaseModel):
    nickname: str=Field(min_length=1,max_length=45)
    age: int=Field(ge=2,le=14)

@app.get("/api/children")
def list_children(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT id,nickname,age,created_at FROM children WHERE owner_id=? ORDER BY created_at DESC",(owner,)).fetchall()
    return [{"id":r[0],"nickname":r[1],"age":r[2],"created_at":r[3]} for r in rows]

@app.post("/api/children",status_code=201)
def add_child(body:ChildIn,owner:str=Depends(current_parent)):
    if not body.nickname.strip():
        raise HTTPException(422,"Child nickname cannot be blank")
    now=datetime.now(timezone.utc).isoformat()
    cid=str(uuid.uuid4())
    with connection() as c:
        # Serialize profile creation per parent: concurrent requests must not
        # bypass the five-child limit by reading the same previous count.
        if IS_PG:
            sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
        else:
            c.execute("BEGIN IMMEDIATE")
        count=sql(c,"SELECT COUNT(*) FROM children WHERE owner_id=?",(owner,)).fetchone()[0]
        if count>=5:
            raise HTTPException(409,"Maximum five child profiles")
        sql(c,"INSERT INTO children(id,owner_id,nickname,age,created_at) VALUES(?,?,?,?,?)",(cid,owner,body.nickname.strip(),body.age,now))
        c.commit()
    return {"id":cid,"nickname":body.nickname.strip(),"age":body.age,"created_at":now}

@app.delete("/api/children/{child_id}",status_code=204)
def remove_child(child_id:str,owner:str=Depends(current_parent)):
    with connection() as c:
        deleted=sql(c,"DELETE FROM children WHERE id=? AND owner_id=?",(child_id,owner))
        if deleted.rowcount==0:
            raise HTTPException(404,"Child profile not found")
        c.commit()

@app.get("/api/books/favorites")
def list_favorites(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT book_id FROM book_favorites WHERE owner_id=? ORDER BY created_at DESC",(owner,)).fetchall()
    return {"ids":[r[0] for r in rows]}

class FavoriteIn(BaseModel):
    favorite: bool

@app.put("/api/books/{book_id}/favorite")
def set_favorite(book_id:str,body:FavoriteIn,owner:str=Depends(current_parent)):
    # Idempotent setter for reconnect retries and ambiguous network responses.
    with connection() as c:
        if not sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone():
            raise HTTPException(404,"Book not found")
        if body.favorite:
            sql(c,"INSERT INTO book_favorites(owner_id,book_id,created_at) VALUES(?,?,?) ON CONFLICT(owner_id,book_id) DO NOTHING",(owner,book_id,datetime.now(timezone.utc).isoformat()))
        else:
            sql(c,"DELETE FROM book_favorites WHERE owner_id=? AND book_id=?",(owner,book_id))
        c.commit()
    return {"book_id":book_id,"favorite":body.favorite}

@app.post("/api/books/{book_id}/favorite")
def toggle_favorite(book_id:str,owner:str=Depends(current_parent)):
    with connection() as c:
        if not sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone():
            raise HTTPException(404,"Book not found")
        existing=sql(c,"SELECT book_id FROM book_favorites WHERE owner_id=? AND book_id=?",(owner,book_id)).fetchone()
        if existing:
            sql(c,"DELETE FROM book_favorites WHERE owner_id=? AND book_id=?",(owner,book_id))
            favorite=False
        else:
            sql(c,"INSERT INTO book_favorites(owner_id,book_id,created_at) VALUES(?,?,?)",(owner,book_id,datetime.now(timezone.utc).isoformat()))
            favorite=True
        c.commit()
    return {"id":book_id,"favorite":favorite}

class ProgressIn(BaseModel):
    page: int=Field(ge=0,le=99)

@app.get("/api/books/progress")
def list_reading_progress(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT book_id,page,updated_at FROM reading_progress WHERE owner_id=? ORDER BY updated_at DESC",(owner,)).fetchall()
    return [{"book_id":r[0],"page":r[1],"updated_at":r[2]} for r in rows]

@app.post("/api/books/{book_id}/progress")
def save_reading_progress(book_id:str,body:ProgressIn,owner:str=Depends(current_parent)):
    with connection() as c:
        row=sql(c,"SELECT story FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone()
        if not row:
            raise HTTPException(404,"Book not found")
        # Guard against nonsensical page numbers when the story is stored as JSON.
        try:
            parsed=json.loads(row[0])
            pages=parsed.get("pages") if isinstance(parsed,dict) else None
            if isinstance(pages,list) and body.page>=len(pages):
                raise HTTPException(422,"Page is outside the story")
        except (json.JSONDecodeError,TypeError):
            pass
        now=datetime.now(timezone.utc).isoformat()
        sql(c,"INSERT INTO reading_progress(owner_id,book_id,page,updated_at) VALUES(?,?,?,?) ON CONFLICT(owner_id,book_id) DO UPDATE SET page=excluded.page,updated_at=excluded.updated_at",(owner,book_id,body.page,now))
        c.commit()
    return {"book_id":book_id,"page":body.page,"updated_at":now}

@app.get("/api/books/{book_id}")
def read_book(book_id:str,owner:str=Depends(current_parent)):
    with connection() as c:
        row=sql(c,"SELECT title,child_name,age,story,created_at FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone()
    if row is None:raise HTTPException(404,"Book not found")
    return {"id":book_id,"title":row[0],"child_name":row[1],"age":row[2],"story":row[3],"created_at":row[4]}

@app.delete("/api/books/{book_id}",status_code=204)
def delete_book(book_id:str,owner:str=Depends(current_parent)):
    with connection() as c:
        result=sql(c,"DELETE FROM books WHERE id=? AND owner_id=?",(book_id,owner))
        if result.rowcount==0:raise HTTPException(404,"Book not found")
        c.commit()

# Text-only AI generation is opt-in. This API is NOT deployed to the public PWA.
# A persistent per-user daily quota prevents unbounded model calls in local testing.
from ai_generation import GenerateStoryInput, generate_story

with connection() as c:
    sql(c, "CREATE TABLE IF NOT EXISTS generation_quota (owner_id TEXT NOT NULL REFERENCES parents(id) ON DELETE CASCADE, day TEXT NOT NULL, used INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(owner_id,day))")
    c.commit()

@app.post("/api/books/generate",status_code=201)
def generate_personalized_book(body:GenerateStoryInput,owner:str=Depends(current_parent),idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    if os.getenv("ENABLE_TEXT_AI","false").lower()!="true":
        raise HTTPException(503,"AI generation is not enabled")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503,"AI provider is not configured")
    # Until verified parent email accounts ship, access requires a manually
    # authorized pilot email (the token alone does not grant paid AI access).
    allowed={x.strip().lower() for x in os.getenv("AI_ALLOWED_EMAILS","").split(",") if x.strip()}
    with connection() as c:
        parent=sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
    if not parent or parent[0].lower() not in allowed:
        raise HTTPException(403,"AI access is not enabled for this account")
    # Optional client request identifier prevents duplicate paid calls after a
    # lost HTTP response. The key never contains child data and is scoped to owner.
    # A crash leaves a pending marker instead of silently charging twice.
    request_key=None
    if idempotency_key is not None:
        if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}",idempotency_key):
            raise HTTPException(422,"Invalid Idempotency-Key")
        request_key=idempotency_key
    payload_digest=hashlib.sha256(body.model_dump_json().encode("utf-8")).hexdigest()
    if request_key:
        with connection() as c:
            inserted=sql(c,"INSERT INTO ai_idempotency(owner_id,request_key,payload_digest,book_id,created_at) VALUES(?,?,?,NULL,?) ON CONFLICT(owner_id,request_key) DO NOTHING RETURNING request_key",(owner,request_key,payload_digest,datetime.now(timezone.utc).isoformat())).fetchone()
            if inserted:
                c.commit()
            else:
                existing=sql(c,"SELECT payload_digest,book_id,state FROM ai_idempotency WHERE owner_id=? AND request_key=?",(owner,request_key)).fetchone()
                if not existing or existing[0]!=payload_digest:
                    raise HTTPException(409,"Idempotency key was used for another request")
                if existing[2]=="completed" and not existing[1]:
                    raise HTTPException(409,"Previously generated book was deleted")
                if not existing[1]:
                    raise HTTPException(409,"Story generation is already processing")
                old=sql(c,"SELECT id,title,story,created_at FROM books WHERE id=? AND owner_id=?",(existing[1],owner)).fetchone()
                if not old:
                    raise HTTPException(409,"Generated book is unavailable")
                stored=json.loads(old[2])
                return {"id":old[0],"title":old[1],"language":stored["language"],"pages":stored["pages"],"created_at":old[3]}

    def release_claim():
        if request_key:
            with connection() as c:
                sql(c,"DELETE FROM ai_idempotency WHERE owner_id=? AND request_key=? AND book_id IS NULL",(owner,request_key))
                c.commit()

    # Replays of already saved books must work even when the library is full.
    # Reject a new generation before spending tokens on an AI provider request.
    # Recheck under the insert lock below to handle concurrent requests.
    with connection() as c:
        existing_books=sql(c,"SELECT COUNT(*) FROM books WHERE owner_id=?",(owner,)).fetchone()[0]
    if existing_books>=MAX_BOOKS_PER_PARENT:
        release_claim()
        raise HTTPException(409,"Library limit reached")
    today=datetime.now(timezone.utc).date().isoformat()
    # Global spending ceiling is separate from the per-parent quota.
    # The value is deliberately conservative until usage and billing are monitored.
    daily_cap=max(0,min(200,int(os.getenv("MAX_AI_STORIES_PER_DAY","10"))))
    if daily_cap==0:
        release_claim()
        raise HTTPException(503,"AI generation is temporarily unavailable")
    try:
        with connection() as c:
            if not IS_PG:
                c.execute("BEGIN IMMEDIATE")
            row=sql(c,"INSERT INTO generation_global_quota(day,used) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET used=generation_global_quota.used+1 WHERE generation_global_quota.used<? RETURNING used",(today,daily_cap)).fetchone()
            if row is None:
                raise HTTPException(429,"Daily AI service limit reached")
            row=sql(c,"INSERT INTO generation_quota(owner_id,day,used) VALUES(?,?,1) ON CONFLICT(owner_id,day) DO UPDATE SET used=generation_quota.used+1 WHERE generation_quota.used<2 RETURNING used",(owner,today)).fetchone()
            if row is None:
                # The global reservation happened in this same transaction. Explicitly
                # roll it back before raising: the connection context otherwise commits
                # a successful global increment even though this parent is at quota.
                c.rollback()
                raise HTTPException(429,"Daily AI story limit reached")
            c.commit()
    except HTTPException:
        # Finish the failed transaction before releasing a pending request key.
        release_claim()
        raise
    try:
        generated=generate_story(body)
    except Exception:
        # A failed provider call must not exhaust the parent's daily allowance.
        # Keep the quota reservation transactionally consistent for concurrent calls.
        with connection() as c:
            if not IS_PG:
                c.execute("BEGIN IMMEDIATE")
            sql(c,"UPDATE generation_quota SET used=used-1 WHERE owner_id=? AND day=? AND used>0",(owner,today))
            sql(c,"UPDATE generation_global_quota SET used=used-1 WHERE day=? AND used>0",(today,))
            c.commit()
        release_claim()
        # Never return internal API errors or provider details to a parent.
        raise HTTPException(502,"Unable to generate this story. Please try later.")
    bid=str(uuid.uuid4())
    now=datetime.now(timezone.utc).isoformat()
    # The private library expects objects with number/text/image_url, not raw strings.
    # Do not imply that custom AI illustrations exist until a private image pipeline ships.
    story_document={
        "version": 1,
        "source_id": bid,
        "language": generated.language,
        "theme": body.classic_title,
        "style": body.style,
        "prompt": body.idea,
        "pages": [
            {"number": index + 1, "text": text, "image_url": ""}
            for index, text in enumerate(generated.pages)
        ],
    }
    try:
        with connection() as c:
            if IS_PG:
                sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
            else:
                c.execute("BEGIN IMMEDIATE")
            current_count=sql(c,"SELECT COUNT(*) FROM books WHERE owner_id=?",(owner,)).fetchone()[0]
            if current_count>=MAX_BOOKS_PER_PARENT:
                raise HTTPException(409,"Library limit reached")
            sql(c,"INSERT INTO books(id,owner_id,title,child_name,age,story,created_at) VALUES(?,?,?,?,?,?,?)",(bid,owner,generated.title,body.name,body.age,json.dumps(story_document,ensure_ascii=False),now))
            if request_key:
                sql(c,"UPDATE ai_idempotency SET book_id=?,state='completed' WHERE owner_id=? AND request_key=? AND payload_digest=?",(bid,owner,request_key,payload_digest))
            c.commit()
    except Exception as exc:
        # A successfully generated story can still fail to save, for example
        # when another request fills the library while the provider is running.
        # Refund the reserved allowance only after the insert has rolled back.
        with connection() as c:
            if not IS_PG:
                c.execute("BEGIN IMMEDIATE")
            sql(c,"UPDATE generation_quota SET used=used-1 WHERE owner_id=? AND day=? AND used>0",(owner,today))
            sql(c,"UPDATE generation_global_quota SET used=used-1 WHERE day=? AND used>0",(today,))
            c.commit()
        release_claim()
        # Do not expose database errors or internal tracebacks to the parent.
        # The 409 conflict is safe and actionable; other persistence failures
        # are reported as a generic service error after quota refund.
        if isinstance(exc,HTTPException) and exc.status_code==409:
            raise exc
        raise HTTPException(503,"Unable to save this story. Please try later.")
    return {"id":bid,"title":generated.title,"language":generated.language,"pages":story_document["pages"],"created_at":now}

@app.get("/api/books/generation-requests/{request_key}")
def generation_request_status(request_key:str,owner:str=Depends(current_parent)):
    """Safely reconcile a lost HTTP response without another paid model call.

    The persistent key is owner-scoped. An unfinished operation older than
    three minutes is UNKNOWN rather than retried: the server may have died
    after the provider charged for an output but before saving it.
    """
    if not re.fullmatch(r"[A-Za-z0-9_-]{16,128}",request_key):
        raise HTTPException(404,"Generation request not found")
    with connection() as c:
        row=sql(c,"SELECT book_id,created_at,state FROM ai_idempotency WHERE owner_id=? AND request_key=?",(owner,request_key)).fetchone()
        if not row:
            raise HTTPException(404,"Generation request not found")
        book_id,created_at,state=row
        if state=="completed" and not book_id:
            return {"status":"unavailable","book_id":None}
        if book_id:
            book=sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone()
            if book:
                return {"status":"completed","book_id":book[0]}
            return {"status":"unavailable","book_id":None}
    try:
        started=datetime.fromisoformat(created_at)
        if started.tzinfo is None:
            raise ValueError("Missing timezone")
        age=(datetime.now(timezone.utc)-started).total_seconds()
    except (ValueError,TypeError):
        age=181
    if age>180:
        return {"status":"needs_review","book_id":None}
    return {"status":"processing","book_id":None}


def _ai_job_status(row):
    job_id,status_value,created_at,started_at,book_id=row
    if status_value=="completed" and book_id is None:
        status_value="unavailable"
    elif status_value=="processing" and started_at:
        try:
            started=datetime.fromisoformat(started_at)
            age=(datetime.now(timezone.utc)-started).total_seconds()
        except (TypeError,ValueError):
            age=181
        if age>180:
            status_value="needs_review"
    return {"id":job_id,"status":status_value,"book_id":book_id if status_value=="completed" else None}


@app.post("/api/books/jobs",status_code=202)
def enqueue_ai_story(body:GenerateStoryInput,owner:str=Depends(current_parent),
                     idempotency_key:str|None=Header(default=None,alias="Idempotency-Key")):
    """Durable, opt-in queue. An independent worker must be deployed separately."""
    if os.getenv("ENABLE_AI_JOBS","false").lower()!="true":
        raise HTTPException(503,"AI job queue is disabled")
    if os.getenv("ENABLE_TEXT_AI","false").lower()!="true" or not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503,"AI provider is unavailable")
    if not idempotency_key or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}",idempotency_key):
        raise HTTPException(422,"Valid Idempotency-Key is required")
    allowed={x.strip().lower() for x in os.getenv("AI_ALLOWED_EMAILS","").split(",") if x.strip()}
    payload=body.model_dump_json()
    digest=hashlib.sha256(payload.encode("utf-8")).hexdigest()
    with connection() as c:
        if IS_PG:
            parent=sql(c,"SELECT email FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
        else:
            c.execute("BEGIN IMMEDIATE")
            parent=sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
        if not parent or parent[0].lower() not in allowed:
            raise HTTPException(403,"AI access is not enabled for this account")
        existing=sql(c,"SELECT id,status,created_at,started_at,book_id,payload_digest FROM ai_jobs WHERE owner_id=? AND request_key=?",(owner,idempotency_key)).fetchone()
        if existing:
            if existing[5]!=digest:
                raise HTTPException(409,"Idempotency key was used for another request")
            return _ai_job_status(existing[:5])
        active=sql(c,"SELECT COUNT(*) FROM ai_jobs WHERE owner_id=? AND status IN ('queued','processing')",(owner,)).fetchone()[0]
        if active>=2:
            raise HTTPException(429,"Too many unfinished AI jobs")
        count=sql(c,"SELECT COUNT(*) FROM books WHERE owner_id=?",(owner,)).fetchone()[0]
        if count>=MAX_BOOKS_PER_PARENT:
            raise HTTPException(409,"Library limit reached")
        job_id=str(uuid.uuid4())
        created=datetime.now(timezone.utc).isoformat()
        sql(c,"INSERT INTO ai_jobs(id,owner_id,request_key,payload_digest,payload,status,created_at) VALUES(?,?,?,?,?,'queued',?)",(job_id,owner,idempotency_key,digest,payload,created))
        c.commit()
    return {"id":job_id,"status":"queued","book_id":None}


@app.get("/api/ai/jobs")
def list_parent_ai_jobs(owner:str=Depends(current_parent)):
    """Recovery after a browser reload: no prompts, keys, or private story text."""
    with connection() as c:
        rows=sql(c,"SELECT id,status,created_at,started_at,book_id FROM ai_jobs WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 20",(owner,)).fetchall()
    return [_ai_job_status(row) for row in rows]


@app.get("/api/books/jobs/{job_id}")
def ai_job_for_parent(job_id:str,owner:str=Depends(current_parent)):
    if not re.fullmatch(r"[0-9a-f-]{36}",job_id):
        raise HTTPException(404,"AI job not found")
    with connection() as c:
        row=sql(c,"SELECT id,status,created_at,started_at,book_id FROM ai_jobs WHERE id=? AND owner_id=?",(job_id,owner)).fetchone()
    if not row:
        raise HTTPException(404,"AI job not found")
    return _ai_job_status(row)


@app.delete("/api/books/jobs/{job_id}",status_code=204)
def cancel_queued_ai_job(job_id:str,owner:str=Depends(current_parent)):
    """Only a not-yet-claimed job can be canceled without billing ambiguity."""
    if not re.fullmatch(r"[0-9a-f-]{36}",job_id):
        raise HTTPException(404,"AI job not found")
    with connection() as c:
        deleted=sql(c,"DELETE FROM ai_jobs WHERE id=? AND owner_id=? AND status='queued'",(job_id,owner))
        if deleted.rowcount==1:
            c.commit()
            return
        exists=sql(c,"SELECT status FROM ai_jobs WHERE id=? AND owner_id=?",(job_id,owner)).fetchone()
        if not exists:
            raise HTTPException(404,"AI job not found")
        raise HTTPException(409,"Only queued jobs can be canceled")


def process_one_queued_ai_job():
    """Called only from an operator-managed worker, not from an HTTP handler.

    A crashed processing job is deliberately never automatically reclaimed;
    billing may have occurred outside the database transaction.
    """
    if os.getenv("ENABLE_AI_JOBS","false").lower()!="true":
        raise RuntimeError("AI job queue is disabled")
    with connection() as c:
        if not IS_PG:
            c.execute("BEGIN IMMEDIATE")
        query="SELECT id,owner_id,request_key,payload FROM ai_jobs WHERE status='queued' ORDER BY created_at,id LIMIT 1"
        if IS_PG:
            query+=" FOR UPDATE SKIP LOCKED"
        row=sql(c,query).fetchone()
        if not row:
            return None
        job_id,owner,key,payload=row
        now=datetime.now(timezone.utc).isoformat()
        sql(c,"UPDATE ai_jobs SET status='processing',started_at=? WHERE id=? AND status='queued'",(now,job_id))
        c.commit()
    try:
        story=GenerateStoryInput.model_validate_json(payload)
        result=generate_personalized_book(story,owner,key)
        with connection() as c:
            sql(c,"UPDATE ai_jobs SET status='completed',completed_at=?,book_id=?,payload='' WHERE id=? AND status='processing'",(datetime.now(timezone.utc).isoformat(),result["id"],job_id))
            c.commit()
        return job_id
    except HTTPException as exc:
        # A 409 may mean an uncertain already-running upstream call.
        final="needs_review" if exc.status_code==409 else "failed"
        with connection() as c:
            sql(c,"UPDATE ai_jobs SET status=?,completed_at=?,payload='' WHERE id=? AND status='processing'",(final,datetime.now(timezone.utc).isoformat(),job_id))
            c.commit()
        return job_id
    except Exception:
        # Unknown failure, including a persistence/network partition. Fail closed.
        with connection() as c:
            sql(c,"UPDATE ai_jobs SET status='needs_review',completed_at=?,payload='' WHERE id=? AND status='processing'",(datetime.now(timezone.utc).isoformat(),job_id))
            c.commit()
        return job_id


PHOTO_CONSENT_VERSION="photo-reference-v1"


def photo_consent_active(owner:str,c=None)->bool:
    """A distinct, opt-in permission for future child reference photographs.

    This does not enable an upload API or grant permission for other media.
    """
    try:
        if c is not None:
            row=sql(c,"SELECT policy_version,granted_at,revoked_at FROM photo_parent_consent WHERE owner_id=?",(owner,)).fetchone()
        else:
            with connection() as db:
                row=sql(db,"SELECT policy_version,granted_at,revoked_at FROM photo_parent_consent WHERE owner_id=?",(owner,)).fetchone()
        return bool(row and row[0]==PHOTO_CONSENT_VERSION and row[1] and not row[2])
    except Exception:
        return False


PHOTO_EXTERNAL_TRANSFER_VERSION="photo-external-ai-v1"


def external_photo_transfer_consent_active(owner:str,c=None)->bool:
    """Separate external processing opt-in, requiring current local photo consent.

    A true result does NOT activate an image provider or authorize a worker
    automatically. Future processing must enforce consent at execution time.
    """
    try:
        if c is None:
            with connection() as db:
                return external_photo_transfer_consent_active(owner,db)
        if not photo_consent_active(owner,c):
            return False
        row=sql(c,"SELECT policy_version,granted_at,revoked_at FROM photo_external_transfer_consent WHERE owner_id=?",(owner,)).fetchone()
        return bool(row and row[0]==PHOTO_EXTERNAL_TRANSFER_VERSION and row[1] and not row[2])
    except Exception:
        return False


class ExternalPhotoTransferConsentRequest(BaseModel):
    agreed: bool
    policy_version: str=Field(min_length=1,max_length=64)
    acknowledged_provider_transfer: bool=False


@app.get("/api/photos/external-transfer-consent")
def get_external_photo_transfer_consent(owner:str=Depends(current_parent)):
    return {"agreed":external_photo_transfer_consent_active(owner),
            "policy_version":PHOTO_EXTERNAL_TRANSFER_VERSION,
            "external_photo_processing_enabled":False}


@app.post("/api/photos/external-transfer-consent")
def update_external_photo_transfer_consent(body:ExternalPhotoTransferConsentRequest,
                                          owner:str=Depends(current_parent)):
    """Parent explicitly opts into potential external processing or revokes it.

    Never calls a provider. No upload feature is enabled by giving consent.
    """
    if body.policy_version!=PHOTO_EXTERNAL_TRANSFER_VERSION:
        raise HTTPException(422,"External photo consent policy version is outdated")
    if body.agreed and body.acknowledged_provider_transfer is not True:
        raise HTTPException(422,"Explicit external provider acknowledgement required")
    now=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        if IS_PG:
            if not sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone():
                raise HTTPException(404,"Parent not found")
        else:
            c.execute("BEGIN IMMEDIATE")
        if body.agreed and not photo_consent_active(owner,c):
            raise HTTPException(403,"Photo-specific parental consent is required")
        if body.agreed:
            sql(c,("INSERT INTO photo_external_transfer_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,?,NULL) ON CONFLICT(owner_id) DO UPDATE SET "
                   "policy_version=excluded.policy_version,granted_at=excluded.granted_at,revoked_at=NULL"),
                (owner,PHOTO_EXTERNAL_TRANSFER_VERSION,now))
        else:
            sql(c,("INSERT INTO photo_external_transfer_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,NULL,?) ON CONFLICT(owner_id) DO UPDATE SET "
                   "policy_version=excluded.policy_version,granted_at=NULL,revoked_at=excluded.revoked_at"),
                (owner,PHOTO_EXTERNAL_TRANSFER_VERSION,now))
            # No previously consented reference may be reused after revocation.
            sql(c,"DELETE FROM photo_reference_temp WHERE owner_id=?",(owner,))
            sql(c,"UPDATE photo_illustration_requests SET status='cancelled' WHERE owner_id=? AND status='pending_review'",(owner,))
        c.commit()
    return {"agreed":body.agreed,"policy_version":PHOTO_EXTERNAL_TRANSFER_VERSION,
            "external_photo_processing_enabled":False}


PHOTO_REQUEST_POLICY_VERSION="photo-request-review-v1"


def expire_photo_illustration_requests(c):
    """Never leave a pending image request behind after portrait expiry."""
    sql(c,"UPDATE photo_illustration_requests SET status='cancelled' WHERE status='pending_review' AND expires_at<=?",(int(time.time()),))


class PhotoIllustrationRequest(BaseModel):
    book_id: str=Field(min_length=36,max_length=36)
    page_number: int=Field(ge=1,le=20)
    style: str=Field(default="storybook",pattern=r"^(watercolor|storybook|pencil)$")
    hero_mode: str=Field(default="storybook",pattern=r"^(explorer|astronaut|storybook)$")


@app.post("/api/photos/illustration-requests",status_code=202)
def create_photo_illustration_request(body:PhotoIllustrationRequest,owner:str=Depends(current_parent)):
    """Prepare an internal-only review record; NEVER enqueue a model call.

    This does not initiate paid processing. Existing photo consent, external
    transfer consent, and a fresh sanitized reference are all mandatory.
    """
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Private photo illustration requests are disabled")
    try:
        book_id=str(uuid.UUID(body.book_id))
    except (ValueError,TypeError,AttributeError):
        raise HTTPException(422,"Invalid book ID")
    now=int(time.time())
    with connection() as c:
        if IS_PG:
            if not sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone():
                raise HTTPException(404,"Parent not found")
        else:
            c.execute("BEGIN IMMEDIATE")
        expire_photo_references(c)
        expire_photo_illustration_requests(c)
        book=sql(c,"SELECT story FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone()
        if not book:
            raise HTTPException(404,"Private book not found")
        try:
            data=json.loads(book[0])
            pages=data["pages"]
            if (not isinstance(pages,list) or len(pages) not in (8,12,20)
                or body.page_number>len(pages)
                or any(not isinstance(page,dict) or page.get("number")!=i+1
                       or not isinstance(page.get("text"),str) or not page["text"].strip()
                       for i,page in enumerate(pages))):
                raise ValueError("Invalid private story")
        except (ValueError,TypeError,KeyError):
            raise HTTPException(422,"Private book is not eligible for personal illustration")
        if not photo_consent_active(owner,c) or not external_photo_transfer_consent_active(owner,c):
            raise HTTPException(403,"Both parental photo permissions are required")
        photo=sql(c,"SELECT sha256,expires_at FROM photo_reference_temp WHERE owner_id=? AND expires_at>?",
                  (owner,now)).fetchone()
        if not photo:
            raise HTTPException(409,"A fresh reference photo is required")
        # A review request expires with its exact reference and never includes
        # its bytes, any child name, account email, or chapter text.
        existing=sql(c,"SELECT id,status,reference_sha256,expires_at FROM photo_illustration_requests "
                       "WHERE owner_id=? AND book_id=? AND page_number=? AND style=? AND hero_mode=?",
                     (owner,book_id,body.page_number,body.style,body.hero_mode)).fetchone()
        if existing and existing[1]=="pending_review" and existing[2]==photo[0] and existing[3]>now:
            c.commit()
            return {"id":existing[0],"status":"pending_review","generation_enabled":False,"expires_at":existing[3]}
        pending=sql(c,"SELECT COUNT(*) FROM photo_illustration_requests WHERE owner_id=? AND status='pending_review' AND expires_at>?",
                    (owner,now)).fetchone()[0]
        if pending>=2:
            raise HTTPException(429,"Too many pending photo review requests")
        job_id=str(uuid.uuid4())
        sql(c,("INSERT INTO photo_illustration_requests(id,owner_id,book_id,page_number,style,hero_mode,reference_sha256,status,created_at,expires_at) "
               "VALUES(?,?,?,?,?,?,?,'pending_review',?,?) ON CONFLICT(owner_id,book_id,page_number,style,hero_mode) DO UPDATE SET "
               "id=excluded.id,reference_sha256=excluded.reference_sha256,status='pending_review',"
               "created_at=excluded.created_at,expires_at=excluded.expires_at"),
            (job_id,owner,book_id,body.page_number,body.style,body.hero_mode,photo[0],now,int(photo[1])))
        c.commit()
    return {"id":job_id,"status":"pending_review","generation_enabled":False,"expires_at":int(photo[1])}


@app.get("/api/photos/illustration-requests")
def list_photo_illustration_requests(owner:str=Depends(current_parent)):
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Private photo illustration requests are disabled")
    with connection() as c:
        expire_photo_illustration_requests(c)
        rows=sql(c,"SELECT id,book_id,page_number,status,expires_at FROM photo_illustration_requests "
                   "WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 20",(owner,)).fetchall()
        c.commit()
    return [{"id":r[0],"book_id":r[1],"page_number":r[2],"status":r[3],
             "expires_at":r[4],"generation_enabled":False} for r in rows]


@app.delete("/api/photos/illustration-requests/{request_id}",status_code=204)
def cancel_photo_illustration_request(request_id:str,owner:str=Depends(current_parent)):
    try:
        request_id=str(uuid.UUID(request_id))
    except (ValueError,TypeError):
        raise HTTPException(404,"Request not found")
    with connection() as c:
        changed=sql(c,"UPDATE photo_illustration_requests SET status='cancelled' "
                      "WHERE id=? AND owner_id=? AND status='pending_review'",(request_id,owner))
        if changed.rowcount!=1:
            raise HTTPException(404,"Pending request not found")
        c.commit()
    return Response(status_code=204)


PHOTO_REFERENCE_TTL_SECONDS=900


def photo_reference_upload_enabled()->bool:
    """Explicitly local development only. Never expose this gate in deployed APIs."""
    return (APP_ENV=="development" and
            os.getenv("ENABLE_DEV_PHOTO_UPLOAD","false").lower()=="true")


def expire_photo_references(c):
    """Delete expired portraits whenever the preview-only route is accessed."""
    sql(c,"DELETE FROM photo_reference_temp WHERE expires_at<=?",(int(time.time()),))


@app.post("/api/photos/reference",status_code=201)
async def upload_photo_reference(request:Request,owner:str=Depends(current_parent)):
    """Temporarily keep one sanitized portrait for one parent, never send to AI.

    Raw request streaming avoids multipart spooling raw child photographs to disk.
    This route is disabled by default and impossible in preview/production.
    """
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Photo uploads are unavailable")
    if (request.headers.get("content-type","").split(";")[0].strip().lower()
            not in ("image/jpeg","image/png","image/webp")):
        raise HTTPException(415,"Unsupported photo media type")
    length=request.headers.get("content-length")
    if length:
        try:
            if int(length)>MAX_UPLOAD_BYTES or int(length)<1:
                raise HTTPException(413,"Photo exceeds size limit")
        except ValueError:
            raise HTTPException(400,"Invalid content length")
    total=0
    chunks=[]
    async for part in request.stream():
        total+=len(part)
        if total>MAX_UPLOAD_BYTES:
            raise HTTPException(413,"Photo exceeds size limit")
        chunks.append(part)
    try:
        clean=normalize_private_reference_photo(b"".join(chunks))
    except ValueError:
        raise HTTPException(422,"Invalid photo")
    # Never store the source bytes, metadata, filename or user-supplied MIME.
    now=int(time.time())
    expires=now+PHOTO_REFERENCE_TTL_SECONDS
    with connection() as c:
        if IS_PG:
            sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
        else:
            c.execute("BEGIN IMMEDIATE")
        expire_photo_references(c)
        if not photo_consent_active(owner,c):
            raise HTTPException(403,"Photo-specific parental consent is required")
        digest=hashlib.sha256(clean).hexdigest()
        sql(c,"UPDATE photo_illustration_requests SET status='cancelled' WHERE owner_id=? AND status='pending_review'",(owner,))
        sql(c,("INSERT INTO photo_reference_temp(owner_id,jpeg_bytes,sha256,created_at,expires_at) "
               "VALUES(?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET "
               "jpeg_bytes=excluded.jpeg_bytes,sha256=excluded.sha256,"
               "created_at=excluded.created_at,expires_at=excluded.expires_at"),
            (owner,clean,digest,now,expires))
        c.commit()
    return {"stored":True,"expires_at":expires,"photo_generation_enabled":False}


@app.get("/api/photos/reference")
def photo_reference_status(owner:str=Depends(current_parent)):
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Photo uploads are unavailable")
    with connection() as c:
        expire_photo_references(c)
        row=sql(c,"SELECT expires_at FROM photo_reference_temp WHERE owner_id=?",(owner,)).fetchone()
        c.commit()
    return {"stored":bool(row),"expires_at":row[0] if row else None,
            "photo_generation_enabled":False}


@app.get("/api/photos/reference/preview")
def private_photo_visual_preview(owner:str=Depends(current_parent)):
    """Development-only offline illustration effect for the signed-in parent.

    No AI provider, original portrait, or processed preview is returned unless
    the correct parent is authenticated and has currently active photo consent.
    No output is written to disk, cache or user library.
    """
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Photo preview is unavailable")
    with connection() as c:
        if not IS_PG:
            c.execute("BEGIN IMMEDIATE")
        expire_photo_references(c)
        if not photo_consent_active(owner,c):
            c.commit()
            raise HTTPException(403,"Photo-specific parental consent is required")
        row=sql(c,"SELECT jpeg_bytes,sha256 FROM photo_reference_temp WHERE owner_id=? AND expires_at>?",
                (owner,int(time.time()))).fetchone()
        c.commit()
    if not row:
        raise HTTPException(404,"Photo reference not found")
    payload=bytes(row[0])
    if not hmac.compare_digest(hashlib.sha256(payload).hexdigest(),row[1]):
        raise HTTPException(503,"Photo reference failed integrity verification")
    from private_photo_preview import render_local_portrait_preview
    clean=render_local_portrait_preview(payload)
    return Response(content=clean,media_type="image/png",headers={
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'none'; sandbox",
    })


@app.get("/api/photos/reference/pages/{page_number}")
def private_photo_storyboard_page(page_number:int,page_count:int=8,
                                  owner:str=Depends(current_parent)):
    """Local-only page mock-up with identical photo crop; NOT an AI image.

    One parent, one current consent, one unexpired reference. No child photo
    leaves the API, no page content is sent to a provider, no artwork is saved.
    """
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Photo storyboard is unavailable")
    if page_count not in (8,12,20) or not 1<=page_number<=page_count:
        raise HTTPException(422,"Unsupported storyboard page")
    with connection() as c:
        if not IS_PG:
            c.execute("BEGIN IMMEDIATE")
        expire_photo_references(c)
        if not photo_consent_active(owner,c):
            c.commit()
            raise HTTPException(403,"Photo-specific parental consent is required")
        row=sql(c,"SELECT jpeg_bytes,sha256 FROM photo_reference_temp WHERE owner_id=? AND expires_at>?",
                (owner,int(time.time()))).fetchone()
        c.commit()
    if not row:
        raise HTTPException(404,"Photo reference not found")
    source=bytes(row[0])
    if not hmac.compare_digest(hashlib.sha256(source).hexdigest(),row[1]):
        raise HTTPException(503,"Photo reference failed integrity verification")
    from private_photo_preview import render_local_story_page
    try:
        image=render_local_story_page(source,page_number,page_count)
    except ValueError:
        raise HTTPException(422,"Invalid storyboard reference")
    return Response(content=image,media_type="image/png",headers={
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'none'; sandbox",
    })


@app.get("/api/photos/books/{book_id}/pages/{page_number}/preview")
def private_book_photo_page_preview(book_id:str,page_number:int,
                                    owner:str=Depends(current_parent)):
    """Development-only story-aware mock-up for a private book and portrait.

    Scene selection is local: never transmit child's name, chapter text or
    reference image to an image provider. Return a transient uncached PNG only.
    This is a PHOTO mock-up, not a likeness-preserving AI illustration.
    """
    if not photo_reference_upload_enabled():
        raise HTTPException(503,"Personalized book preview is unavailable")
    if not re.fullmatch(r"[0-9a-f-]{36}",book_id) or not 1<=page_number<=20:
        raise HTTPException(404,"Book page not found")
    with connection() as c:
        if not IS_PG:
            c.execute("BEGIN IMMEDIATE")
        expire_photo_references(c)
        book=sql(c,"SELECT story FROM books WHERE id=? AND owner_id=?",
                 (book_id,owner)).fetchone()
        if not book:
            c.commit()
            raise HTTPException(404,"Book page not found")
        if not photo_consent_active(owner,c):
            c.commit()
            raise HTTPException(403,"Photo-specific parental consent is required")
        source=sql(c,"SELECT jpeg_bytes,sha256 FROM photo_reference_temp "
                       "WHERE owner_id=? AND expires_at>?",
                   (owner,int(time.time()))).fetchone()
        c.commit()
    if not source:
        raise HTTPException(404,"Photo reference not found")
    photo=bytes(source[0])
    if not hmac.compare_digest(hashlib.sha256(photo).hexdigest(),source[1]):
        raise HTTPException(503,"Photo reference failed integrity verification")
    try:
        from illustration_planning import SCENES,plan_story_illustrations
        from private_photo_preview import render_local_story_page
        record=json.loads(book[0])
        pages=record["pages"]
        if not isinstance(pages,list) or len(pages) not in (8,12,20):
            raise ValueError("Unsupported story length")
        if page_number>len(pages):
            raise ValueError("Page outside the private story")
        if any(not isinstance(page,dict) or page.get("number")!=i+1 or
               not isinstance(page.get("text"),str)
               for i,page in enumerate(pages)):
            raise ValueError("Invalid private story format")
        chapters=[page["text"] for page in pages]
        briefs=plan_story_illustrations(book_id,chapters,"storybook")
        scene_number=SCENES.index(briefs[page_number-1].scene)+1
        media=render_local_story_page(photo,page_number,len(pages),
                                      scene_number=scene_number)
    except (ValueError,TypeError,KeyError,IndexError):
        raise HTTPException(422,"Private story cannot be previewed")
    return Response(content=media,media_type="image/png",headers={
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'none'; sandbox",
    })


@app.delete("/api/photos/reference",status_code=204)
def delete_photo_reference(owner:str=Depends(current_parent)):
    # Permit deleting already stored data even after disabling the upload feature.
    with connection() as c:
        sql(c,"DELETE FROM photo_reference_temp WHERE owner_id=?",(owner,))
        sql(c,"UPDATE photo_illustration_requests SET status='cancelled' WHERE owner_id=? AND status='pending_review'",(owner,))
        c.commit()
    return Response(status_code=204)


class PhotoConsentRequest(BaseModel):
    agreed: bool
    policy_version: str=Field(min_length=1,max_length=64)


@app.get("/api/photos/consent")
def get_photo_consent(owner:str=Depends(current_parent)):
    """Read a parent-scoped permission; no photograph is stored or exposed."""
    return {"agreed":photo_consent_active(owner),"policy_version":PHOTO_CONSENT_VERSION,
            "photo_upload_enabled":photo_reference_upload_enabled()}


@app.post("/api/photos/consent")
def update_photo_consent(body:PhotoConsentRequest,owner:str=Depends(current_parent)):
    """Explicit opt-in or revocation. Never triggers uploads or provider calls."""
    if body.policy_version!=PHOTO_CONSENT_VERSION:
        raise HTTPException(422,"Photo consent policy version is outdated")
    now=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        if IS_PG:
            if not sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone():
                raise HTTPException(404,"Parent not found")
        else:
            c.execute("BEGIN IMMEDIATE")
        if body.agreed:
            sql(c,("INSERT INTO photo_parent_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,?,NULL) ON CONFLICT(owner_id) DO UPDATE SET "
                   "policy_version=excluded.policy_version,granted_at=excluded.granted_at,revoked_at=NULL"),
                (owner,PHOTO_CONSENT_VERSION,now))
        else:
            sql(c,("INSERT INTO photo_parent_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,NULL,?) ON CONFLICT(owner_id) DO UPDATE SET "
                   "policy_version=excluded.policy_version,granted_at=NULL,revoked_at=excluded.revoked_at"),
                (owner,PHOTO_CONSENT_VERSION,now))
            sql(c,"DELETE FROM photo_reference_temp WHERE owner_id=?",(owner,))
            sql(c,"UPDATE photo_illustration_requests SET status='cancelled' WHERE owner_id=? AND status='pending_review'",(owner,))
            sql(c,("INSERT INTO photo_external_transfer_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,NULL,?) ON CONFLICT(owner_id) DO UPDATE SET "
                   "policy_version=excluded.policy_version,granted_at=NULL,revoked_at=excluded.revoked_at"),
                (owner,PHOTO_EXTERNAL_TRANSFER_VERSION,now))
        c.commit()
    return {"agreed":body.agreed,"policy_version":PHOTO_CONSENT_VERSION,
            "photo_upload_enabled":photo_reference_upload_enabled()}


ILLUSTRATION_CONSENT_VERSION="illustration-pilot-v1"


def illustration_consent_active(owner:str,c=None)->bool:
    """No implicit or inherited consent. Check current policy revision."""
    try:
        if c is not None:
            row=sql(c,"SELECT policy_version,granted_at,revoked_at FROM illustration_parent_consent WHERE owner_id=?",(owner,)).fetchone()
        else:
            with connection() as db:
                row=sql(db,"SELECT policy_version,granted_at,revoked_at FROM illustration_parent_consent WHERE owner_id=?",(owner,)).fetchone()
        return bool(row and row[0]==ILLUSTRATION_CONSENT_VERSION and row[1] and not row[2])
    except Exception:
        return False


class IllustrationConsentRequest(BaseModel):
    agreed: bool
    policy_version: str=Field(min_length=1,max_length=64)


@app.get("/api/illustrations/consent")
def get_illustration_consent(owner:str=Depends(current_parent)):
    return {"agreed":illustration_consent_active(owner),"policy_version":ILLUSTRATION_CONSENT_VERSION}


@app.post("/api/illustrations/consent")
def update_illustration_consent(body:IllustrationConsentRequest,owner:str=Depends(current_parent)):
    """Explicit opt-in or revocation by the signed-in parent.

    Revocation removes unstarted jobs and quarantines in-flight jobs, without
    refunding quotas or erasing past image assets.
    """
    if body.policy_version!=ILLUSTRATION_CONSENT_VERSION:
        raise HTTPException(422,"Consent policy version is outdated")
    now=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        if IS_PG:
            if not sql(c,"SELECT id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone():
                raise HTTPException(404,"Parent not found")
        else:
            c.execute("BEGIN IMMEDIATE")
        if body.agreed:
            sql(c,("INSERT INTO illustration_parent_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,?,NULL) ON CONFLICT(owner_id) DO UPDATE SET policy_version=excluded.policy_version,granted_at=excluded.granted_at,revoked_at=NULL"),
                (owner,ILLUSTRATION_CONSENT_VERSION,now))
        else:
            sql(c,("INSERT INTO illustration_parent_consent(owner_id,policy_version,granted_at,revoked_at) "
                   "VALUES(?,?,NULL,?) ON CONFLICT(owner_id) DO UPDATE SET policy_version=excluded.policy_version,granted_at=NULL,revoked_at=excluded.revoked_at"),
                (owner,ILLUSTRATION_CONSENT_VERSION,now))
            sql(c,"DELETE FROM illustration_jobs WHERE owner_id=? AND status='queued'",(owner,))
            rows=sql(c,"SELECT id FROM illustration_jobs WHERE owner_id=? AND status='processing'",(owner,)).fetchall()
            for (job_id,) in rows:
                changed=sql(c,"UPDATE illustration_jobs SET status='needs_review',completed_at=? WHERE id=? AND status='processing'",(now,job_id))
                if changed.rowcount:
                    sql(c,"INSERT INTO illustration_job_events(id,job_id,event,created_at) VALUES(?,?,?,?)",
                        (str(uuid.uuid4()),job_id,"needs_review",now))
        c.commit()
    return {"agreed":body.agreed,"policy_version":ILLUSTRATION_CONSENT_VERSION}


class IllustrationRequest(BaseModel):
    book_id: str=Field(min_length=36,max_length=36)
    page_number: int=Field(ge=1,le=20)
    style: str=Field(default="watercolor",pattern=r"^(watercolor|storybook|pencil)$")


@app.post("/api/illustrations/jobs",status_code=202)
def request_private_illustration(body:IllustrationRequest,owner:str=Depends(current_parent)):
    """Queue an illustration for an existing private story page, without AI calls.

    The feature is intentionally off until private storage, image moderation,
    consent and a separate billed provider worker are reviewed.
    """
    if os.getenv("ENABLE_AI_ILLUSTRATIONS","false").lower()!="true":
        raise HTTPException(503,"AI illustrations are not enabled")
    if not re.fullmatch(r"[0-9a-f-]{36}",body.book_id):
        raise HTTPException(422,"Invalid book ID")
    allowed={v.strip().lower() for v in os.getenv("AI_ALLOWED_EMAILS","").split(",") if v.strip()}
    with connection() as c:
        if IS_PG:
            parent=sql(c,"SELECT email FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
        else:
            c.execute("BEGIN IMMEDIATE")
            parent=sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
        if not parent or parent[0].lower() not in allowed:
            raise HTTPException(403,"AI illustrations are not enabled for this account")
        if not illustration_consent_active(owner,c):
            raise HTTPException(403,"Parental illustration consent is required")
        row=sql(c,"SELECT story FROM books WHERE id=? AND owner_id=?",(body.book_id,owner)).fetchone()
        if not row:
            raise HTTPException(404,"Book not found")
        try:
            data=json.loads(row[0])
            pages=data.get("pages") if isinstance(data,dict) else None
        except (ValueError,TypeError):
            pages=None
        if not isinstance(pages,list) or body.page_number>len(pages):
            raise HTTPException(422,"The book page cannot be illustrated")
        selected=pages[body.page_number-1]
        if not isinstance(selected,dict) or not isinstance(selected.get("text"),str) or not selected["text"].strip():
            raise HTTPException(422,"The book page has no text")
        existing=sql(c,"SELECT id,status FROM illustration_jobs WHERE owner_id=? AND book_id=? AND page_number=? AND style=?",(owner,body.book_id,body.page_number,body.style)).fetchone()
        if existing:
            return {"id":existing[0],"status":existing[1],"book_id":body.book_id,"page_number":body.page_number}
        # A bounded backlog prevents account-level job flooding before costs
        # can be reconciled. Enqueueing alone never invokes a provider.
        count=sql(c,"SELECT COUNT(*) FROM illustration_jobs WHERE owner_id=? AND status IN ('queued','processing')",(owner,)).fetchone()[0]
        if count>=2:
            raise HTTPException(429,"Too many unfinished illustration jobs")
        job_id=str(uuid.uuid4())
        now=datetime.now(timezone.utc).isoformat()
        sql(c,"INSERT INTO illustration_jobs(id,owner_id,book_id,page_number,style,status,created_at) VALUES(?,?,?,?,?,'queued',?)",(job_id,owner,body.book_id,body.page_number,body.style,now))
        sql(c,"INSERT INTO illustration_job_events(id,job_id,event,created_at) VALUES(?,?,?,?)",(str(uuid.uuid4()),job_id,"queued",now))
        c.commit()
    return {"id":job_id,"status":"queued","book_id":body.book_id,"page_number":body.page_number}


@app.get("/api/illustrations/jobs")
def list_private_illustrations(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT id,status,book_id,page_number FROM illustration_jobs WHERE owner_id=? ORDER BY created_at DESC,id DESC LIMIT 20",(owner,)).fetchall()
    return [{"id":r[0],"status":r[1],"book_id":r[2],"page_number":r[3]} for r in rows]


@app.get("/api/illustrations/books/{book_id}/pages/{page_number}")
def private_illustration_for_page(book_id:str,page_number:int,owner:str=Depends(current_parent)):
    """Return a completed media identifier for an owned private page.

    Never provide an unauthenticated public asset URL. Absence of an image and
    absence of a private book are intentionally indistinguishable.
    """
    if not re.fullmatch(r"[0-9a-f-]{36}",book_id) or page_number<1 or page_number>20:
        raise HTTPException(404,"Illustration not found")
    with connection() as c:
        row=sql(c,"SELECT j.id FROM illustration_jobs j JOIN illustration_assets a ON a.job_id=j.id JOIN books b ON b.id=j.book_id AND b.owner_id=j.owner_id WHERE j.book_id=? AND j.page_number=? AND j.owner_id=? AND j.status='completed' ORDER BY j.completed_at DESC,j.id DESC LIMIT 1",(book_id,page_number,owner)).fetchone()
    if not row:
        raise HTTPException(404,"Illustration not found")
    return {"job_id":row[0]}


@app.delete("/api/illustrations/jobs/{job_id}",status_code=204)
def cancel_private_illustration(job_id:str,owner:str=Depends(current_parent)):
    if not re.fullmatch(r"[0-9a-f-]{36}",job_id):
        raise HTTPException(404,"Illustration job not found")
    with connection() as c:
        removed=sql(c,"DELETE FROM illustration_jobs WHERE id=? AND owner_id=? AND status='queued'",(job_id,owner))
        if removed.rowcount:
            c.commit()
            return
        if not sql(c,"SELECT status FROM illustration_jobs WHERE id=? AND owner_id=?",(job_id,owner)).fetchone():
            raise HTTPException(404,"Illustration job not found")
        raise HTTPException(409,"Only queued illustration jobs can be canceled")


def save_private_illustration_asset(job_id:str,payload:bytes)->str:
    """Trusted worker-only commit; no route lets a browser upload bytes.

    This function requires a job to be in processing state and writes the
    sanitized image plus completion status in one transaction.
    """
    if os.getenv("ENABLE_AI_ILLUSTRATIONS","false").lower()!="true":
        raise RuntimeError("Illustration generation is disabled")
    if not re.fullmatch(r"[0-9a-f-]{36}",job_id):
        raise ValueError("Invalid illustration job ID")
    clean=normalize_private_illustration(payload)
    digest=hashlib.sha256(clean).hexdigest()
    with connection() as c:
        query="SELECT owner_id,book_id,status FROM illustration_jobs WHERE id=?"
        if IS_PG:
            query+=" FOR UPDATE"
        else:
            c.execute("BEGIN IMMEDIATE")
        row=sql(c,query,(job_id,)).fetchone()
        if not row or row[2]!="processing":
            raise ValueError("Illustration job is not processing")
        if not illustration_consent_active(row[0],c):
            raise ValueError("Parental illustration consent is not active")
        owner,book_id,_=row
        # The image belongs to the exact same owner and private book as the job.
        if not sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone():
            raise ValueError("Original private book no longer exists")
        now=datetime.now(timezone.utc).isoformat()
        sql(c,"INSERT INTO illustration_assets(job_id,owner_id,book_id,png_bytes,sha256,byte_length,created_at) VALUES(?,?,?,?,?,?,?)",(job_id,owner,book_id,clean,digest,len(clean),now))
        sql(c,"UPDATE illustration_jobs SET status='completed',completed_at=?,storage_key=NULL WHERE id=? AND status='processing'",(now,job_id))
        sql(c,"INSERT INTO illustration_job_events(id,job_id,event,created_at) VALUES(?,?,?,?)",(str(uuid.uuid4()),job_id,"completed",now))
        c.commit()
    return digest


@app.get("/api/illustrations/media/{job_id}")
def read_private_illustration_media(job_id:str,owner:str=Depends(current_parent)):
    """Read an illustration through the owner-scoped API, never a public URL."""
    if not re.fullmatch(r"[0-9a-f-]{36}",job_id):
        raise HTTPException(404,"Illustration not found")
    with connection() as c:
        row=sql(c,"SELECT a.png_bytes,a.sha256,a.byte_length FROM illustration_assets a JOIN illustration_jobs j ON j.id=a.job_id JOIN books b ON b.id=j.book_id AND b.owner_id=j.owner_id WHERE a.job_id=? AND a.owner_id=? AND j.owner_id=? AND j.status='completed'",(job_id,owner,owner)).fetchone()
    if not row:
        raise HTTPException(404,"Illustration not found")
    data=bytes(row[0])
    if len(data)!=row[2] or hashlib.sha256(data).hexdigest()!=row[1]:
        raise HTTPException(503,"Illustration failed integrity verification")
    return Response(content=data,media_type="image/png",headers={
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"default-src 'none'; sandbox",
    })


@app.delete("/api/me",status_code=204)
def delete_account(owner:str=Depends(current_parent)):
    with connection() as c:
        # Login throttling uses a keyed email digest rather than a foreign key,
        # so ON DELETE CASCADE cannot remove its record automatically.
        row=sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
        if not row:
            raise HTTPException(404,"Account not found")
        sql(c,"DELETE FROM login_attempts WHERE email_key=?",(_email_key(row[0]),))
        sql(c,"DELETE FROM parents WHERE id=?",(owner,))
        c.commit()
