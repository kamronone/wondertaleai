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
