"""Email identity verification utilities. No email addresses or tokens are logged.

The secure API requires a trusted SMTP provider using port 465 (SSL) or 587 (STARTTLS).
The frontend static Vercel preview MUST NOT receive these credentials.
"""
import hashlib
import hmac
import os
import re
import secrets
import smtplib
import json
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from email.message import EmailMessage

def verification_required()->bool:
    return os.getenv("REQUIRE_EMAIL_VERIFICATION","true").lower()!="false"

def mail_configured()->bool:
    """Validate that server-side delivery settings are present and structurally safe.

    This does not prove API-key validity or actual inbox delivery.
    """
    origin=os.getenv("PUBLIC_APP_ORIGIN","").strip().rstrip("/")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::[0-9]{2,5})?",origin):
        return False
    sender=(os.getenv("MAIL_FROM") or os.getenv("SMTP_FROM") or "").strip()
    if not sender or len(sender)>254 or chr(13) in sender or chr(10) in sender:
        return False
    # Supports either sender@example.com or Display Name <sender@example.com>.
    address=sender.rsplit("<",1)[-1].rstrip(">").strip()
    if not re.fullmatch(r"[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",address):
        return False
    if os.getenv("RESEND_API_KEY"):
        return True
    return bool(os.getenv("SMTP_HOST") and os.getenv("SMTP_USERNAME") and
                os.getenv("SMTP_PASSWORD") and os.getenv("SMTP_FROM") and
                os.getenv("SMTP_PORT","465") in ("465","587"))

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
        raise RuntimeError("Email provider is not configured")
    origin=os.environ["PUBLIC_APP_ORIGIN"].strip().rstrip("/")
    if not re.fullmatch(r"https://[A-Za-z0-9.-]+(?::[0-9]{2,5})?",origin):
        raise RuntimeError("PUBLIC_APP_ORIGIN must be an HTTPS origin")
    # Tokens are sent only by email, never returned in HTTP responses.
    destination=origin+"/#"+("verify=" if kind=="verify" else "recover=")+token
    subject="WonderTale AI: confirm your email" if kind=="verify" else "WonderTale AI: reset your password"
    body=(
      "Hello!\n\nTo confirm your parent account, open:\n" if kind=="verify"
      else "Hello!\n\nTo reset your account password, open:\n"
    )+destination+"\n\nThis link expires in 30 minutes and works only once. If this wasn't you, ignore this message.\n"
    msg=EmailMessage()
    msg["To"]=to
    msg["From"]=os.getenv("MAIL_FROM") or os.environ["SMTP_FROM"]
    msg["Subject"]=subject
    msg.set_content(body)
    if os.getenv("RESEND_API_KEY"):
        # The Resend API avoids SMTP egress restrictions in serverless environments.
        # Never include the action token, API key or provider response in raised errors.
        payload=json.dumps({
            "from":msg["From"],"to":[to],"subject":subject,"text":body
        }).encode("utf-8")
        request=Request("https://api.resend.com/emails",data=payload,method="POST",headers={
            "Authorization":"Bearer "+os.environ["RESEND_API_KEY"],
            "Content-Type":"application/json",
        })
        try:
            with urlopen(request,timeout=12) as response:
                if response.status not in (200,201,202):
                    raise RuntimeError("Email provider refused the message")
        except (HTTPError,URLError,TimeoutError,OSError) as exc:
            raise RuntimeError("Email provider delivery request failed") from None
        return
    host=os.environ["SMTP_HOST"]
    try:
        port=int(os.getenv("SMTP_PORT","465"))
    except ValueError as exc:
        raise RuntimeError("Invalid SMTP port") from exc
    if port==465:
        # Implicit TLS is established before any SMTP credentials are sent.
        with smtplib.SMTP_SSL(host,port,timeout=10) as smtp:
            smtp.login(os.environ["SMTP_USERNAME"],os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
    elif port==587:
        # Require STARTTLS before authentication. Never allow plaintext SMTP.
        with smtplib.SMTP(host,port,timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.ehlo()
            smtp.login(os.environ["SMTP_USERNAME"],os.environ["SMTP_PASSWORD"])
            smtp.send_message(msg)
    else:
        raise RuntimeError("Supported SMTP ports are 465 (SSL) and 587 (STARTTLS)")
