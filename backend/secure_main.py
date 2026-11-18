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

from fastapi import Depends, FastAPI, Header, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field

SECRET = os.getenv("AUTH_SECRET", "")
if len(SECRET) < 32:
    raise RuntimeError("AUTH_SECRET must be set to a random 32+ character secret")
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./secure_dev.sqlite3")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]
IS_PG = DATABASE_URL.startswith("postgresql://")
app = FastAPI(title="WonderTale Secure API", docs_url=None, redoc_url=None)
origins = [x.strip() for x in os.getenv("CORS_ORIGINS", "http://localhost:5173").split(",") if x.strip()]
app.add_middleware(CORSMiddleware,allow_origins=origins,allow_credentials=False,allow_methods=["GET","POST","DELETE"],allow_headers=["Authorization","Content-Type"])

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
        sql(c, "CREATE TABLE IF NOT EXISTS login_attempts (email_key TEXT PRIMARY KEY, window_started INTEGER NOT NULL, failures INTEGER NOT NULL DEFAULT 0)")
        sql(c, "CREATE TABLE IF NOT EXISTS generation_global_quota (day TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0)")
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
    payload=encode(json.dumps({"sub":parent_id,"exp":int(time.time())+3600*12},separators=(",",":")).encode())
    signature=encode(hmac.new(SECRET.encode(),payload.encode(),hashlib.sha256).digest())
    return payload+"."+signature

def current_parent(authorization: str | None=Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,"Authentication required")
    token=authorization[7:]
    try:
        payload,signature=token.split(".")
        expected=encode(hmac.new(SECRET.encode(),payload.encode(),hashlib.sha256).digest())
        if not hmac.compare_digest(signature,expected):
            raise ValueError("signature")
        data=json.loads(decode(payload))
        if int(data["exp"])<=int(time.time()) or not re.fullmatch(r"[0-9a-f-]{36}",data["sub"]):
            raise ValueError("expired")
        with connection() as c:
            row=sql(c,"SELECT id FROM parents WHERE id=?",(data["sub"],)).fetchone()
        if row is None:raise ValueError("not found")
        return row[0]
    except (ValueError,TypeError,KeyError,OverflowError,UnicodeDecodeError,binascii.Error,json.JSONDecodeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED,"Invalid or expired token")

@app.get("/api/health")
def health():
    return {"ok":True}


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

@app.post("/api/auth/register",response_model=Token,status_code=201)
def register(body:Credentials):
    email=str(body.email).lower()
    uid=str(uuid.uuid4())
    with connection() as c:
        if sql(c,"SELECT id FROM parents WHERE email=?",(email,)).fetchone():
            raise HTTPException(409,"Account already exists")
        sql(c,"INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",(uid,email,password_hash(body.password),datetime.now(timezone.utc).isoformat()))
        c.commit()
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
    _clear_login_failures(email)
    return Token(access_token=make_token(row[0]))

@app.get("/api/me")
def me(owner: str=Depends(current_parent)):
    return {"id":owner}

@app.get("/api/books")
def books(owner:str=Depends(current_parent)):
    with connection() as c:
        rows=sql(c,"SELECT id,title,child_name,age,story,created_at FROM books WHERE owner_id=? ORDER BY created_at DESC LIMIT 100",(owner,)).fetchall()
    return [{"id":r[0],"title":r[1],"child_name":r[2],"age":r[3],"story":r[4],"created_at":r[5]} for r in rows]

@app.post("/api/books",status_code=201)
def create_book(body:BookIn,owner:str=Depends(current_parent)):
    book_id=str(uuid.uuid4())
    created=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        sql(c,"INSERT INTO books(id,owner_id,title,child_name,age,story,created_at) VALUES(?,?,?,?,?,?,?)",(book_id,owner,body.title,body.child_name,body.age,body.story,created))
        c.commit()
    return {"id":book_id,"created_at":created}

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
def generate_personalized_book(body:GenerateStoryInput,owner:str=Depends(current_parent)):
    if os.getenv("ENABLE_TEXT_AI","false").lower()!="true":
        raise HTTPException(503,"AI generation is not enabled")
    if not os.getenv("OPENAI_API_KEY"):
        raise HTTPException(503,"AI provider is not configured")
    today=datetime.now(timezone.utc).date().isoformat()
    with connection() as c:
        # Serialize quota reservation in PostgreSQL using a single atomic upsert.
        if IS_PG:
            row=sql(c,"INSERT INTO generation_quota(owner_id,day,used) VALUES(?,?,1) ON CONFLICT(owner_id,day) DO UPDATE SET used=generation_quota.used+1 WHERE generation_quota.used<2 RETURNING used",(owner,today)).fetchone()
            if row is None:
                raise HTTPException(429,"Daily AI story limit reached")
        else:
            sql(c,"INSERT OR IGNORE INTO generation_quota(owner_id,day,used) VALUES(?,?,0)",(owner,today))
            result=sql(c,"UPDATE generation_quota SET used=used+1 WHERE owner_id=? AND day=? AND used<2",(owner,today))
            if result.rowcount==0:
                raise HTTPException(429,"Daily AI story limit reached")
        c.commit()
    try:
        generated=generate_story(body)
    except Exception:
        # Never return internal API errors or provider details to a parent.
        raise HTTPException(502,"Unable to generate this story. Please try later.")
    bid=str(uuid.uuid4())
    now=datetime.now(timezone.utc).isoformat()
    with connection() as c:
        sql(c,"INSERT INTO books(id,owner_id,title,child_name,age,story,created_at) VALUES(?,?,?,?,?,?,?)",(bid,owner,generated.title,body.name,body.age,json.dumps({"language":generated.language,"pages":generated.pages},ensure_ascii=False),now))
        c.commit()
    return {"id":bid,"title":generated.title,"language":generated.language,"pages":generated.pages,"created_at":now}

@app.delete("/api/me",status_code=204)
def delete_account(owner:str=Depends(current_parent)):
    with connection() as c:
        sql(c,"DELETE FROM books WHERE owner_id=?",(owner,))
        sql(c,"DELETE FROM parents WHERE id=?",(owner,))
        c.commit()
