"""Offline reader API regression tests. Synthetic artwork, no network."""
import importlib

import pytest
from fastapi import HTTPException

from test_private_character_sheet_store import fixture
from test_private_character_sheet_worker import worker_context
from test_private_character_page_worker import page_context


@pytest.fixture
def reader_context(page_context, monkeypatch):
    base, worker, images, kwargs = page_context
    db, _, owner, _, _, page, _ = base
    monkeypatch.setenv("ENABLE_CHARACTER_PAGE_READER", "true")
    with db.connection() as c:
        book = db.sql(c, "SELECT book_id FROM photo_illustration_requests WHERE id=?", (page,)).fetchone()[0]
    return base, worker, images, kwargs, book


def test_metadata_and_private_png(reader_context):
    (db, _, owner, other, _, page, _), worker, images, kwargs, book = reader_context
    assert db.private_illustration_for_page(book, 2, owner) == {"status": "pending_review"}
    worker.process_character_page_request(owner, page, **kwargs)
    result = db.private_illustration_for_page(book, 2, owner)
    assert result["kind"] == "personal" and result["job_id"] == page
    assert isinstance(result["expires_at"], int)
    response = db.read_private_character_page(page, owner)
    assert response.body.startswith(b"\x89PNG")
    assert response.headers["cache-control"] == "private, no-store"
    assert response.headers["content-type"] == "image/png"
    for call in (lambda: db.read_private_character_page(page, other),
                 lambda: db.private_illustration_for_page(book, 2, other)):
        with pytest.raises(HTTPException) as denied:
            call()
        assert denied.value.status_code == 404
    assert len(images.calls) == 2


def test_revocation_hides_existing_image(reader_context):
    (db, _, owner, _, _, page, _), worker, _, kwargs, book = reader_context
    worker.process_character_page_request(owner, page, **kwargs)
    db.delete_photo_reference(owner)
    for call in (lambda: db.read_private_character_page(page, owner),
                 lambda: db.private_illustration_for_page(book, 2, owner)):
        with pytest.raises(HTTPException) as denied:
            call()
        assert denied.value.status_code == 404


def test_local_reader_is_disabled_by_default(reader_context, monkeypatch):
    (db, _, owner, _, _, page, _), worker, _, kwargs, book = reader_context
    worker.process_character_page_request(owner, page, **kwargs)
    monkeypatch.delenv("ENABLE_CHARACTER_PAGE_READER", raising=False)
    with pytest.raises(HTTPException) as denied:
        db.read_private_character_page(page, owner)
    assert denied.value.status_code == 404
    with pytest.raises(HTTPException) as denied:
        db.private_illustration_for_page(book, 2, owner)
    assert denied.value.status_code == 404
