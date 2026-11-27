"""Pure continuity plan regressions; no personal data or network."""
import pytest

from private_character_continuity import (
    PLAN_VERSION, plan_reference_book, build_character_sheet_prompt,
    build_character_sheet_page_prompt,
)
from private_reference_image_edits import PHOTO_EDIT_MODES
from illustration_planning import STYLES, SCENES

BOOK = "12345678-1234-4234-8234-123456789abc"
OTHER_BOOK = "22345678-1234-4234-8234-123456789abc"

@pytest.mark.parametrize("count", [8, 12, 20])
@pytest.mark.parametrize("style", list(STYLES))
@pytest.mark.parametrize("hero", list(PHOTO_EDIT_MODES))
def test_whole_book_character_is_consistent(count, style, hero):
    chapters = ["A quiet journey."] * count
    plan = plan_reference_book(BOOK, chapters, style, hero)
    assert plan.version == PLAN_VERSION
    assert len(plan.pages) == count
    assert [p.page_number for p in plan.pages] == list(range(1, count + 1))
    assert len({p.scene_number for p in plan.pages}) == count
    assert PHOTO_EDIT_MODES[hero] in plan.character_prompt
    for page in plan.pages:
        assert PHOTO_EDIT_MODES[hero] in page.reference_prompt
        assert PHOTO_EDIT_MODES[hero] in page.character_sheet_prompt
        assert SCENES[page.scene_number - 1] in page.character_sheet_prompt
        assert "approved illustrated character reference" in page.character_sheet_prompt
    assert plan == plan_reference_book(BOOK, chapters, style, hero)
    assert len(plan.fingerprint) == 64

def test_private_text_and_book_identifier_never_enter_prompts():
    chapters = ["PRIVATE_SENTINEL_1234"] * 8
    plan = plan_reference_book(BOOK, chapters, "storybook", "explorer")
    assert "PRIVATE_SENTINEL_1234" not in repr(plan)
    assert BOOK not in repr(plan)
    assert plan == plan_reference_book(OTHER_BOOK, chapters, "storybook", "explorer")

def test_plan_fingerprint_changes_when_hero_or_style_changes():
    chapters = ["A quiet journey."] * 8
    initial = plan_reference_book(BOOK, chapters, "storybook", "explorer")
    assert initial.fingerprint != plan_reference_book(BOOK, chapters, "pencil", "explorer").fingerprint
    assert initial.fingerprint != plan_reference_book(BOOK, chapters, "storybook", "astronaut").fingerprint

@pytest.mark.parametrize("scene", [True, 0, 21, "1"])
def test_unapproved_scene_rejected(scene):
    with pytest.raises(ValueError):
        build_character_sheet_page_prompt(scene, "storybook", "explorer")

@pytest.mark.parametrize("style,hero", [("custom", "explorer"), ("storybook", "private name")])
def test_unapproved_character_rejected(style, hero):
    with pytest.raises(ValueError):
        build_character_sheet_prompt(style, hero)
