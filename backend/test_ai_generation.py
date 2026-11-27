"""Offline contract tests for AI story generation. No external requests."""
from types import SimpleNamespace

import pytest

from ai_generation import GenerateStoryInput, generate_story, validate_generated_story


def _story(language="uz", count=8):
    import json
    return json.dumps({
        "title": "Mehribon yulduz",
        "language": language,
        "pages": [f"Chapter {index+1}: A friendly child discovers the magical garden at stop {index+1}. The forest friends help the child explore safely and learn a new lesson." for index in range(count)],
    })


class FakeResponses:
    def __init__(self, output):
        self.output = output
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        return SimpleNamespace(output_text=self.output)


def test_generation_uses_private_provider_request(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI", "true")
    responses = FakeResponses(_story())
    client = SimpleNamespace(responses=responses)
    payload = GenerateStoryInput(
        name="Sam", age=7, language="uz",
        idea="A friendly star teaches forest animals to help each other",
    )
    result = generate_story(payload, client=client)
    assert result.language == "uz"
    assert len(result.pages) == 8
    assert len(responses.calls) == 1
    call = responses.calls[0]
    assert call["store"] is False
    assert call["text"]["format"]["type"] == "json_schema"
    assert call["text"]["format"]["strict"] is True
    schema = call["text"]["format"]["schema"]
    assert schema["required"] == ["title", "language", "pages"]
    assert schema["properties"]["language"]["enum"] == ["uz"]
    assert schema["properties"]["pages"]["items"]["type"] == "string"
    assert schema["additionalProperties"] is False
    assert "photo" not in call["input"].lower()
    assert "Sam" in call["input"]
    assert "Ş ş" in call["instructions"]


@pytest.mark.parametrize("language,count", [("ru", 8), ("uz", 12), ("en", 20)])
def test_valid_story_contract(language, count):
    story = validate_generated_story(_story(language, count), language, count)
    assert len(story.pages) == count


def test_story_rejects_wrong_language():
    with pytest.raises(ValueError):
        validate_generated_story(_story("en"), "uz", 8)


def test_story_rejects_wrong_page_count():
    with pytest.raises(ValueError):
        validate_generated_story(_story("uz", 12), "uz", 8)


def test_generation_is_disabled_without_explicit_opt_in(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI", "false")
    payload = GenerateStoryInput(
        name="Sam", age=7,
        idea="A friendly star teaches forest animals to help each other",
    )
    with pytest.raises(RuntimeError, match="disabled"):
        generate_story(payload, client=SimpleNamespace(responses=FakeResponses(_story())))


@pytest.mark.parametrize("language,count", [("ru", 8), ("uz", 12), ("en", 20)])
def test_strict_story_schema_is_language_scoped_and_page_count_is_verified(monkeypatch, language, count):
    monkeypatch.setenv("ENABLE_TEXT_AI", "true")
    responses = FakeResponses(_story(language, count))
    payload = GenerateStoryInput(
        name="Sam", age=7, language=language, pages_count=count,
        idea="A gentle original adventure in the magical forest",
    )
    result = generate_story(payload, client=SimpleNamespace(responses=responses))
    assert len(result.pages) == count
    args = responses.calls[0]
    assert args["text"]["format"]["schema"]["properties"]["language"]["enum"] == [language]
    assert args["store"] is False


def test_structured_generation_still_rejects_wrong_page_count(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI", "true")
    payload = GenerateStoryInput(
        name="Sam", age=7, language="en", pages_count=12,
        idea="A gentle original adventure in the magical forest",
    )
    with pytest.raises(ValueError, match="valid story"):
        generate_story(payload, client=SimpleNamespace(responses=FakeResponses(_story("en", 8))))


def test_structured_generation_rejects_missing_or_non_json_model_output(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI", "true")
    payload = GenerateStoryInput(
        name="Sam", age=7, language="en",
        idea="A gentle original adventure in the magical forest",
    )
    for output in ("", "This story is unavailable", '{"pages": []}'):
        with pytest.raises(ValueError, match="valid story"):
            generate_story(payload, client=SimpleNamespace(responses=FakeResponses(output)))


def test_twenty_page_ai_stories_require_distinct_chapters():
    import json
    payload=json.loads(_story("en",20))
    payload["pages"][18]=payload["pages"][7]
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(payload),"en",20)


def test_full_story_prompt_requires_causal_arc_and_real_conclusion(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    responses=FakeResponses(_story("en",20))
    payload=GenerateStoryInput(name="Sam",age=7,language="en",pages_count=20,idea="An adventurous journey to a kind magical forest")
    generate_story(payload,client=SimpleNamespace(responses=responses))
    instructions=responses.calls[0]["instructions"]
    assert "one continuous plot" in instructions
    assert "climax" in instructions
    assert "resolve the central problem on the final page" in instructions
    assert "do not repeat the same paragraph" in instructions
    assert "Maintain consistent characters" in instructions
    assert "to be continued" in instructions
    assert responses.calls[0]["store"] is False

@pytest.mark.parametrize("count", [8,12,20])
def test_repeated_chapter_text_cannot_be_hidden_by_numbering(count):
    import json
    raw=json.loads(_story("en",count))
    raw["pages"]=[f"Chapter {i+1}: "+"A gentle story about forest friends and their magical adventure. "*2 for i in range(count)]
    with pytest.raises(ValueError,match="valid story"):
        validate_generated_story(json.dumps(raw),"en",count)

def test_incomplete_provider_response_rejected(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    payload=GenerateStoryInput(name="Sam",age=7,language="en",idea="A friendly star visits the forest")
    class Incomplete:
        def create(self,**kwargs):
            return SimpleNamespace(status="incomplete",output_text=_story("en"))
    with pytest.raises(ValueError,match="completed story"):
        generate_story(payload,client=SimpleNamespace(responses=Incomplete()))


def test_sequel_uses_previous_story_as_data(monkeypatch):
    import json
    from ai_generation import StoryContinuation
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    previous=StoryContinuation("The old adventure",tuple("Earlier adventure "+str(i) for i in range(8)))
    responses=FakeResponses(_story("en",8))
    payload=GenerateStoryInput(name="Sam",age=7,language="en",idea="A new journey to a magical garden")
    result=generate_story(payload,client=SimpleNamespace(responses=responses),continuation=previous)
    assert len(result.pages)==8
    call=responses.calls[0]
    assert json.loads(call["input"])["preceding_story"]=={"title":previous.title,"chapters":list(previous.chapters)}
    assert "untrusted fictional reference data" in call["instructions"]
    assert "Begin after its ending" in call["instructions"]
    assert call["store"] is False


def test_sequel_rejects_copied_preceding_chapters(monkeypatch):
    import json
    from ai_generation import StoryContinuation
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    previous=StoryContinuation("The old adventure",tuple(json.loads(_story("en",8))["pages"]))
    responses=FakeResponses(_story("en",8))
    payload=GenerateStoryInput(name="Sam",age=7,language="en",idea="A new journey to a magical garden")
    with pytest.raises(ValueError,match="repeats a preceding chapter"):
        generate_story(payload,client=SimpleNamespace(responses=responses),continuation=previous)


def test_sequel_rejects_oversized_context_before_provider(monkeypatch):
    from ai_generation import StoryContinuation
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    previous=StoryContinuation("The old adventure",tuple("x"*1201 for _ in range(8)))
    responses=FakeResponses(_story("en",8))
    payload=GenerateStoryInput(name="Sam",age=7,language="en",idea="A new journey to a magical garden")
    with pytest.raises(ValueError,match="preceding story context"):
        generate_story(payload,client=SimpleNamespace(responses=responses),continuation=previous)
    assert not responses.calls
