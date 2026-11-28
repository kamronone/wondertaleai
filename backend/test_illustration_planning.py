"""Contract tests for private, non-provider illustration briefs."""
import uuid
import pytest
from illustration_planning import STYLES,MASCOTS,SCENES,illustration_brief,plan_story_illustrations


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


@pytest.mark.parametrize("length",[8,12,20])
def test_local_storyboard_picks_unique_curated_scenes_for_every_page(length):
    book=str(uuid.uuid4())
    chapters=[f"Ordinary chapter {i} with no fictional location specified." for i in range(length)]
    planned=plan_story_illustrations(book,chapters,"storybook")
    assert len(planned)==length
    assert len({brief.scene for brief in planned})==length
    assert [brief.page_number for brief in planned]==list(range(1,length+1))
    assert len({brief.character_guide for brief in planned})==1
    assert planned==plan_story_illustrations(book,chapters,"storybook")


def test_semantic_plan_selects_relevant_map_and_home_scenes_without_copying_private_text():
    book=str(uuid.uuid4())
    private_name="PrivateChildNameNeverInAnImagePrompt"
    chapters=["A quiet sunny day for a curious fox."]*8
    chapters[1]="In the forest the fox found a secret map of the mountain. "+private_name
    chapters[7]="Finally the fox returned home at morning sunrise. "+private_name
    planned=plan_story_illustrations(book,chapters,"watercolor")
    assert planned[1].scene==SCENES[9]
    assert planned[7].scene==SCENES[19]
    for brief in planned:
        assert private_name not in brief.prompt
        assert "secret map of the mountain" not in brief.prompt
        assert book not in brief.prompt
        assert brief.scene in SCENES
        assert brief.character_guide in MASCOTS


@pytest.mark.parametrize("bad",[[],["Hi"],["Hi"]*9,["Hi"]*21,[""]*8,[None]*8,["X"*1201]*8])
def test_storyboard_rejects_malformed_chapters(bad):
    with pytest.raises(ValueError):
        plan_story_illustrations(str(uuid.uuid4()),bad,"storybook")


def test_single_page_brief_remains_backward_compatible():
    book=str(uuid.uuid4())
    assert illustration_brief(book,2,"pencil")==illustration_brief(book,2,"pencil",scene_number=2)
    assert illustration_brief(book,2,"pencil",scene_number=10).scene==SCENES[9]
    for bad in (0,21,True,-1):
        with pytest.raises(ValueError):
            illustration_brief(book,2,"pencil",scene_number=bad)


def test_private_worker_integration_is_exercised_by_backend_ci(monkeypatch):
    # The regular secure-api workflow runs this module explicitly.
    from test_private_storyboard_worker import private_connection
    from illustration_worker import private_storyboard_prompt
    from illustration_planning import SAFETY
    book=str(uuid.uuid4())
    owner=str(uuid.uuid4())
    chapters=["The friends explore a quiet forest."]*20
    chapters[1]="They discovered a secret map hidden in a tree."
    chapters[-1]="Finally everyone returned home at sunrise."
    statements=private_connection(monkeypatch,book,owner,chapters)
    selected=private_storyboard_prompt(book,owner,2,"storybook")
    ending=private_storyboard_prompt(book,owner,20,"storybook")
    assert SCENES[9] in selected
    assert SCENES[19] in ending
    assert selected.endswith(SAFETY)
    assert len(statements)==2
    assert all(args==(book,owner) for _,args in statements)
    with pytest.raises(ValueError,match="unavailable"):
        private_storyboard_prompt(book,str(uuid.uuid4()),2,"storybook")


def test_assignment_maximizes_total_relevance_instead_of_greedy():
    from illustration_planning import _maximum_scene_assignment
    # Taking the single largest score (10) first forces the second row to 0.
    scores = [[10, 9, 0], [9, 0, 0]]
    assert _maximum_scene_assignment(scores) == [1, 0]


def test_assignment_matches_exhaustive_optimum_on_small_matrices():
    from itertools import permutations
    from random import Random
    from illustration_planning import _maximum_scene_assignment
    rng = Random(17)
    for n in range(1, 5):
        for _ in range(15):
            scores = [[rng.randint(-20, 80) for _ in range(5)] for _ in range(n)]
            chosen = _maximum_scene_assignment(scores)
            assert len(set(chosen)) == n
            assert sum(scores[i][j] for i,j in enumerate(chosen)) == max(
                sum(scores[i][j] for i,j in enumerate(candidate))
                for candidate in permutations(range(5), n))
            assert chosen == _maximum_scene_assignment(scores)


def test_short_signals_do_not_match_inside_unrelated_words():
    from illustration_planning import _scene_tokens, _scene_hits
    assert _scene_hits(_scene_tokens("chair chocolate clockwork"), ("oy", "och", "sir")) == 0
    assert _scene_hits(_scene_tokens("oy va yulduz"), ("oy", "yulduz")) == 2
    assert _scene_hits(_scene_tokens("returned"), ("return",)) == 1


def test_uzbek_spelling_variants_have_equivalent_scores():
    from illustration_planning import _scene_tokens, _scene_hits
    variants = ["ko‘prik", "ko'prik", "koʻprik", "köprik"]
    assert all(_scene_hits(_scene_tokens(text), ("ko‘pr", "köpr")) == 1 for text in variants)
    assert _scene_tokens("chiroq shahar") == _scene_tokens("çiroq şahar")


def test_v1_personal_continuity_keeps_legacy_assignment():
    from private_character_continuity import plan_reference_book
    book = str(uuid.uuid4())
    chapters = ["A quiet adventure with friends."] * 8
    chapters[2] = "The friends found a lantern and an old map."
    old = plan_story_illustrations(book, chapters, "storybook", legacy=True)
    personal = plan_reference_book(book, chapters, "storybook", "explorer")
    assert [SCENES[p.scene_number-1] for p in personal.pages] == [b.scene for b in old]
