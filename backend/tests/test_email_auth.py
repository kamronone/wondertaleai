"""Email delivery layer tests without a real SMTP connection."""
import os
from email_auth import digest_code, new_code, mail_configured, send_account_email
import pytest

def test_single_use_code_entropy_and_digest():
    a,b=new_code(),new_code()
    assert a!=b and len(a)>=40
    secret="test-secret-that-is-at-least-32-bytes-long"
    assert digest_code(a,secret)!=digest_code(b,secret)
    assert a not in digest_code(a,secret)
    with pytest.raises(ValueError):
        digest_code("not-a-secure-code",secret)

def test_smtp_is_required(monkeypatch):
    for key in ("SMTP_HOST","SMTP_USERNAME","SMTP_PASSWORD","SMTP_FROM","PUBLIC_APP_ORIGIN"):
        monkeypatch.delenv(key,raising=False)
    assert not mail_configured()
    with pytest.raises(RuntimeError,match="Email provider is not configured"):
        send_account_email("parent@example.com",new_code(),"verify")

def test_links_use_https_and_no_external_network(monkeypatch):
    monkeypatch.setenv("SMTP_HOST","smtp.example.com")
    monkeypatch.setenv("SMTP_PORT","465")
    monkeypatch.setenv("SMTP_USERNAME","wondertale@example.com")
    monkeypatch.setenv("SMTP_PASSWORD","test-not-real-password")
    monkeypatch.setenv("SMTP_FROM","wondertale@example.com")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertale.example.com")
    messages=[]
    class FakeSMTP:
        def __init__(self,host,port,timeout):
            assert host=="smtp.example.com" and port==465
            assert timeout==10
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def login(self,user,password):assert user=="wondertale@example.com"
        def send_message(self,message):messages.append(message)
    monkeypatch.setattr("email_auth.smtplib.SMTP_SSL",FakeSMTP)
    code=new_code()
    send_account_email("parent@example.com",code,"verify")
    assert len(messages)==1
    assert "https://wondertale.example.com/#verify=" in messages[0].get_content()
    assert code in messages[0].get_content()
    assert messages[0]["To"]=="parent@example.com"

def test_reject_insecure_origin(monkeypatch):
    for key in ("SMTP_HOST","SMTP_USERNAME","SMTP_PASSWORD","SMTP_FROM"):
        monkeypatch.setenv(key,"test")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","http://not-secure.example.com")
    assert not mail_configured()
    with pytest.raises(RuntimeError,match="not configured"):
        send_account_email("parent@example.com",new_code(),"recover")


def test_starttls_sends_mail_only_after_encryption(monkeypatch):
    for key,value in {
        "SMTP_HOST":"smtp.example.com","SMTP_PORT":"587",
        "SMTP_USERNAME":"wondertale@example.com","SMTP_PASSWORD":"test-no-real-password",
        "SMTP_FROM":"wondertale@example.com","PUBLIC_APP_ORIGIN":"https://wondertale.example.com",
    }.items():
        monkeypatch.setenv(key,value)
    actions=[]
    class FakeSMTP:
        def __init__(self,host,port,timeout):
            assert host=="smtp.example.com" and port==587 and timeout==10
        def __enter__(self):return self
        def __exit__(self,*args):pass
        def ehlo(self):actions.append("ehlo")
        def starttls(self):actions.append("tls")
        def login(self,user,password):
            assert "tls" in actions
            actions.append("login")
        def send_message(self,message):
            assert "login" in actions
            actions.append("send")
    monkeypatch.setattr("email_auth.smtplib.SMTP",FakeSMTP)
    send_account_email("parent@example.com",new_code(),"recover")
    assert actions==["ehlo","tls","ehlo","login","send"]


def test_plaintext_smtp_port_rejected(monkeypatch):
    for key,value in {
        "SMTP_HOST":"smtp.example.com","SMTP_PORT":"25",
        "SMTP_USERNAME":"wondertale@example.com","SMTP_PASSWORD":"test",
        "SMTP_FROM":"wondertale@example.com","PUBLIC_APP_ORIGIN":"https://wondertale.example.com",
    }.items():
        monkeypatch.setenv(key,value)
    assert not mail_configured()
    with pytest.raises(RuntimeError,match="not configured"):
        send_account_email("parent@example.com",new_code(),"verify")


