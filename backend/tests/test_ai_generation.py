import json
import os
from types import SimpleNamespace

import pytest

from ai_generation import GenerateStoryInput, generate_story, validate_generated_story

# Distinct test chapters: a valid provider fixture must not rely on numbering
# identical paragraphs. These samples are synthetic, never provider output.
CHAPTERS = [
    "Amir finds a tiny lantern under the old oak tree and carefully carries it home to show his friends.",
    "The lantern glows softly when the children promise to help a lost bird find its way back to the nest.",
    "At sunrise the friends follow a winding path beside the river and discover a bridge covered in leaves.",
    "They collect the fallen branches together and repair the bridge so the forest animals can cross safely.",
    "A rabbit offers them a basket of berries and explains that the garden gate has been closed by the wind.",
    "Amir notices a little silver key among the flowers and asks the gardener whether it belongs to her.",
    "The gardener opens the gate and invites everyone to plant seeds that will bloom in the coming spring.",
    "The children share their lantern with the shy hedgehog and sit quietly until he feels comfortable nearby.",
    "A gentle rain begins to fall, so the friends build a shelter using leaves and the sticks they collected.",
    "When the clouds disappear, a rainbow leads the children to a hill where an injured butterfly is resting.",
    "They place the butterfly near a warm flower and watch its wings slowly become strong enough to fly.",
    "The butterfly circles a stone fountain, revealing a narrow trail to a meadow filled with golden grass.",
    "In the meadow Amir hears a small bell and helps a shepherd guide three wandering sheep back home.",
    "The grateful shepherd gives each friend a ribbon to remind them of the importance of working together.",
    "As evening approaches, the children notice the lantern becoming dim and decide to return to the village.",
    "They follow the repaired bridge across the river, stopping to see the little bird sleeping in its nest.",
    "Near the garden gate, they water the seeds one final time and thank the gardener for her patient advice.",
    "The villagers welcome them with warm bread and listen as the children explain what they learned that day.",
    "Amir places the lantern on a windowsill where it can shine for any traveler who needs a little guidance.",
    "Before falling asleep, he remembers that kindness is the brightest magic and dreams of another gentle adventure.",
]

def valid_story(language="ru"):
    return json.dumps({
        "title": {"ru":"Амир и волшебная ночь","uz":"Amir va sehrli tun","en":"Amir and the Magical Night"}[language],
        "language":language,
        "pages":CHAPTERS[:8]
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
    payload["pages"]=CHAPTERS[:pages]
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
            output["pages"]=CHAPTERS[:12]
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


@pytest.mark.parametrize("title",["  A  ","  AB  ","   "])
def test_short_generated_title_rejected_after_trimming(title):
    payload=json.loads(valid_story("en"))
    payload["title"]=title
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(payload),"en")


@pytest.mark.parametrize("raw",[
    "", "not json", "{}", "[]", '{"title":"Book","language":"en","pages":null}',
    '{"title":"Book","language":"en","pages":["short"]}',
])
def test_malformed_provider_output_is_rejected(raw):
    with pytest.raises(ValueError,match="Model did not return a valid story"):
        validate_generated_story(raw,"en")


def test_provider_markdown_json_fence_is_supported():
    raw="\x60\x60\x60json\n"+valid_story("en")+"\n\x60\x60\x60"
    result=validate_generated_story(raw,"en")
    assert result.language=="en" and len(result.pages)==8


def test_provider_page_with_only_whitespace_is_rejected():
    payload=json.loads(valid_story("en"))
    payload["pages"][0]=" "*100
    with pytest.raises(ValueError,match="Model did not return a valid story"):
        validate_generated_story(json.dumps(payload),"en")


@pytest.mark.parametrize("raw",[None,42,{},["unexpected"]])
def test_non_text_provider_output_is_rejected(raw):
    with pytest.raises(ValueError,match="Model did not return a valid story"):
        validate_generated_story(raw,"en")


def test_full_length_story_rejects_repeated_pages_with_different_whitespace():
    payload=json.loads(valid_story("en"))
    pages=[f"Chapter {index+1}: "+payload["pages"][0] for index in range(20)]
    pages[19]="  "+pages[3].upper()+"  "
    payload["pages"]=pages
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(payload),"en",20)

@pytest.mark.parametrize("count",[8,12,20])
def test_repeated_chapter_text_cannot_be_hidden_by_page_labels(count):
    payload=json.loads(valid_story("en"))
    payload["pages"]=[f"Chapter {index+1}: {CHAPTERS[0]}" for index in range(count)]
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(payload),"en",count)

def test_duplicate_chapter_in_otherwise_distinct_story_is_rejected():
    payload=json.loads(valid_story("en"))
    payload["pages"][7]="  "+payload["pages"][3].upper()+"  "
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(payload),"en")


@pytest.mark.parametrize("raw_suffix", ["\n```\nUnexpected trailing prose", "\n```\n```"])
def test_json_fence_rejects_trailing_material(raw_suffix):
    with pytest.raises(ValueError, match="valid story"):
        validate_generated_story("```json\n"+valid_story("en")+raw_suffix,"en")


def test_provider_extra_properties_are_rejected():
    data=json.loads(valid_story("en"))
    data["unexpected"]="not part of story schema"
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(data),"en")


@pytest.mark.parametrize("lang",["ru","uz","en"])
def test_quality_check_accepts_expected_script(lang):
    from ai_generation import validate_story_quality
    pages={
        "ru":["Амир и его друзья отправились в добрый волшебный лес, чтобы помочь маленьким зверятам."]*8,
        "uz":["Amir va uning döstlari sehrli ötmonda mehribon hayvonlarga yordam beriş uçun birga yölga çiqdilar."]*8,
        "en":CHAPTERS[:8],
    }
    # Quality function is independent of structural duplicate checks.
    from ai_generation import GeneratedStory
    validate_story_quality(GeneratedStory(title="Test",language=lang,pages=pages[lang]))


def test_quality_check_rejects_wrong_script_in_one_chapter():
    from ai_generation import validate_story_quality
    data=json.loads(valid_story("en"))
    data["pages"][4]="Амир вместе с друзьями отправился в волшебный лес и помог маленьким птицам найти дорогу домой."
    with pytest.raises(ValueError,match="script"):
        validate_story_quality(validate_generated_story(json.dumps(data),"en"))


@pytest.mark.parametrize("lang,ending",[
    ("en","To be continued!"),("ru","Продолжение следует…"),("uz","Davomi bor."),
])
def test_quality_rejects_explicit_unfinished_ending(lang,ending):
    from ai_generation import GeneratedStory,validate_story_quality
    chapter={
        "en":CHAPTERS[0],
        "ru":"Амир и его друзья отправились в добрый волшебный лес, чтобы помочь маленьким зверятам.",
        "uz":"Amir va uning döstlari sehrli örmonda mehribon hayvonlarga yordam beriş uçun birga yölga çiqdilar.",
    }[lang]
    pages=[chapter]*7+[chapter+" "+ending]
    with pytest.raises(ValueError,match="continuation marker"):
        validate_story_quality(GeneratedStory(title="Test",language=lang,pages=pages))


def test_opt_in_mock_exercises_same_quality_gate(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("ENABLE_STORY_OUTPUT_QUALITY_CHECKS","true")
    data=GenerateStoryInput(name="Amir",age=7,language="ru",idea="A friendly forest adventure")
    client=SimpleNamespace(responses=SimpleNamespace(create=lambda **kwargs:SimpleNamespace(output_text=valid_story("ru"))))
    with pytest.raises(ValueError,match="script"):
        generate_story(data,client=client)
