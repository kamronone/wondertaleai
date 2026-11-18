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
