"""Offline page pipeline tests; synthetic images and fake provider only."""
import importlib

import pytest

from test_private_character_sheet_store import fixture
from test_private_character_sheet_worker import worker_context


@pytest.fixture
def page_context(worker_context, monkeypatch):
    base, sheet_worker, images, kwargs = worker_context
    db, store, owner, _, source, _, _ = base
    monkeypatch.setenv("ENABLE_CHARACTER_PAGE_WORKER", "true")
    sheet_worker.process_character_sheet_request(owner, source, **kwargs)
    worker = importlib.import_module("private_character_page_worker")
    return base, worker, images, kwargs


def test_page_uses_sheet_and_reserves_once(page_context):
    (db, store, owner, _, source, page, _), worker, images, kwargs = page_context
    assert worker.process_character_page_request(owner, page, **kwargs) == {
        "state": "ready", "provider_invoked": True}
    assert worker.process_character_page_request(owner, page, **kwargs) == {
        "state": "ready", "provider_invoked": False}
    assert len(images.calls) == 2
    assert images.calls[1][0] == "character-sheet.png"
    assert images.calls[1][1] == store.load_character_sheet(owner, page).png
    assert worker.load_character_page(owner, page).startswith(b"\x89PNG")
    with db.connection() as c:
        assert db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_daily_budget").fetchone()[0] == 200000
        assert db.sql(c, "SELECT COUNT(*) FROM photo_character_pages").fetchone()[0] == 1


def test_other_parent_cannot_read_or_generate(page_context):
    (_, store, _, other, _, page, _), worker, images, kwargs = page_context
    with pytest.raises(store.CharacterSheetUnavailable):
        worker.load_character_page(other, page)
    with pytest.raises(store.CharacterSheetUnavailable):
        worker.process_character_page_request(other, page, **kwargs)
    assert len(images.calls) == 1


def test_page_deletion_cascades_after_reference_removal(page_context):
    (db, store, owner, _, _, page, _), worker, _, kwargs = page_context
    worker.process_character_page_request(owner, page, **kwargs)
    db.delete_photo_reference(owner)
    with db.connection() as c:
        assert db.sql(c, "SELECT COUNT(*) FROM photo_character_pages").fetchone()[0] == 0
    with pytest.raises(store.CharacterSheetUnavailable):
        worker.load_character_page(owner, page)


def test_failed_attempt_cannot_retry(page_context):
    (db, _, owner, _, _, page, _), worker, images, kwargs = page_context
    budget = importlib.import_module("photo_illustration_budget")
    calls = []
    def fail(**_):
        calls.append(True)
        raise TimeoutError("synthetic timeout")
    from types import SimpleNamespace
    kwargs["client"] = SimpleNamespace(images=SimpleNamespace(edit=fail))
    with pytest.raises(TimeoutError):
        worker.process_character_page_request(owner, page, **kwargs)
    with pytest.raises(budget.PhotoBudgetDenied):
        worker.process_character_page_request(owner, page, **kwargs)
    assert calls == [True]
    with db.connection() as c:
        assert db.sql(c, "SELECT COUNT(*) FROM photo_character_pages").fetchone()[0] == 0
        assert db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_daily_budget").fetchone()[0] == 200000


def test_no_page_after_output_rejection(page_context):
    (_, _, owner, _, _, page, _), worker, images, kwargs = page_context
    kwargs["image_moderator"] = lambda _: False
    with pytest.raises(PermissionError):
        worker.process_character_page_request(owner, page, **kwargs)
    assert worker.load_character_page(owner, page) is None
    assert len(images.calls) == 2
