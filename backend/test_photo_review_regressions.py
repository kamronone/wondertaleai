"""Regression checks for private photo illustration review; no network or photos."""
import importlib
import uuid

import pytest


@pytest.fixture
def review(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTH_SECRET", "test-only-secret-for-photo-review-at-least-32")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "review.sqlite"))
    monkeypatch.setenv("APP_ENV", "development")
    return importlib.import_module("photo_illustration_review")


def test_persistent_stop_denies_review(review, monkeypatch):
    worker = importlib.import_module("illustration_worker")
    monkeypatch.setattr(review.db, "photo_reference_upload_enabled", lambda: True)
    monkeypatch.setenv("ENABLE_PHOTO_REVIEW_DRY_RUN", "true")
    monkeypatch.setattr(worker, "illustration_emergency_paused", lambda connection=None: True)
    with pytest.raises(review.PhotoDryRunDenied, match="emergency stop"):
        review._require_local_review_gate()


def test_review_gate_uses_supplied_transaction(review, monkeypatch):
    worker = importlib.import_module("illustration_worker")
    monkeypatch.setattr(review.db, "photo_reference_upload_enabled", lambda: True)
    monkeypatch.setenv("ENABLE_PHOTO_REVIEW_DRY_RUN", "true")
    transaction = object()
    seen = []
    def paused(connection=None):
        seen.append(connection)
        return False
    monkeypatch.setattr(worker, "illustration_emergency_paused", paused)
    review._require_local_review_gate(transaction)
    assert seen == [transaction]


def test_scene_change_after_moderation_is_denied(review, monkeypatch):
    monkeypatch.setattr(review, "_require_local_review_gate", lambda: None)
    first = ("owner", "digest", "book", 1, b"synthetic", "approved scene", 1000)
    second = (*first[:5], "different scene", first[6])
    snapshots = iter((first, second))
    monkeypatch.setattr(review, "_current_snapshot", lambda _: next(snapshots))
    with pytest.raises(review.PhotoDryRunDenied, match="changed"):
        review.review_photo_request_dry_run(
            str(uuid.uuid4()), photo_moderator=lambda _: True,
            prompt_moderator=lambda _: True,
        )


def test_unchanged_review_does_not_call_provider(review, monkeypatch):
    monkeypatch.setattr(review, "_require_local_review_gate", lambda: None)
    snapshot = ("owner", "digest", "book", 1, b"synthetic", "approved scene", 1000)
    monkeypatch.setattr(review, "_current_snapshot", lambda _: snapshot)
    result = review.review_photo_request_dry_run(
        str(uuid.uuid4()), photo_moderator=lambda _: True,
        prompt_moderator=lambda _: True,
    )
    assert result["status"] == "dry_run_passed"
    assert result["provider_called"] is False
    assert result["image_generated"] is False
    assert result["cost_usd"] == 0
