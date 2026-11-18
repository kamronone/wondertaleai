import json
import os
from types import SimpleNamespace

import pytest

from ai_generation import GenerateStoryInput, generate_story, validate_generated_story

def valid_story(language="ru"):
    return json.dumps({
        "title": {"ru":"Амир и волшебная ночь","uz":"Amir va sehrli tun","en":"Amir and the Magical Night"}[language],
        "language":language,
        "pages":["A calm child-friendly scene, where Amir helps his friends discover the magic of kindness and courage."]*8
    },ensure_ascii=False)

def test_generated_story_validates_eight_pages():
    data=validate_generated_story(valid_story("en"),"en")
    assert len(data.pages)==8
    assert data.language=="en"

@pytest.mark.parametrize("language",["ru","uz","en"])
def test_language_mismatch_is_rejected(language):
    wrong="ru" if language!="ru" else "en"
    with pytest.raises(ValueError):
        validate_generated_story(valid_story(wrong),language)

def test_too_few_pages_rejected():
    payload=json.loads(valid_story())
    payload["pages"]=payload["pages"][:3]
    with pytest.raises(ValueError):
        validate_generated_story(json.dumps(payload),"ru")

def test_ai_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("ENABLE_TEXT_AI",raising=False)
    request=GenerateStoryInput(name="Amir",age=5,language="en",idea="A gentle journey to a hidden garden")
    with pytest.raises(RuntimeError,match="disabled"):
        generate_story(request)

def test_ai_adapter_uses_no_child_photo(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    class FakeResponses:
        def create(self,**kwargs):
            assert "photo" not in kwargs["input"].lower()
            assert kwargs["store"] is False
            return SimpleNamespace(output_text=valid_story("en"))
    fake=SimpleNamespace(responses=FakeResponses())
    request=GenerateStoryInput(name="Amir",age=5,language="en",idea="A gentle journey to a hidden garden")
    assert len(generate_story(request,client=fake).pages)==8
