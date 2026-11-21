"""Offline provider-adapter contract tests. Never contact OpenAI."""
import base64
from io import BytesIO
from types import SimpleNamespace
import uuid

import pytest
from PIL import Image,PngImagePlugin

from illustration_planning import illustration_brief
from openai_illustration_provider import generate_private_illustration


def sample_png()->bytes:
    image=Image.new("RGB",(128,128),(75,130,180))
    metadata=PngImagePlugin.PngInfo()
    metadata.add_text("private","REMOVE-THIS-EXIF-LIKE-COMMENT")
    output=BytesIO()
    image.save(output,format="PNG",pnginfo=metadata)
    return output.getvalue()


class FakeImages:
    def __init__(self,data):
        self.data=data
        self.requests=[]
    def generate(self,**kwargs):
        self.requests.append(kwargs)
        return SimpleNamespace(data=self.data)


def client_for(payload):
    images=FakeImages(payload)
    return SimpleNamespace(images=images)


@pytest.fixture
def enabled(monkeypatch):
    monkeypatch.setenv("APP_ENV","preview")
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS","true")
    monkeypatch.setenv("ENABLE_AI_ILLUSTRATIONS_WORKER","true")
    monkeypatch.setenv("ENABLE_OPENAI_IMAGE_PROVIDER","true")
    monkeypatch.setenv("OPENAI_IMAGE_MODEL","gpt-image-1.5")
    return illustration_brief(str(uuid.uuid4()),1,"storybook").prompt


def test_approved_mock_image_becomes_metadata_free_png(enabled):
    encoded=base64.b64encode(sample_png()).decode("ascii")
    fake=client_for([SimpleNamespace(b64_json=encoded)])
    cleaned=generate_private_illustration(enabled,client=fake)
    assert cleaned.startswith(bytes((137,80,78,71)))
    assert b"REMOVE-THIS-EXIF-LIKE-COMMENT" not in cleaned
    assert fake.images.requests==[{
        "model":"gpt-image-1.5","prompt":enabled,"size":"1024x1024",
        "n":1,"output_format":"png"
    }]


@pytest.mark.parametrize("flag",[
    "ENABLE_AI_ILLUSTRATIONS",
    "ENABLE_AI_ILLUSTRATIONS_WORKER",
    "ENABLE_OPENAI_IMAGE_PROVIDER"
])
def test_every_feature_gate_is_required(enabled,monkeypatch,flag):
    fake=client_for([SimpleNamespace(b64_json=base64.b64encode(sample_png()).decode())])
    monkeypatch.setenv(flag,"false")
    with pytest.raises(RuntimeError,match="disabled"):
        generate_private_illustration(enabled,client=fake)
    assert fake.images.requests==[]


def test_production_and_unapproved_model_are_rejected(enabled,monkeypatch):
    fake=client_for([])
    monkeypatch.setenv("APP_ENV","production")
    with pytest.raises(RuntimeError,match="production"):
        generate_private_illustration(enabled,client=fake)
    monkeypatch.setenv("APP_ENV","preview")
    monkeypatch.setenv("OPENAI_IMAGE_MODEL","gpt-image-2.6-flare")
    with pytest.raises(RuntimeError,match="Unapproved"):
        generate_private_illustration(enabled,client=fake)
    assert not fake.images.requests


def test_private_child_prompt_is_rejected_before_any_provider_call(enabled):
    fake=client_for([])
    with pytest.raises(ValueError,match="curated generic"):
        generate_private_illustration("Create a picture of child Alice and her home at 123 Main Street."+" "*100,client=fake)
    assert fake.images.requests==[]


@pytest.mark.parametrize("payload",[
    [],
    [SimpleNamespace(b64_json="not-base64!")],
    [SimpleNamespace(b64_json=None)],
    [SimpleNamespace(b64_json="a"*4_000_004)],
    [SimpleNamespace(b64_json=base64.b64encode(b"not an image").decode())],
])
def test_invalid_provider_response_fails_closed(enabled,payload):
    fake=client_for(payload)
    with pytest.raises(ValueError):
        generate_private_illustration(enabled,client=fake)
    assert len(fake.images.requests)==1


def test_failed_provider_call_is_never_retried(enabled):
    class BrokenImages:
        def __init__(self):self.calls=0
        def generate(self,**kwargs):
            self.calls+=1
            raise TimeoutError("simulated uncertain provider response")
    api=SimpleNamespace(images=BrokenImages())
    with pytest.raises(TimeoutError):
        generate_private_illustration(enabled,client=api)
    assert api.images.calls==1
