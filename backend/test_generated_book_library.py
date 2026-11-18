"""Integration regression for AI-generated books in the private account library.

Uses a temporary SQLite database and a fake AI model. No provider calls or emails.
"""
import importlib
import json
import sys
import uuid
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def api(tmp_path, monkeypatch):
    monkeypatch.setenv("AUTH_SECRET", "unit-test-only-" + "x" * 48)
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "private.sqlite"))
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_TEXT_AI", "true")
    monkeypatch.setenv("OPENAI_API_KEY", "test-key-not-sent")
    monkeypatch.setenv("AI_ALLOWED_EMAILS", "parent@test.invalid")
    monkeypatch.setenv("MAX_AI_STORIES_PER_DAY", "10")
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "false")
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    sys.modules.pop("secure_main", None)
    module = importlib.import_module("secure_main")
    parent_id = str(uuid.uuid4())
    with module.connection() as conn:
        module.sql(
            conn,
            "INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",
            (parent_id, "parent@test.invalid", "not-a-real-password-hash", "2026-01-01"),
        )
        conn.commit()
    token = module.make_token(parent_id)
    headers = {"Authorization": "Bearer " + token}

    class FakeStory:
        title = "The Friendly Star"
        language = "en"
        pages = ["A gentle story about a friendly star." * 4] * 8

    monkeypatch.setattr(module, "generate_story", lambda _input: FakeStory())
    yield TestClient(module.app), module, parent_id, headers
    sys.modules.pop("secure_main", None)


