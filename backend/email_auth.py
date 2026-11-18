"""Email identity verification utilities. No email addresses or tokens are logged.

The secure API must be privately hosted with an SMTP provider configured.
The frontend static Vercel preview MUST NOT receive these credentials.
"""
import hashlib
import hmac
import os
import re
import secrets
import smtplib
from email.message import EmailMessage
from urllib.parse import urlencode

def verification_required()->bool:
    return os.getenv("REQUIRE_EMAIL_VERIFICATION","true").lower()!="false"

def mail_configured()->bool:
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USERNAME") and
                os.getenv("SMTP_PASSWORD") and os.getenv("SMTP_FROM") and
                os.getenv("PUBLIC_APP_ORIGIN"))

def new_code()->str:
    # Single-use token, 256 bits of entropy.
    return secrets.token_urlsafe(32)

def digest_code(code:str,secret:str)->str:
    if not re.fullmatch(r"[A-Za-z0-9_-]{35,100}",code):
        raise ValueError("Invalid token")
    return hmac.new(secret.encode("utf-8"),code.encode("ascii"),hashlib.sha256).hexdigest()

def send_account_email(to:str,token:str,kind:str)->None:
    if kind not in ("verify","recover"):
        raise ValueError("Unknown email purpose")
    if not mail_configured():
        raise RuntimeError("SMTP is not configured")
    origin=os.environ["PUBLIC_APP_ORIGIN"].strip().rstrip("/")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::[0-9]{2,5})?",origin):
        raise RuntimeError("PUBLIC_APP_ORIGIN must be an HTTPS origin")
    # Tokens are sent only by email, never returned in HTTP responses.
    destination=origin+("/verify-email" if kind=="verify" else "/reset-password")+"?"+urlencode({"token":token})
    subject="WonderTale AI: confirm your email" if kind=="verify" else "WonderTale AI: reset your password"
    body=(
      "Hello!\n\nTo confirm your parent account, open:\n" if kind=="verify"
      else "Hello!\n\nTo reset your account password, open:\n"
    )+destination+"\n\nThis link expires in 30 minutes and works only once. If this wasn't you, ignore this message.\n"
    msg=EmailMessage()
    msg["To"]=to
    msg["From"]=os.environ["SMTP_FROM"]
    msg["Subject"]=subject
    msg.set_content(body)
    host=os.environ["SMTP_HOST"]
    port=int(os.getenv("SMTP_PORT","465"))
    with smtplib.SMTP_SSL(host,port,timeout=10) as smtp:
        smtp.login(os.environ["SMTP_USERNAME"],os.environ["SMTP_PASSWORD"])
        smtp.send_message(msg)
