"""Contract tests for private, non-provider illustration briefs."""
import uuid
import pytest
from illustration_planning import STYLES,MASCOTS,SCENES,illustration_brief


def test_stable_character_and_style_between_pages():
    book=str(uuid.uuid4())
    first=illustration_brief(book,1,"watercolor")
    second=illustration_brief(book,2,"watercolor")
    repeat=illustration_brief(book,1,"watercolor")
    assert first==repeat
    assert first.character_guide==second.character_guide
    assert first.scene!=second.scene
    assert "watercolor" in first.prompt
    assert first.character_guide in second.prompt
    assert second.page_number==2


@pytest.mark.parametrize("style",list(STYLES))
def test_only_curated_fictional_content_enters_brief(style):
    brief=illustration_brief(str(uuid.uuid4()),8,style)
    assert brief.character_guide in MASCOTS
    assert "identifying information" in brief.prompt
    assert "original" in brief.prompt.lower()
    assert "no text or logos" in brief.prompt


@pytest.mark.parametrize("invalid",["not-a-book","",None])
def test_invalid_book_id_rejected(invalid):
    with pytest.raises(ValueError):
        illustration_brief(invalid,1,"watercolor")


@pytest.mark.parametrize("page",[0,21,-1,True,3.14])
def test_invalid_page_rejected(page):
    with pytest.raises(ValueError):
        illustration_brief(str(uuid.uuid4()),page,"storybook")


def test_unknown_style_rejected():
    with pytest.raises(ValueError):
        illustration_brief(str(uuid.uuid4()),1,"photorealistic")


def test_all_twenty_long_story_pages_get_distinct_illustration_briefs():
    book=str(uuid.uuid4())
    briefs=[illustration_brief(book,page,"storybook") for page in range(1,21)]
    assert len(SCENES)==20
    assert len(set(SCENES))==20
    assert len(set(brief.scene for brief in briefs))==20
    assert len(set(brief.prompt for brief in briefs))==20
    assert {brief.page_number for brief in briefs}==set(range(1,21))
    assert len(set(brief.character_guide for brief in briefs))==1
    assert all(brief.character_guide in brief.prompt for brief in briefs)


@pytest.mark.parametrize("length",[8,12,20])
def test_chapter_images_never_repeat_within_supported_story_length(length):
    book=str(uuid.uuid4())
    scenes=[illustration_brief(book,page,"watercolor").scene for page in range(1,length+1)]
    assert len(set(scenes))==length
    assert scenes[0]=="walking beside a flowering path in the morning"
    assert scenes[7]=="watching the first stars appear in the sky"


def test_long_story_does_not_leak_parent_data_or_child_details():
    book=str(uuid.uuid4())
    for page in range(1,21):
        prompt=illustration_brief(book,page,"watercolor").prompt
        assert book not in prompt
        assert "identifying information" in prompt
        assert "No realistic child likeness" in prompt
        assert "no text or logos" in prompt
        assert all(name not in prompt for name in ["child_name","parent_email","private_story_text"])


def test_same_book_page_remains_stable_on_repeat():
    book=str(uuid.uuid4())
    assert illustration_brief(book,20,"pencil")==illustration_brief(book,20,"pencil")
    assert illustration_brief(book,9,"storybook").scene!=illustration_brief(book,1,"storybook").scene
