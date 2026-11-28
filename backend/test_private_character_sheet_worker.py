"""Offline one-shot integration tests: synthetic JPEG and fake client only."""
import importlib
from types import SimpleNamespace

import pytest

from test_private_character_sheet_store import fixture
from test_private_character_sheet_edits import FakeImages


@pytest.fixture
def worker_context(fixture, monkeypatch):
    for flag in ("ENABLE_CHARACTER_SHEET_WORKER", "ENABLE_CHARACTER_SHEET_EDITS",
                 "ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS", "ENABLE_OPENAI_IMAGE_PROVIDER",
                 "ENABLE_PHOTO_BUDGET_RESERVATIONS"):
        monkeypatch.setenv(flag, "true")
    monkeypatch.delenv("OPENAI_IMAGE_MODEL", raising=False)
    monkeypatch.setenv("PHOTO_EDIT_ESTIMATE_MICRO_USD", "100000")
    monkeypatch.setenv("PHOTO_EDIT_DAILY_GLOBAL_MICRO_USD", "500000")
    monkeypatch.setenv("PHOTO_EDIT_DAILY_PARENT_MICRO_USD", "300000")
    worker = importlib.import_module("private_character_sheet_worker")
    images = FakeImages()
    kwargs = dict(client=SimpleNamespace(images=images), transfer_permission=lambda: True,
                  source_moderator=lambda _: True, prompt_moderator=lambda _: True,
                  image_moderator=lambda _: True)
    return fixture, worker, images, kwargs


def test_worker_creates_once_and_reuses_across_pages(worker_context):
    (db, store, owner, _, source, page, _), worker, images, kwargs = worker_context
    assert worker.process_character_sheet_request(owner, source, **kwargs) == {
        "state": "ready", "provider_invoked": True}
    assert worker.process_character_sheet_request(owner, page, **kwargs) == {
        "state": "ready", "provider_invoked": False}
    assert len(images.calls) == 1
    assert store.load_character_sheet(owner, page) is not None
    with db.connection() as c:
        assert db.sql(c, "SELECT state FROM photo_sheet_attempts").fetchone()[0] == "ready"
        assert db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_daily_budget").fetchone()[0] == 100000
        assert db.sql(c, "SELECT COUNT(*) FROM photo_ai_attempt_reservations").fetchone()[0] == 0


def test_failed_provider_is_not_retried_on_other_page(worker_context):
    (db, _, owner, _, source, page, _), worker, images, kwargs = worker_context
    calls = []
    def fail(**_):
        calls.append(True)
        raise TimeoutError("synthetic timeout")
    kwargs["client"] = SimpleNamespace(images=SimpleNamespace(edit=fail))
    with pytest.raises(TimeoutError):
        worker.process_character_sheet_request(owner, source, **kwargs)
    with pytest.raises(PermissionError):
        worker.process_character_sheet_request(owner, page, **kwargs)
    assert calls == [True]
    with db.connection() as c:
        assert db.sql(c, "SELECT state FROM photo_sheet_attempts").fetchone()[0] == "needs_review"
        assert db.sql(c, "SELECT reserved_micro_usd FROM photo_ai_daily_budget").fetchone()[0] == 100000


def test_revoked_permission_prevents_call(worker_context):
    (_, _, owner, _, source, _, _), worker, images, kwargs = worker_context
    kwargs["transfer_permission"] = lambda: False
    with pytest.raises(PermissionError):
        worker.process_character_sheet_request(owner, source, **kwargs)
    assert not images.calls


def test_other_owner_cannot_process_request(worker_context):
    (_, store, _, other, source, _, _), worker, images, kwargs = worker_context
    with pytest.raises(store.CharacterSheetUnavailable):
        worker.process_character_sheet_request(other, source, **kwargs)
    assert not images.calls
