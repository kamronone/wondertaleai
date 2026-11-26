"""Operator-invoked, read-only DRY RUN of a personal illustration request.

This is deliberately NOT an image generation worker. It never contacts any
provider, starts background tasks, saves a PNG, moves job states, or spends
money. It is intended to prove that the final worker's mandatory permission
and moderation gates can be checked together against current database data.

Do not use this as authorization to send any real children's image to AI.
"""
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Callable

from illustration_planning import plan_story_illustrations, SCENES
from private_reference_image_edits import build_reference_edit_prompt
import secure_main as db


class PhotoDryRunDenied(RuntimeError):
    """Generic failure that never includes a parent's or child's details."""


def _deny(message: str) -> None:
    raise PhotoDryRunDenied(message)


def _require_local_review_gate() -> None:
    if not db.photo_reference_upload_enabled():
        _deny("Photo review is not enabled in local development")
    if os.getenv("ENABLE_PHOTO_REVIEW_DRY_RUN", "false").lower() != "true":
        _deny("Photo review dry-run is disabled")
    if os.getenv("ILLUSTRATION_EMERGENCY_STOP", "false").lower() == "true":
        _deny("Illustration emergency stop is active")


def _current_snapshot(request_id: str):
    now = int(time.time())
    with db.connection() as c:
        row = db.sql(c,
            "SELECT owner_id,book_id,page_number,style,hero_mode,reference_sha256,expires_at "
            "FROM photo_illustration_requests WHERE id=? AND status='pending_review'",
            (request_id,)).fetchone()
        if row is None or row[6] <= now:
            _deny("Review request is unavailable")
        owner, book_id, page, style, hero, digest, expires = row
        if not db.photo_consent_active(owner, c) or not db.external_photo_transfer_consent_active(owner, c):
            _deny("Parental permission is unavailable")
        book = db.sql(c, "SELECT story FROM books WHERE id=? AND owner_id=?",
                      (book_id, owner)).fetchone()
        photo = db.sql(c,
            "SELECT jpeg_bytes,sha256,expires_at FROM photo_reference_temp "
            "WHERE owner_id=? AND expires_at>?", (owner, now)).fetchone()
        if not book or not photo or photo[2] < expires or photo[1] != digest:
            _deny("Book or reference is unavailable")
        raw = bytes(photo[0])
        if not hmac.compare_digest(hashlib.sha256(raw).hexdigest(), digest):
            _deny("Reference integrity check failed")
    try:
        story = json.loads(book[0])
        pages = story["pages"]
        if not isinstance(pages, list) or len(pages) not in (8, 12, 20):
            raise ValueError
        if not isinstance(page, int) or not 1 <= page <= len(pages):
            raise ValueError
        if any(not isinstance(p, dict) or p.get("number") != i + 1
               or not isinstance(p.get("text"), str) or not p["text"].strip()
               for i, p in enumerate(pages)):
            raise ValueError
        # This mapping runs on the server; no chapter text is given to any
        # external model or to the injected moderation callbacks.
        briefs = plan_story_illustrations(book_id, [p["text"] for p in pages], style)
        scene_number = SCENES.index(briefs[page - 1].scene) + 1
        prompt = build_reference_edit_prompt(scene_number, style, hero)
    except (ValueError, KeyError, TypeError, IndexError):
        _deny("Invalid private story")
    return owner, digest, book_id, page, raw, prompt, expires


def review_photo_request_dry_run(
    request_id: str,
    *,
    photo_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
) -> dict:
    """Validate current parent consent, source, story and injected moderation.

    Moderators are operator-supplied *local* checks during this dry run; no
    network providers are provided or imported. Caller must use trusted
    local implementations. Inputs and generated prompts are never returned.
    The second DB check prevents reporting success after consent revocation,
    photo replacement, or expiry during moderation.
    """
    _require_local_review_gate()
    try:
        canonical = str(uuid.UUID(request_id))
    except (ValueError, TypeError, AttributeError):
        _deny("Invalid review request identifier")
    if not callable(photo_moderator) or not callable(prompt_moderator):
        _deny("Independent local moderators are required")
    owner, digest, book, page, raw, prompt, expires = _current_snapshot(canonical)
    # Neither callback can mutate the persisted request through this module.
    # Do not pass names, book titles, story text or account identifiers.
    if photo_moderator(raw) is not True:
        _deny("Photo moderation did not approve")
    if prompt_moderator(prompt) is not True:
        _deny("Prompt moderation did not approve")
    _require_local_review_gate()
    fresh = _current_snapshot(canonical)
    if (fresh[0] != owner or fresh[1] != digest or fresh[2] != book
            or fresh[3] != page or fresh[6] != expires):
        _deny("Review request changed during moderation")
    # A safety-only result: not a claim of provider approval or billable quota.
    return {"id": canonical, "status": "dry_run_passed",
            "image_generated": False, "provider_called": False,
            "cost_usd": 0}
