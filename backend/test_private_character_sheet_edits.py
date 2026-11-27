"""Offline adapter tests. Only synthetic colored squares and injected fake clients."""
import base64
from dataclasses import replace
from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image, PngImagePlugin

from private_character_sheet_edits import create_character_sheet, edit_character_sheet_page


def picture(color, secret=None):
    out = BytesIO()
    info = PngImagePlugin.PngInfo()
    if secret:
        info.add_text("private", secret)
    Image.new("RGB", (128, 128), color).save(out, format="PNG", pnginfo=info)
    return out.getvalue()


class FakeImages:
    def __init__(self):
        self.calls = []
    def edit(self, **kwargs):
        self.calls.append((kwargs["image"].name, kwargs["image"].read(), kwargs["prompt"]))
        return SimpleNamespace(data=[SimpleNamespace(
            b64_json=base64.b64encode(picture("blue")).decode("ascii"))])


@pytest.fixture
def context(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    for flag in ("ENABLE_DEV_PHOTO_UPLOAD", "ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS",
                 "ENABLE_OPENAI_IMAGE_PROVIDER", "ENABLE_CHARACTER_SHEET_EDITS"):
        monkeypatch.setenv(flag, "true")
    monkeypatch.setenv("ILLUSTRATION_EMERGENCY_STOP", "false")
    monkeypatch.delenv("OPENAI_IMAGE_MODEL", raising=False)
    images = FakeImages()
    reservations = []
    def reserve():
        reservations.append(True)
        return True
    return images, reservations, dict(client=SimpleNamespace(images=images),
        permission=lambda: True, reserve_attempt=reserve,
        source_moderator=lambda _: True, prompt_moderator=lambda _: True,
        image_moderator=lambda _: True)


def make_sheet(kwargs):
    return create_character_sheet(picture("red", "PRIVATE_METADATA_SENTINEL"),
        style="storybook", hero_mode="astronaut", **kwargs)


def test_sheet_then_two_scenes_share_one_illustrated_reference(context):
    images, reservations, kwargs = context
    sheet = make_sheet(kwargs)
    for number in (1, 8):
        edit_character_sheet_page(sheet, scene_number=number, **kwargs)
    assert len(images.calls) == len(reservations) == 3
    assert images.calls[0][0] == "reference.jpg"
    assert b"PRIVATE_METADATA_SENTINEL" not in images.calls[0][1]
    assert images.calls[1][0] == images.calls[2][0] == "character-sheet.png"
    assert images.calls[1][1] == images.calls[2][1] == sheet.png
    assert images.calls[0][1] != images.calls[1][1]
    assert images.calls[1][2] != images.calls[2][2]


@pytest.mark.parametrize("environment", ["preview", "staging", "production", ""])
def test_no_calls_outside_development(context, monkeypatch, environment):
    images, reservations, kwargs = context
    monkeypatch.setenv("APP_ENV", environment)
    with pytest.raises(RuntimeError):
        make_sheet(kwargs)
    assert not images.calls and not reservations


@pytest.mark.parametrize("gate", ["permission", "reserve_attempt", "source_moderator", "prompt_moderator"])
def test_denial_prevents_provider_call(context, gate):
    images, _, kwargs = context
    kwargs[gate] = lambda *args: False
    with pytest.raises(PermissionError):
        make_sheet(kwargs)
    assert not images.calls


def test_revocation_after_reservation_prevents_provider_call(context):
    images, reservations, kwargs = context
    kwargs["permission"] = lambda: not reservations
    with pytest.raises(PermissionError):
        make_sheet(kwargs)
    assert len(reservations) == 1 and not images.calls


def test_rejected_output_is_not_returned(context):
    images, reservations, kwargs = context
    kwargs["image_moderator"] = lambda _: False
    with pytest.raises(PermissionError):
        make_sheet(kwargs)
    assert len(images.calls) == len(reservations) == 1


def test_altered_sheet_does_not_reach_provider(context):
    images, reservations, kwargs = context
    sheet = make_sheet(kwargs)
    with pytest.raises(ValueError, match="integrity"):
        edit_character_sheet_page(replace(sheet, png=picture("green")),
                                  scene_number=2, **kwargs)
    assert len(images.calls) == len(reservations) == 1


def test_provider_failure_is_not_retried(context):
    _, reservations, kwargs = context
    calls = []
    def fail(**_):
        calls.append(True)
        raise TimeoutError("simulated uncertain charge")
    kwargs["client"] = SimpleNamespace(images=SimpleNamespace(edit=fail))
    with pytest.raises(TimeoutError):
        make_sheet(kwargs)
    assert len(calls) == len(reservations) == 1
