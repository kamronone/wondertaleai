"""Offline moderation contracts, no provider traffic."""
import json
from types import SimpleNamespace

import pytest

from ai_generation import GenerateStoryInput, StoryContinuation, generate_story
from story_moderation import StoryModerationDenied, moderate_story_text, validate_private_text


def payload(**kwargs):
    return GenerateStoryInput(**({"name":"Sam","age":7,"language":"en",
        "idea":"A friendly star visits a magical forest"}|kwargs))


def synthetic_story():
    return json.dumps({"title":"The Friendly Star","language":"en","pages":[
        f"A gentle child discovers the magical garden at stop {i}. Friends help the child explore the forest and learn a new lesson."
        for i in range(1,9)]})


class FakeClient:
    def __init__(self,decisions=(False,False)):
        self.moderations=SimpleNamespace(create=self.moderate)
        self.responses=SimpleNamespace(create=self.generate)
        self.decisions=iter(decisions)
        self.calls=[]
    def moderate(self,**kwargs):
        self.calls.append(("moderation",kwargs))
        flag=next(self.decisions)
        return SimpleNamespace(results=[SimpleNamespace(flagged=flag) for _ in kwargs["input"]])
    def generate(self,**kwargs):
        self.calls.append(("generation",kwargs))
        return SimpleNamespace(status="completed",output_text=synthetic_story())


@pytest.fixture(autouse=True)
def gates(monkeypatch):
    monkeypatch.setenv("ENABLE_TEXT_AI","true")
    monkeypatch.setenv("ENABLE_STORY_MODERATION","true")


def test_input_and_output_are_checked_in_order():
    client=FakeClient()
    story=generate_story(payload(),client)
    assert len(story.pages)==8
    assert [kind for kind,_ in client.calls]==["moderation","generation","moderation"]
    assert client.calls[2][1]["input"]==[story.title,*story.pages]
    assert client.calls[1][1]["store"] is False


def test_flagged_input_never_calls_generation():
    client=FakeClient((True,))
    with pytest.raises(StoryModerationDenied):
        generate_story(payload(),client)
    assert [kind for kind,_ in client.calls]==["moderation"]


def test_flagged_output_never_returns_story():
    client=FakeClient((False,True))
    with pytest.raises(StoryModerationDenied):
        generate_story(payload(),client)
    assert len(client.calls)==3


@pytest.mark.parametrize("text",["Email test@example.invalid","Call +998 90 123 45 67","Visit https://example.invalid"])
def test_contact_details_are_blocked_before_provider(text):
    client=FakeClient()
    with pytest.raises(StoryModerationDenied):
        generate_story(payload(idea=text),client)
    assert not client.calls


def test_sequel_context_is_checked_with_input():
    client=FakeClient()
    context=StoryContinuation("Earlier adventure",tuple(f"Earlier event {i}" for i in range(8)))
    generate_story(payload(),client,continuation=context)
    assert all(chapter in client.calls[0][1]["input"] for chapter in context.chapters)


@pytest.mark.parametrize("results",[None,[],[SimpleNamespace(flagged=None)],[SimpleNamespace(flagged=0)]])
def test_missing_or_invalid_result_fails_closed(results):
    client=SimpleNamespace(moderations=SimpleNamespace(create=lambda **kw:SimpleNamespace(results=results)))
    with pytest.raises(StoryModerationDenied):
        moderate_story_text(["A fictional story"],client)


def test_moderation_unavailable_fails_closed():
    def fail(**kwargs):
        raise TimeoutError("sensitive internal detail")
    client=SimpleNamespace(moderations=SimpleNamespace(create=fail))
    with pytest.raises(StoryModerationDenied,match="Moderation service unavailable"):
        moderate_story_text(["A fictional story"],client)
