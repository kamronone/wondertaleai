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


@pytest.mark.parametrize("pages",[8,12,20])
def test_expected_book_lengths(pages):
    payload=json.loads(valid_story("en"))
    payload["pages"]=payload["pages"][:1]*pages
    result=validate_generated_story(json.dumps(payload),"en",pages)
    assert len(result.pages)==pages

def test_wrong_page_count_rejected_for_requested_length():
    with pytest.raises(ValueError):
        validate_generated_story(valid_story("en"),"en",12)

def test_multiple_heroes_and_requested_length_in_ai_prompt(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    class FakeResponses:
        def create(self,**kwargs):
            parsed=json.loads(kwargs["input"])
            assert parsed["other_heroes"]==["Aliya","Omar"]
            assert parsed["pages_count"]==12
            assert kwargs["store"] is False
            output=json.loads(valid_story("en"))
            output["pages"]=output["pages"][:1]*12
            return SimpleNamespace(output_text=json.dumps(output))
    client=SimpleNamespace(responses=FakeResponses())
    data=GenerateStoryInput(name="Amir",age=5,language="en",idea="A magical forest journey with friends",other_heroes=["Aliya","Omar"],pages_count=12)
    assert len(generate_story(data,client=client).pages)==12


@pytest.mark.parametrize("field,value",[
    ("name","   "),("idea","            "),("style","  "),
])
def test_blank_ai_request_fields_rejected(field,value):
    from pydantic import ValidationError
    kwargs={"name":"Amir","age":5,"idea":"A magical garden adventure"}
    kwargs[field]=value
    with pytest.raises(ValidationError):
        GenerateStoryInput(**kwargs)


@pytest.mark.parametrize("hero",["   ","x"*46])
def test_invalid_additional_hero_rejected(hero):
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        GenerateStoryInput(name="Amir",age=5,idea="A magical garden adventure",other_heroes=[hero])


def test_story_fields_are_trimmed_and_classic_can_be_empty():
    data=GenerateStoryInput(name="  Amir  ",age=5,idea="  A magical garden adventure  ",other_heroes=["  Aliya  "])
    assert data.name=="Amir"
    assert data.idea=="A magical garden adventure"
    assert data.other_heroes==["Aliya"]
    assert data.classic_title==""


def test_whitespace_only_title_rejected():
    payload=json.loads(valid_story("en"))
    payload["title"]="   "
    with pytest.raises(ValueError):
        validate_generated_story(json.dumps(payload),"en")


def test_generated_title_is_trimmed_before_storage():
    payload=json.loads(valid_story("en"))
    payload["title"]="  Amir and the Magical Night  "
    parsed=validate_generated_story(json.dumps(payload),"en")
    assert parsed.title=="Amir and the Magical Night"