def test_malformed_smtp_port_rejected(monkeypatch):
    for key,value in {
        "SMTP_HOST":"smtp.example.com","SMTP_PORT":"not-a-port",
        "SMTP_USERNAME":"wondertale@example.com","SMTP_PASSWORD":"test",
        "SMTP_FROM":"wondertale@example.com","PUBLIC_APP_ORIGIN":"https://wondertale.example.com",
    }.items():
        monkeypatch.setenv(key,value)
    assert not mail_configured()
    with pytest.raises(RuntimeError,match="not configured"):
        send_account_email("parent@example.com",new_code(),"verify")


def test_resend_https_delivery_with_mock_provider(monkeypatch):
    import json
    monkeypatch.setenv("RESEND_API_KEY","re_mock_not_a_real_key")
    monkeypatch.setenv("MAIL_FROM","WonderTale AI <stories@example.com>")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertale.example.com")
    monkeypatch.delenv("SMTP_HOST",raising=False)
    observed=[]
    class FakeResponse:
        status=200
        def __enter__(self):return self
        def __exit__(self,*args):pass
    def fake_open(request,timeout):
        observed.append(request)
        assert timeout==12
        return FakeResponse()
    monkeypatch.setattr("email_auth.urlopen",fake_open)
    assert mail_configured()
    token=new_code()
    send_account_email("parent@example.com",token,"verify")
    assert len(observed)==1
    request=observed[0]
    assert request.full_url=="https://api.resend.com/emails"
    assert request.get_method()=="POST"
    assert request.get_header("Authorization")=="Bearer re_mock_not_a_real_key"
    payload=json.loads(request.data.decode("utf-8"))
    assert payload["from"]=="WonderTale AI <stories@example.com>"
    assert payload["to"]==["parent@example.com"]
    assert token in payload["text"]
    assert "#verify=" in payload["text"]


def test_resend_errors_are_sanitized(monkeypatch):
    from urllib.error import HTTPError
    monkeypatch.setenv("RESEND_API_KEY","re_mock_not_a_real_key")
    monkeypatch.setenv("MAIL_FROM","stories@example.com")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertale.example.com")
    def fake_failure(request,timeout):
        raise HTTPError(request.full_url,403,"internal provider token leaked",{},None)
    monkeypatch.setattr("email_auth.urlopen",fake_failure)
    with pytest.raises(RuntimeError,match="Email provider delivery request failed") as exc:
        send_account_email("parent@example.com",new_code(),"recover")
    assert "internal provider" not in str(exc.value)


def test_resend_does_not_enable_delivery_without_sender(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY","re_mock_not_a_real_key")
    monkeypatch.delenv("MAIL_FROM",raising=False)
    monkeypatch.delenv("SMTP_FROM",raising=False)
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertale.example.com")
    assert mail_configured() is False


def test_email_readiness_requires_https_and_valid_sender(monkeypatch):
    for key in ("SMTP_HOST","SMTP_USERNAME","SMTP_PASSWORD","SMTP_FROM"):
        monkeypatch.delenv(key,raising=False)
    monkeypatch.setenv("RESEND_API_KEY","re_test_mock_key_only")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertaleai-preview-kamronones-projects.vercel.app")
    monkeypatch.setenv("MAIL_FROM","onboarding@resend.dev")
    assert mail_configured() is True
    monkeypatch.setenv("MAIL_FROM","WonderTale AI <onboarding@resend.dev>")
    assert mail_configured() is True
    monkeypatch.setenv("MAIL_FROM","not-an-email")
    assert mail_configured() is False
    monkeypatch.setenv("MAIL_FROM","onboarding@resend.dev\\nBcc:someone@example.com")
    assert mail_configured() is False
    monkeypatch.setenv("MAIL_FROM","onboarding@resend.dev")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","http://example.com")
    assert mail_configured() is False


def test_email_readiness_with_credentials_does_not_call_provider(monkeypatch):
    monkeypatch.setenv("RESEND_API_KEY","re_fake_test_key")
    monkeypatch.setenv("MAIL_FROM","onboarding@resend.dev")
    monkeypatch.setenv("PUBLIC_APP_ORIGIN","https://wondertale.example.com")
    monkeypatch.setattr("email_auth.urlopen",lambda *args,**kwargs: (_ for _ in ()).throw(AssertionError("No network during readiness")))
    assert mail_configured() is True
