"""Offline tests for story-aware private illustration worker integration.

No live provider, personal data upload or image generation.
"""
import json
import uuid
from contextlib import contextmanager
from unittest.mock import Mock

import pytest

from illustration_planning import SCENES,SAFETY
import illustration_worker as worker


def private_connection(monkeypatch,book_id,owner,chapters):
    query_calls=[]
    @contextmanager
    def fake_connection():
        yield object()
    def fake_sql(_connection,query,args=()):
        query_calls.append((query,args))
        result=Mock()
        if query=="SELECT story FROM books WHERE id=? AND owner_id=?":
            if args!=(book_id,owner):
                result.fetchone.return_value=None
            else:
                result.fetchone.return_value=(json.dumps({
                    "version":1,"pages":[
                        {"number":i+1,"text":text,"image_url":""}
                        for i,text in enumerate(chapters)
                    ]
                }),)
            return result
        raise AssertionError("Unexpected SQL query")
    monkeypatch.setattr(worker.db,"connection",fake_connection)
    monkeypatch.setattr(worker.db,"sql",fake_sql)
    return query_calls


@pytest.mark.parametrize("count",[8,12,20])
def test_private_worker_uses_matching_chapter_without_leaking_story(monkeypatch,count):
    book_id=str(uuid.uuid4())
    owner=str(uuid.uuid4())
    private_name="SecretChildAndFamilyIdentity"
    chapters=["A cheerful afternoon with gentle woodland friends."]*count
    chapters[1]="The hero found a secret map in an old hollow tree. "+private_name
    chapters[-1]="Finally our friend returned home at sunrise. "+private_name
    calls=private_connection(monkeypatch,book_id,owner,chapters)
    map_prompt=worker.private_storyboard_prompt(book_id,owner,2,"storybook")
    ending_prompt=worker.private_storyboard_prompt(book_id,owner,count,"storybook")
    assert SCENES[9] in map_prompt
    assert SCENES[19] in ending_prompt
    assert map_prompt.endswith(SAFETY)
    assert ending_prompt.endswith(SAFETY)
    assert private_name not in map_prompt+ending_prompt
    assert book_id not in map_prompt+ending_prompt
    assert owner not in map_prompt+ending_prompt
    assert all(q=="SELECT story FROM books WHERE id=? AND owner_id=?" for q,_ in calls)
    assert all(args==(book_id,owner) for _,args in calls)


def test_storyboard_cannot_access_other_parent_book(monkeypatch):
    book_id=str(uuid.uuid4())
    owner=str(uuid.uuid4())
    private_connection(monkeypatch,book_id,owner,["The sun was shining."]*8)
    with pytest.raises(ValueError,match="unavailable"):
        worker.private_storyboard_prompt(book_id,str(uuid.uuid4()),1,"storybook")


@pytest.mark.parametrize("page",[0,9,21])
def test_storyboard_rejects_pages_outside_owned_book(monkeypatch,page):
    book_id=str(uuid.uuid4())
    owner=str(uuid.uuid4())
    private_connection(monkeypatch,book_id,owner,["A safe woodland story."]*8)
    with pytest.raises(ValueError,match="Invalid private story"):
        worker.private_storyboard_prompt(book_id,owner,page,"storybook")


def test_worker_uses_curated_local_planner_at_provider_boundary():
    from pathlib import Path
    code=Path(worker.__file__).read_text()
    assert "prompt=private_storyboard_prompt(book_id,owner,page_number,style)" in code
    assert "if moderator(prompt) is not True:" in code
    assert "image=renderer(prompt)" in code
    assert code.index("prompt=private_storyboard_prompt(")<code.index("image=renderer(prompt)")
    assert "if illustration_emergency_paused() or not db.illustration_consent_active(owner)" in code
    assert "MAX_ILLUSTRATIONS_PER_DAY" in code
    assert "MAX_PARENT_ILLUSTRATIONS_PER_DAY" in code
