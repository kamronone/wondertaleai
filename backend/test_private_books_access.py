"""Regression tests for the temporary private-books preview gate."""
import os
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from main import app  # noqa: E402

client = TestClient(app)


def test_health_is_accessible_without_private_token(monkeypatch):
    monkeypatch.delenv("BOOKS_ACCESS_TOKEN", raising=False)
    response = client.get("/api/health")
    assert response.status_code == 200


def test_books_fail_closed_when_no_token_is_configured(monkeypatch):
    monkeypatch.delenv("BOOKS_ACCESS_TOKEN", raising=False)
    for path in ("/api/books", "/api/books/some-id", "/api/books/some-id/pdf",
                 "/api/books/some-id/images/1"):
        response = client.get(path)
        assert response.status_code == 503
        assert response.headers["cache-control"] == "no-store"


def test_book_list_rejects_missing_and_invalid_credentials(monkeypatch):
    monkeypatch.setenv("BOOKS_ACCESS_TOKEN", "a-long-test-only-access-token")
    assert client.get("/api/books").status_code == 401
    response = client.get("/api/books", headers={"Authorization": "Bearer wrong"})
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_book_list_accepts_correct_bearer_token(monkeypatch):
    monkeypatch.setenv("BOOKS_ACCESS_TOKEN", "a-long-test-only-access-token")
    response = client.get(
        "/api/books",
        headers={"Authorization": "Bearer a-long-test-only-access-token"},
    )
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_deletion_and_creation_require_auth(monkeypatch):
    monkeypatch.setenv("BOOKS_ACCESS_TOKEN", "a-long-test-only-access-token")
    assert client.delete("/api/books/some-id").status_code == 401
    assert client.post("/api/books").status_code == 401
