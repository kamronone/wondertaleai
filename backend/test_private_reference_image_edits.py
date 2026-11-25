"""Offline tests only: no child photographs, paid calls, or network."""
import base64
from io import BytesIO
from types import SimpleNamespace
from pathlib import Path

import pytest
from PIL import Image, PngImagePlugin

from private_reference_image_edits import (
    PHOTO_EDIT_MODEL, PHOTO_EDIT_MODES,
    build_reference_edit_prompt, edit_private_reference_portrait,
)


def fake_photo():
    info=PngImagePlugin.PngInfo()
    info.add_text("GPS","SECRET_GPS_TEST_SENTINEL")
    out=BytesIO()
    Image.new("RGB",(128,128),(78,140,196)).save(out,format="PNG",pnginfo=info)
    return out.getvalue()


def fake_image_result():
    out=BytesIO()
    Image.new("RGB",(128,128),(112,174,222)).save(out,format="PNG")
    return SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(out.getvalue()).decode())])


class FakeImages:
    def __init__(self,result=None):
        self.calls=[]
        self.result=result if result is not None else fake_image_result()

    def edit(self,**kwargs):
        self.calls.append(kwargs)
        return self.result


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("APP_ENV","development")
    monkeypatch.setenv("ENABLE_DEV_PHOTO_UPLOAD","true")
    monkeypatch.setenv("ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS","true")
    monkeypatch.setenv("ENABLE_OPENAI_IMAGE_PROVIDER","true")
    monkeypatch.setenv("OPENAI_IMAGE_MODEL",PHOTO_EDIT_MODEL)


def test_mock_edit_normalizes_photo_and_uses_only_curated_scene(enabled):
    images=FakeImages()
    result=edit_private_reference_portrait(fake_photo(),page_number=1,
        style="storybook",hero_mode="astronaut",
        explicit_external_transfer_consent=True,
        client=SimpleNamespace(images=images))
    assert result.startswith(bytes((137,80,78,71,13,10,26,10)))
    assert len(images.calls)==1
    args=images.calls[0]
    assert args["model"]==PHOTO_EDIT_MODEL
    assert args["size"]=="1024x1024"
    assert args["output_format"]=="png"
    assert args["n"]==1
    assert args["image"].name=="reference.jpg"
    assert args["image"].getvalue().startswith(bytes((255,216,255)))
    assert b"SECRET_GPS_TEST_SENTINEL" not in args["image"].getvalue()
    assert "astronaut" in args["prompt"]
    assert "SECRET_GPS_TEST_SENTINEL" not in args["prompt"]


def test_identical_character_guide_across_pages_but_different_scene():
    a=build_reference_edit_prompt(1,"watercolor","explorer")
    b=build_reference_edit_prompt(2,"watercolor","explorer")
    assert "teal travel coat" in a and "teal travel coat" in b
    assert a!=b
    assert "flowering path" in a
    assert "paper lantern" in b
    assert "recognizable general facial features" in a
    assert "same outfit" in a


@pytest.mark.parametrize("page,style,hero",[
    (0,"watercolor","explorer"),(21,"storybook","explorer"),
    (True,"watercolor","explorer"),(1,"unknown","explorer"),
    (1,"storybook","real_name"),(1,"storybook","superhero franchise"),
])
def test_prompt_rejects_unapproved_values(page,style,hero):
    with pytest.raises(ValueError):
        build_reference_edit_prompt(page,style,hero)


@pytest.mark.parametrize("flag",[
    "ENABLE_DEV_PHOTO_UPLOAD","ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS",
    "ENABLE_OPENAI_IMAGE_PROVIDER",
])
def test_all_edit_flags_required(enabled,monkeypatch,flag):
    monkeypatch.setenv(flag,"false")
    images=FakeImages()
    with pytest.raises(RuntimeError):
        edit_private_reference_portrait(fake_photo(),page_number=1,
            style="storybook",hero_mode="explorer",
            explicit_external_transfer_consent=True,
            client=SimpleNamespace(images=images))
    assert images.calls==[]


@pytest.mark.parametrize("env",["preview","staging","production"])
def test_never_calls_provider_outside_local_development(enabled,monkeypatch,env):
    monkeypatch.setenv("APP_ENV",env)
    images=FakeImages()
    with pytest.raises(RuntimeError):
        edit_private_reference_portrait(fake_photo(),page_number=1,
            style="storybook",hero_mode="explorer",
            explicit_external_transfer_consent=True,
            client=SimpleNamespace(images=images))
    assert images.calls==[]


def test_parent_must_explicitly_consent_to_external_transfer(enabled):
    images=FakeImages()
    for consent in (False,None,"true",1):
        with pytest.raises(PermissionError):
            edit_private_reference_portrait(fake_photo(),page_number=1,
                style="storybook",hero_mode="storybook",
                explicit_external_transfer_consent=consent,
                client=SimpleNamespace(images=images))
    assert not images.calls


@pytest.mark.parametrize("bad",[
    SimpleNamespace(data=[]),
    SimpleNamespace(data=[SimpleNamespace(b64_json=None)]),
    SimpleNamespace(data=[SimpleNamespace(b64_json="*INVALID*")]),
    SimpleNamespace(data=[SimpleNamespace(b64_json=base64.b64encode(b"bad").decode())]),
])
def test_bad_provider_response_rejected(enabled,bad):
    images=FakeImages(bad)
    with pytest.raises(ValueError):
        edit_private_reference_portrait(fake_photo(),page_number=1,
            style="storybook",hero_mode="storybook",
            explicit_external_transfer_consent=True,
            client=SimpleNamespace(images=images))
    assert len(images.calls)==1


def test_provider_error_has_no_automatic_paid_retry(enabled):
    class BrokenImages:
        def __init__(self):self.count=0
        def edit(self,**kwargs):
            self.count+=1
            raise TimeoutError("simulated uncertain charge")
    images=BrokenImages()
    with pytest.raises(TimeoutError):
        edit_private_reference_portrait(fake_photo(),page_number=1,
            style="storybook",hero_mode="storybook",
            explicit_external_transfer_consent=True,
            client=SimpleNamespace(images=images))
    assert images.count==1


def test_adapter_has_no_api_route_or_implicit_database_access():
    source=Path(__file__).with_name("private_reference_image_edits.py").read_text()
    backend=Path(__file__).with_name("secure_main.py").read_text()
    assert "FastAPI(" not in source
    assert "@app." not in source
    assert "import secure_main" not in source
    assert "private_reference_image_edits" not in backend
    assert "write_bytes(" not in source
