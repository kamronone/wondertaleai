"""Contract tests for private, non-provider illustration briefs."""
import uuid
import pytest
from illustration_planning import STYLES,MASCOTS,illustration_brief


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
