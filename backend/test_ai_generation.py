"""Offline contract tests for AI story generation. No external requests."""
from types import SimpleNamespace

import pytest

from ai_generation import GenerateStoryInput, generate_story, validate_generated_story


def _story(language="uz", count=8):
    import json
    return json.dumps({
        "title": "Mehribon yulduz",
        "language": language,
        "pages": ["A gentle original story for children. " * 5 for _ in range(count)],
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
