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
    module.app.dependency_overrides[module.current_parent] = lambda: parent_id

    class FakeStory:
        title = "The Friendly Star"
        language = "en"
        pages = ["A gentle story about a friendly star." * 4] * 8

    monkeypatch.setattr(module, "generate_story", lambda _input: FakeStory())
    yield TestClient(module.app), module, parent_id
    module.app.dependency_overrides.clear()
    sys.modules.pop("secure_main", None)


def test_generated_pages_are_readable_by_private_library(api):
    client, module, parent_id = api
    response = client.post(
        "/api/books/generate",
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 201, response.text
    book_id = response.json()["id"]
    listed = client.get("/api/books")
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
    client, module, parent_id = api
    monkeypatch.setattr(module, "MAX_BOOKS_PER_PARENT", 0)
    response = client.post(
        "/api/books/generate",
        json={"name": "Sam", "age": 7, "language": "en", "idea": "A friendly star visits the forest"},
    )
    assert response.status_code == 409
    assert client.get("/api/books").json() == []
