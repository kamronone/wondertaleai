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


def test_whole_book_report_is_read_only_and_does_not_invoke_provider(reader_context):
    (db, _, owner, other, _, page, _), worker, images, kwargs, book = reader_context
    from private_character_reader import personal_book_readiness
    from private_character_sheet_store import CharacterSheetUnavailable
    report = personal_book_readiness(owner, book, "storybook", "explorer")
    assert report["total_pages"] == 8
    assert report["counts"] == {"not_requested": 6, "pending_review": 2, "needs_review": 0, "ready": 0}
    assert report["generation_started"] is False
    assert len(images.calls) == 1
    worker.process_character_page_request(owner, page, **kwargs)
    report = personal_book_readiness(owner, book, "storybook", "explorer")
    assert report["counts"] == {"not_requested": 6, "pending_review": 1, "needs_review": 0, "ready": 1}
    assert report["pages"][1] == {"page_number": 2, "status": "ready"}
    assert len(images.calls) == 2
    assert owner not in repr(report) and page not in repr(report)
    with pytest.raises(CharacterSheetUnavailable):
        personal_book_readiness(other, book, "storybook", "explorer")
    db.delete_photo_reference(owner)
    with pytest.raises(CharacterSheetUnavailable):
        personal_book_readiness(owner, book, "storybook", "explorer")


def test_whole_book_report_never_counts_corrupt_page_as_ready(reader_context):
    (db, _, owner, _, _, page, _), worker, images, kwargs, book = reader_context
    from private_character_reader import personal_book_readiness
    worker.process_character_page_request(owner, page, **kwargs)
    with db.connection() as c:
        db.sql(c, "UPDATE photo_character_pages SET sha256=? WHERE request_id=?",
               ("0" * 64, page))
        c.commit()
    report = personal_book_readiness(owner, book, "storybook", "explorer")
    assert report["pages"][1]["status"] == "needs_review"
    assert report["counts"]["ready"] == 0
    assert len(images.calls) == 2


def test_preflight_whole_book_budget_and_sequence(reader_context, monkeypatch):
    (db, _, owner, other, source, page, _), worker, images, kwargs, book = reader_context
    from private_book_review import prepare_book_review, next_book_review_step
    from private_character_sheet_store import CharacterSheetUnavailable
    monkeypatch.setenv("ENABLE_PERSONAL_BOOK_REVIEW", "true")
    prepare_book_review(owner, book, "storybook", "explorer")
    blocked = next_book_review_step(owner, book, "storybook", "explorer")
    assert blocked["state"] == "budget_insufficient"
    assert blocked["estimated_remaining_micro_usd"] == 800000
    assert blocked["available_daily_micro_usd"] == 200000
    monkeypatch.setenv("PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD", "2000000")
    monkeypatch.setenv("PHOTO_EDIT_DAILY_PARENT_MICRO_USD", "2000000")
    result = next_book_review_step(owner, book, "storybook", "explorer")
    assert result["state"] == "prepare_page" and result["next_page"] == 1
    assert result["provider_called"] is False and result["budget_reserved"] is False
    assert len(images.calls) == 1
    worker.process_character_page_request(owner, source, **kwargs)
    result = next_book_review_step(owner, book, "storybook", "explorer")
    assert result["next_page"] == 2 and result["ready_pages"] == 1
    assert result["estimated_remaining_micro_usd"] == 700000
    assert len(images.calls) == 2
    with pytest.raises(CharacterSheetUnavailable):
        next_book_review_step(other, book, "storybook", "explorer")


def test_preflight_stops_after_uncertain_page_attempt(reader_context, monkeypatch):
    (db, _, owner, _, source, page, _), worker, images, kwargs, book = reader_context
    from private_book_review import prepare_book_review, next_book_review_step
    from photo_illustration_budget import reserve_photo_attempt_budget
    monkeypatch.setenv("ENABLE_PERSONAL_BOOK_REVIEW", "true")
    prepare_book_review(owner, book, "storybook", "explorer")
    reserve_photo_attempt_budget(page, require_fresh=True)
    result = next_book_review_step(owner, book, "storybook", "explorer")
    assert result["state"] == "needs_review"
    assert result["uncertain_pages"] == [2]
    assert result["next_page"] is None
    assert len(images.calls) == 1
