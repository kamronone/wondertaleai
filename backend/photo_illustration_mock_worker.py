"""Explicit local-only mock-art executor. No provider SDK, network or billing.

This is NOT the real personalized AI illustration worker. It safely exercises
the request -> approved local PNG -> private mock storage path with existing
sanitized photo bytes and a fixed original scene backdrop. Invoke manually
only after injecting an independent, local-only image moderator.
"""
import hashlib
import hmac
import os
import time
import uuid
from typing import Callable

import secure_main as db
from photo_illustration_review import (
    PhotoDryRunDenied, _current_snapshot, _require_local_review_gate,
)
from private_photo_preview import render_local_story_page
from private_illustration_media import normalize_private_illustration


def save_mock_photo_page(
    request_id: str, *, image_moderator: Callable[[bytes], bool],
    photo_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
) -> dict:
    """Render and store one demo PNG with three explicit moderation checks.

    After all callbacks, a single write transaction verifies both consents,
    the exact pending request, photo integrity, matching reference digest and
    expiry again. No unknown renderer or image-edit service is ever invoked.
    A repeated call returns the existing asset without writing another copy.
    """
    _require_local_review_gate()
    if os.getenv("ENABLE_PHOTO_MOCK_STORAGE","false").lower()!="true":
        raise PhotoDryRunDenied("Mock art storage is disabled")
    if not all(callable(fn) for fn in (image_moderator, photo_moderator, prompt_moderator)):
        raise PhotoDryRunDenied("Three local moderation callbacks are required")
    try:
        rid=str(uuid.UUID(request_id))
    except (ValueError,TypeError,AttributeError):
        raise PhotoDryRunDenied("Invalid request identifier")
    owner,digest,book,page,photo,prompt,expires=_current_snapshot(rid)
    if photo_moderator(photo) is not True:
        raise PhotoDryRunDenied("Photo moderation rejected the reference")
    if prompt_moderator(prompt) is not True:
        raise PhotoDryRunDenied("Prompt moderation rejected the page")
    # Rendering is deterministic for the same photo and requested page.
    # The selected scene comes from the request page; never child text.
    from illustration_planning import SCENES, plan_story_illustrations
    import json
    with db.connection() as c:
        story_row=db.sql(c,"SELECT story FROM books WHERE id=? AND owner_id=?",(book,owner)).fetchone()
    if not story_row:
        raise PhotoDryRunDenied("Private book is unavailable")
    try:
        story=json.loads(story_row[0])
        pages=story["pages"]
        scene=plan_story_illustrations(book,[item["text"] for item in pages],"storybook")[page-1].scene
        scene_number=SCENES.index(scene)+1
        png=normalize_private_illustration(render_local_story_page(photo,page,len(pages),scene_number=scene_number))
    except (ValueError,TypeError,KeyError,IndexError):
        raise PhotoDryRunDenied("Mock illustration failed validation")
    if image_moderator(png) is not True:
        raise PhotoDryRunDenied("Mock image moderation rejected the output")
    _require_local_review_gate()
    fresh=_current_snapshot(rid)
    if fresh[0]!=owner or fresh[1]!=digest or fresh[2]!=book or fresh[3]!=page or fresh[6]!=expires:
        raise PhotoDryRunDenied("Reference or request changed during mock processing")
    now=int(time.time())
    sha=hashlib.sha256(png).hexdigest()
    with db.connection() as c:
        if db.IS_PG:
            locked=db.sql(c,"SELECT owner_id FROM parents WHERE id=? FOR UPDATE",(owner,)).fetchone()
            if not locked:
                raise PhotoDryRunDenied("Parent no longer exists")
        else:
            c.execute("BEGIN IMMEDIATE")
        _require_local_review_gate()
        row=db.sql(c,"SELECT status,reference_sha256,expires_at FROM photo_illustration_requests "
                       "WHERE id=? AND owner_id=? AND book_id=? AND page_number=?",
                   (rid,owner,book,page)).fetchone()
        ref=db.sql(c,"SELECT sha256,jpeg_bytes,expires_at FROM photo_reference_temp "
                       "WHERE owner_id=? AND expires_at>?",(owner,now)).fetchone()
        if (not row or row[0]!="pending_review" or row[1]!=digest
            or row[2]<=now or not ref or ref[0]!=digest or ref[2]<row[2]
            or not hmac.compare_digest(hashlib.sha256(bytes(ref[1])).hexdigest(),digest)
            or not db.photo_consent_active(owner,c)
            or not db.external_photo_transfer_consent_active(owner,c)
            or not db.sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book,owner)).fetchone()):
            raise PhotoDryRunDenied("Private reference permission expired")
        existing=db.sql(c,"SELECT sha256 FROM photo_mock_assets WHERE request_id=? AND owner_id=?",
                        (rid,owner)).fetchone()
        if existing:
            c.commit()
            return {"id":rid,"status":"mock_ready","generated_by_ai":False,
                    "provider_called":False,"cost_usd":0}
        db.sql(c,"INSERT INTO photo_mock_assets(request_id,owner_id,png_bytes,sha256,expires_at) "
                 "VALUES(?,?,?,?,?)",(rid,owner,png,sha,expires))
        c.commit()
    return {"id":rid,"status":"mock_ready","generated_by_ai":False,
            "provider_called":False,"cost_usd":0}