def test_generated_pages_are_readable_by_private_library(api):
    client, module, parent_id, headers = api
    response = client.post(
        "/api/books/generate",
        headers=headers,
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 201, response.text
    book_id = response.json()["id"]
    listed = client.get("/api/books", headers=headers)
    assert listed.status_code == 200
    books = listed.json()
    book = next(book for book in books if book["id"] == book_id)
    story = json.loads(book["story"])
    assert story["version"] == 1
    assert story["language"] == "en"
    assert len(story["pages"]) == 8
    assert story["pages"][0]["number"] == 1
    assert isinstance(story["pages"][0]["text"], str)
    assert story["pages"][0]["image_url"] == ""
    assert response.json()["pages"] == story["pages"]


def test_generation_respects_parent_library_limit(api, monkeypatch):
    client, module, parent_id, headers = api
    monkeypatch.setattr(module, "MAX_BOOKS_PER_PARENT", 0)
    response = client.post(
        "/api/books/generate",
        headers=headers,
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 409
    assert client.get("/api/books", headers=headers).json() == []


def test_generated_book_is_invisible_to_another_parent(api):
    client, module, first_parent, headers = api
    generated = client.post(
        "/api/books/generate",
        headers=headers,
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert generated.status_code == 201
    book_id = generated.json()["id"]
    second_parent = str(uuid.uuid4())
    with module.connection() as conn:
        module.sql(
            conn,
            "INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",
            (second_parent, "other@test.invalid", "not-a-real-password-hash", "2026-01-01"),
        )
        conn.commit()
    second_headers = {"Authorization": "Bearer " + module.make_token(second_parent)}
    assert client.get("/api/books", headers=second_headers).json() == []
    assert client.get("/api/books/" + book_id, headers=second_headers).status_code == 404
    assert client.delete("/api/books/" + book_id, headers=second_headers).status_code == 404
    assert client.post("/api/books/" + book_id + "/favorite", headers=second_headers).status_code == 404
    assert client.post("/api/books/" + book_id + "/progress", headers=second_headers, json={"page": 1}).status_code == 404
    # The original parent still sees the saved story after another parent is denied.
    assert client.get("/api/books/" + book_id, headers=headers).status_code == 200
    assert client.get("/api/books", headers={"Authorization": "Bearer invalid"}).status_code == 401


def test_unauthenticated_generation_is_rejected(api):
    client, module, parent_id, headers = api
    response = client.post(
        "/api/books/generate",
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 401
    assert client.get("/api/books", headers=headers).json() == []


def test_unapproved_parent_cannot_spend_ai_quota(api, monkeypatch):
    client, module, parent_id, headers = api
    monkeypatch.setenv("AI_ALLOWED_EMAILS", "nobody@test.invalid")
    response = client.post(
        "/api/books/generate",
        headers=headers,
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 403
    with module.connection() as conn:
        assert module.sql(conn, "SELECT COUNT(*) FROM generation_global_quota").fetchone()[0] == 0
        assert module.sql(conn, "SELECT COUNT(*) FROM generation_quota").fetchone()[0] == 0


def test_ai_generation_respects_daily_parent_limit(api):
    client, module, parent_id, headers = api
    payload={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"}
    for _ in range(2):
        assert client.post("/api/books/generate", headers=headers, json=payload).status_code == 201
    third=client.post("/api/books/generate", headers=headers, json=payload)
    assert third.status_code == 429
    assert len(client.get("/api/books", headers=headers).json()) == 2


def test_private_library_response_disables_caching(api):
    client, module, parent_id, headers = api
    response=client.get("/api/books", headers=headers)
    assert response.status_code==200
    assert response.headers["cache-control"]=="private, no-store"
    assert response.headers["pragma"]=="no-cache"
    assert response.headers["x-content-type-options"]=="nosniff"
    unauthorized=client.get("/api/books")
    assert unauthorized.status_code==401
    assert unauthorized.headers["cache-control"]=="private, no-store"


def test_oversized_bearer_token_is_rejected(api):
    client, module, parent_id, headers = api
    response=client.get("/api/me",headers={"Authorization":"Bearer "+"x"*5000})
    assert response.status_code==401
    assert response.headers["cache-control"]=="private, no-store"


def test_failed_ai_provider_does_not_consume_parent_or_global_quota(api, monkeypatch):
    client, module, parent_id, headers = api
    payload = {"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"}

    def fail_provider(_data):
        raise RuntimeError("simulated provider outage")

    original_generate = module.generate_story
    monkeypatch.setattr(module, "generate_story", fail_provider)
    failed = client.post("/api/books/generate", headers=headers, json=payload)
    assert failed.status_code == 502
    assert "simulated provider outage" not in failed.text
    assert client.get("/api/books", headers=headers).json() == []
    with module.connection() as conn:
        assert module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_global_quota").fetchone()[0] == 0
        assert module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_quota").fetchone()[0] == 0

    # A subsequent healthy request must be able to use the refunded allowance.
    monkeypatch.setattr(module, "generate_story", original_generate)
    retry = client.post("/api/books/generate", headers=headers, json=payload)
    assert retry.status_code == 201, retry.text
    with module.connection() as conn:
        assert module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_global_quota").fetchone()[0] == 1
        assert module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_quota").fetchone()[0] == 1


def test_child_profiles_are_private_and_limited_to_five(api):
    client, module, first_parent, headers = api
    second_parent = str(uuid.uuid4())
    with module.connection() as conn:
        module.sql(
            conn,
            "INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",
            (second_parent, "second-parent@test.invalid", "not-a-real-password-hash", "2026-01-01"),
        )
        conn.commit()
    other_headers = {"Authorization": "Bearer " + module.make_token(second_parent)}

    created = []
    for index in range(5):
        response = client.post(
            "/api/children",
            headers=headers,
            json={"nickname": f"Child {index + 1}", "age": 6},
        )
        assert response.status_code == 201, response.text
        created.append(response.json()["id"])
    assert len(client.get("/api/children", headers=headers).json()) == 5
    assert client.post("/api/children", headers=headers, json={"nickname": "Sixth", "age": 6}).status_code == 409

    # Another authenticated parent cannot enumerate or remove these profiles.
    assert client.get("/api/children", headers=other_headers).json() == []
    assert client.delete("/api/children/" + created[0], headers=other_headers).status_code == 404
    assert len(client.get("/api/children", headers=headers).json()) == 5
    assert client.get("/api/children").status_code == 401

    # Removing a profile frees exactly one slot for its owner.
    assert client.delete("/api/children/" + created[0], headers=headers).status_code == 204
    assert client.post("/api/children", headers=headers, json={"nickname": "New child", "age": 7}).status_code == 201
    assert len(client.get("/api/children", headers=headers).json()) == 5


def test_parent_quota_denial_does_not_consume_global_capacity(api):
    client, module, parent_id, headers = api
    payload = {"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"}
    for _ in range(2):
        response = client.post("/api/books/generate", headers=headers, json=payload)
        assert response.status_code == 201, response.text

    denied = client.post("/api/books/generate", headers=headers, json=payload)
    assert denied.status_code == 429
    with module.connection() as conn:
        global_used = module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_global_quota").fetchone()[0]
        parent_used = module.sql(conn, "SELECT COALESCE(SUM(used),0) FROM generation_quota").fetchone()[0]
    assert global_used == 2
    assert parent_used == 2


def test_database_readiness_and_authentication_boundaries(api):
    client, module, parent_id, headers = api
    readiness = client.get("/api/ready")
    assert readiness.status_code == 200, readiness.text
    assert readiness.json()["database"] == "connected"
    assert client.get("/api/me").status_code == 401
    assert client.get("/api/me", headers=headers).status_code == 200


def test_concurrent_child_creation_never_exceeds_family_limit(api):
    from concurrent.futures import ThreadPoolExecutor

    client, module, parent_id, headers = api

    def create_child(index):
        response = client.post(
            "/api/children",
            headers=headers,
            json={"nickname": f"Child {index}", "age": 7},
        )
        return response.status_code

    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(create_child, range(12)))

    assert results.count(201) == 5
    assert results.count(409) == 7
    children = client.get("/api/children", headers=headers)
    assert children.status_code == 200
    assert len(children.json()) == 5


def test_parent_registration_login_logout_and_private_story_flow(api, monkeypatch):
    client, module, existing_parent, existing_headers = api
    monkeypatch.setenv("ENABLE_REGISTRATION", "true")
    monkeypatch.setenv("REQUIRE_EMAIL_VERIFICATION", "false")
    monkeypatch.setenv("AI_ALLOWED_EMAILS", "new-parent@test.invalid")

    credentials = {"email": "new-parent@test.invalid", "password": "long-test-password-2026"}
    registration = client.post("/api/auth/register", json=credentials)
    assert registration.status_code == 201, registration.text
    token = registration.json()["access_token"]
    headers = {"Authorization": "Bearer " + token}

    assert client.get("/api/me", headers=headers).status_code == 200
    assert client.post("/api/auth/register", json=credentials).status_code == 409
    assert client.post("/api/auth/login", json={**credentials, "password": "wrong-password-2026"}).status_code == 401

    login = client.post("/api/auth/login", json=credentials)
    assert login.status_code == 200, login.text
    logged_in_headers = {"Authorization": "Bearer " + login.json()["access_token"]}

    child = client.post("/api/children", headers=logged_in_headers, json={"nickname": "Sam", "age": 7})
    assert child.status_code == 201, child.text
    generated = client.post(
        "/api/books/generate",
        headers=logged_in_headers,
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert generated.status_code == 201, generated.text
    book_id = generated.json()["id"]
    assert client.get("/api/books/" + book_id, headers=logged_in_headers).status_code == 200
    assert client.get("/api/books", headers=existing_headers).json() == []
    assert client.get("/api/children", headers=existing_headers).json() == []

    logout = client.post("/api/auth/logout", headers=logged_in_headers)
    assert logout.status_code == 204, logout.text
    assert client.get("/api/me", headers=logged_in_headers).status_code == 401
    # Logout revokes only the active session; the registration session remains valid.
    assert client.get("/api/me", headers=headers).status_code == 200
