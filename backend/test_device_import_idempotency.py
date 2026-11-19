"""Regression tests for idempotent private device-book import.

SQLite exercises the same per-parent transaction path without Neon or AI calls.
"""
import json
import uuid

from test_generated_book_library import api  # noqa: F401


def payload(source_id, title="A friendly tale"):
    return {
        "title": title,
        "child_name": "Sam",
        "age": 7,
        "story": json.dumps({
            "version": 1,
            "source_id": source_id,
            "pages": [{"number": 1, "text": "A gentle forest adventure."}],
        }),
    }


def test_retry_returns_existing_book_without_duplicate(api):
    client, _, _, headers = api
    first = client.post("/api/books", headers=headers, json=payload("local-retry-1"))
    assert first.status_code == 201, first.text
    second = client.post("/api/books", headers=headers, json=payload("local-retry-1"))
    assert second.status_code == 201, second.text
    assert first.json()["id"] == second.json()["id"]
    assert first.json()["created_at"] == second.json()["created_at"]
    assert len(client.get("/api/books", headers=headers).json()) == 1


def test_import_idempotency_is_scoped_to_parent(api):
    client, module, _, headers = api
    first = client.post("/api/books", headers=headers, json=payload("local-shared"))
    assert first.status_code == 201
    second_id = str(uuid.uuid4())
    with module.connection() as conn:
        module.sql(conn, "INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",
                   (second_id, "another@test.invalid", "not-a-real-password-hash", "2026-01-01"))
        conn.commit()
    other_headers = {"Authorization": "Bearer " + module.make_token(second_id)}
    other = client.post("/api/books", headers=other_headers, json=payload("local-shared"))
    assert other.status_code == 201
    assert other.json()["id"] != first.json()["id"]
    assert len(client.get("/api/books", headers=headers).json()) == 1
    assert len(client.get("/api/books", headers=other_headers).json()) == 1


def test_import_retry_succeeds_even_after_library_reaches_limit(api, monkeypatch):
    client, module, _, headers = api
    first = client.post("/api/books", headers=headers, json=payload("local-at-limit"))
    assert first.status_code == 201
    monkeypatch.setattr(module, "MAX_BOOKS_PER_PARENT", 1)
    retry = client.post("/api/books", headers=headers, json=payload("local-at-limit"))
    assert retry.status_code == 201
    assert retry.json()["id"] == first.json()["id"]
    different = client.post("/api/books", headers=headers, json=payload("local-new"))
    assert different.status_code == 409


def test_non_imported_stories_are_not_deduplicated(api):
    client, _, _, headers = api
    original = payload("local-not-used")
    original["story"] = json.dumps({"version": 1, "pages": [{"number": 1, "text": "Hi"}]})
    first = client.post("/api/books", headers=headers, json=original)
    second = client.post("/api/books", headers=headers, json=original)
    assert first.status_code == 201
    assert second.status_code == 201
    assert first.json()["id"] != second.json()["id"]
