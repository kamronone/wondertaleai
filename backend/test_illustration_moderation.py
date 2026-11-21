"""Offline checks for text+image moderation and guarded rendering."""
import base64
import uuid
from io import BytesIO
from types import SimpleNamespace

import pytest
from PIL import Image

from illustration_planning import illustration_brief
from illustration_moderation import moderate_illustration_prompt,moderate_illustration_image
from approved_illustration_runner import run_one_approved_illustration


class MockModerations:
    def __init__(self,flagged=False,categories=None):
        self.flagged=flagged
        self.categories={"violence":False,"sexual":False} if categories is None else categories
        self.calls=[]
    def create(self,**kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(results=[SimpleNamespace(
            flagged=self.flagged,categories=self.categories)])


def png():
    result=BytesIO()
    Image.new("RGB",(96,96),(120,100,210)).save(result,format="PNG")
    return result.getvalue()


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("APP_ENV","preview")
    for name in ("ENABLE_AI_ILLUSTRATIONS","ENABLE_AI_ILLUSTRATIONS_WORKER",
                 "ENABLE_OPENAI_IMAGE_PROVIDER","ENABLE_OPENAI_IMAGE_MODERATION"):
        monkeypatch.setenv(name,"true")
    return illustration_brief(str(uuid.uuid4()),1,"watercolor").prompt


def test_moderates_only_curated_prompt_and_png(enabled):
    mod=MockModerations()
    client=SimpleNamespace(moderations=mod)
    assert moderate_illustration_prompt(enabled,client=client) is True
    assert mod.calls[0]=={"model":"omni-moderation-latest","input":[{"type":"text","text":enabled}]}
    assert moderate_illustration_image(png(),client=client) is True
    image_input=mod.calls[1]["input"][0]
    assert image_input["type"]=="image_url"
    assert image_input["image_url"]["url"].startswith("data:image/png;base64,")
    assert base64.b64decode(image_input["image_url"]["url"].split(",",1)[1]).startswith(bytes((137,80,78,71)))


@pytest.mark.parametrize("flag",["ENABLE_AI_ILLUSTRATIONS","ENABLE_AI_ILLUSTRATIONS_WORKER",
 "ENABLE_OPENAI_IMAGE_PROVIDER","ENABLE_OPENAI_IMAGE_MODERATION"])
def test_moderation_requires_all_gates(enabled,monkeypatch,flag):
    monkeypatch.setenv(flag,"false")
    mod=MockModerations()
    with pytest.raises(RuntimeError,match="disabled"):
        moderate_illustration_prompt(enabled,client=SimpleNamespace(moderations=mod))
    assert not mod.calls


@pytest.mark.parametrize("flagged,categories",[
    (True,{"violence":False}), (False,{"violence":True}),
    (None,{"violence":False}),(False,{}),(False,{"unknown":None}),
])
def test_prompt_rejects_uncertain_or_flagged_moderation(enabled,flagged,categories):
    client=SimpleNamespace(moderations=MockModerations(flagged,categories))
    assert moderate_illustration_prompt(enabled,client=client) is False


def test_bad_images_and_freeform_text_never_reach_moderator(enabled):
    mod=MockModerations()
    client=SimpleNamespace(moderations=mod)
    assert moderate_illustration_prompt("An identifiable child is shown in her home",client=client) is False
    assert moderate_illustration_image(b"not an image",client=client) is False
    assert moderate_illustration_image(b"z"*3_000_001,client=client) is False
    assert mod.calls==[]


def test_moderation_provider_failure_does_not_allow_generation(enabled):
    class Broken:
        def create(self,**kwargs):
            raise TimeoutError("simulated moderation timeout")
    client=SimpleNamespace(moderations=Broken())
    with pytest.raises(TimeoutError):
        moderate_illustration_prompt(enabled,client=client)


def test_runner_requires_moderation_flag_before_claim(monkeypatch):
    monkeypatch.setenv("ENABLE_OPENAI_IMAGE_MODERATION","false")
    with pytest.raises(RuntimeError,match="disabled"):
        run_one_approved_illustration(image_client=object(),moderation_client=object())
