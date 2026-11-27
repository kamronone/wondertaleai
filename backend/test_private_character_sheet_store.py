"""Temporary SQLite storage tests with synthetic artwork, no AI calls."""
from io import BytesIO
import hashlib
import importlib
import json
import time
import uuid

import pytest
from PIL import Image


@pytest.fixture
def fixture(monkeypatch, tmp_path):
    monkeypatch.setenv("AUTH_SECRET", "test-only-private-character-sheet-secret")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///" + str(tmp_path / "sheets.sqlite"))
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD", "true")
    monkeypatch.setenv("ENABLE_CHARACTER_SHEET_STORAGE", "true")
    monkeypatch.setenv("ILLUSTRATION_EMERGENCY_STOP", "false")
    db = importlib.import_module("secure_main")
    monkeypatch.setattr(db, "DATABASE_URL", "sqlite:///" + str(tmp_path / "sheets.sqlite"))
    monkeypatch.setattr(db, "IS_PG", False)
    monkeypatch.setattr(db, "APP_ENV", "development")
    db.init_schema()
    store = importlib.import_module("private_character_sheet_store")
    owner, other, book, source, page = [str(uuid.uuid4()) for _ in range(5)]
    now = int(time.time())
    expires = now + 600
    reference = BytesIO()
    Image.new("RGB", (128,128), "red").save(reference, format="JPEG")
    photo = reference.getvalue()
    digest = hashlib.sha256(photo).hexdigest()
    story = json.dumps({"pages": [{"number": i, "text": "A quiet journey."} for i in range(1, 9)]})
    with db.connection() as c:
        for user in (owner, other):
            db.sql(c, "INSERT INTO parents(id,email,password_hash,created_at) VALUES(?,?,?,?)",
                   (user, user + "@example.test", "unused", "test"))
        db.sql(c, "INSERT INTO books(id,owner_id,title,child_name,age,story,created_at) VALUES(?,?,?,?,?,?,?)",
               (book, owner, "Test", "Fictional", 7, story, "test"))
        db.sql(c, "INSERT INTO photo_parent_consent(owner_id,policy_version,granted_at) VALUES(?,?,?)",
               (owner, db.PHOTO_CONSENT_VERSION, "test"))
        db.sql(c, "INSERT INTO photo_external_transfer_consent(owner_id,policy_version,granted_at) VALUES(?,?,?)",
               (owner, db.PHOTO_EXTERNAL_TRANSFER_VERSION, "test"))
        db.sql(c, "INSERT INTO photo_reference_temp(owner_id,jpeg_bytes,sha256,created_at,expires_at) VALUES(?,?,?,?,?)",
               (owner, photo, digest, now, expires))
        for rid, number in ((source, 1), (page, 2)):
            db.sql(c, "INSERT INTO photo_illustration_requests(id,owner_id,book_id,page_number,style,hero_mode,reference_sha256,status,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
                   (rid, owner, book, number, "storybook", "explorer", digest, "pending_review", now, expires))
        c.commit()
    out = BytesIO()
    Image.new("RGB", (128,128), "blue").save(out, format="PNG")
    png = store.normalize_private_illustration(out.getvalue())
    sheet = store.ApprovedCharacterSheet(png, hashlib.sha256(png).hexdigest(), "storybook", "explorer")
    return db, store, owner, other, source, page, sheet


def test_reuse_only_by_owner_and_same_book(fixture):
    db, store, owner, other, source, page, sheet = fixture
    assert store.load_character_sheet(owner, page) is None
    store.store_character_sheet(owner, source, sheet, image_moderator=lambda _: True)
    assert store.load_character_sheet(owner, page) == sheet
    with pytest.raises(store.CharacterSheetUnavailable):
        store.load_character_sheet(other, page)


def test_delete_reference_cascades_to_derived_sheet(fixture):
    db, store, owner, _, source, page, sheet = fixture
    store.store_character_sheet(owner, source, sheet, image_moderator=lambda _: True)
    db.delete_photo_reference(owner)
    with db.connection() as c:
        assert db.sql(c, "SELECT COUNT(*) FROM photo_character_sheets").fetchone()[0] == 0
    with pytest.raises(store.CharacterSheetUnavailable):
        store.load_character_sheet(owner, page)


def test_source_cancellation_removes_sheet(fixture):
    db, store, owner, _, source, page, sheet = fixture
    store.store_character_sheet(owner, source, sheet, image_moderator=lambda _: True)
    db.cancel_photo_illustration_request(source, owner)
    assert store.load_character_sheet(owner, page) is None


def test_moderator_revocation_prevents_storage(fixture):
    db, store, owner, _, source, _, sheet = fixture
    def revoke(_):
        db.delete_photo_reference(owner)
        return True
    with pytest.raises(store.CharacterSheetUnavailable):
        store.store_character_sheet(owner, source, sheet, image_moderator=revoke)
    with db.connection() as c:
        assert db.sql(c, "SELECT COUNT(*) FROM photo_character_sheets").fetchone()[0] == 0


def test_disabled_storage_fails_closed(fixture, monkeypatch):
    _, store, owner, _, source, _, sheet = fixture
    monkeypatch.setenv("ENABLE_CHARACTER_SHEET_STORAGE", "false")
    with pytest.raises(store.CharacterSheetUnavailable):
        store.store_character_sheet(owner, source, sheet, image_moderator=lambda _: True)
