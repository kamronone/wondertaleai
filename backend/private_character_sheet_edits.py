"""Isolated experimental character-sheet image edits.

No HTTP endpoint, database, job runner, storage, or default provider client.
A trusted local operator must supply an explicitly configured client and
independent moderation/permission/budget callbacks. This is not production
authorization. A generated character sheet is still private personal media.
No automatic retries or refunds are performed.
"""
import base64
import binascii
from dataclasses import dataclass
import hashlib
import hmac
from io import BytesIO
import os
from typing import Any, Callable

from private_character_continuity import (
    build_character_sheet_prompt, build_character_sheet_page_prompt,
)
from private_reference_image_edits import PHOTO_EDIT_MODEL, OUTPUT_MAX_BASE64
from private_photo_reference import normalize_private_reference_photo
from private_illustration_media import normalize_private_illustration


@dataclass(frozen=True)
class ApprovedCharacterSheet:
    png: bytes
    sha256: str
    style: str
    hero_mode: str


def _gate() -> None:
    if os.getenv("APP_ENV", "").lower() != "development":
        raise RuntimeError("Character sheet edits are local-development only")
    for flag in ("ENABLE_DEV_PHOTO_UPLOAD", "ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS",
                 "ENABLE_OPENAI_IMAGE_PROVIDER", "ENABLE_CHARACTER_SHEET_EDITS"):
        if os.getenv(flag, "false").lower() != "true":
            raise RuntimeError("Character sheet edits are disabled")
    if os.getenv("ILLUSTRATION_EMERGENCY_STOP", "false").lower() == "true":
        raise RuntimeError("Illustration emergency stop is active")
    if os.getenv("OPENAI_IMAGE_MODEL", PHOTO_EDIT_MODEL) != PHOTO_EDIT_MODEL:
        raise RuntimeError("Unapproved image edit model")


def _permission(check: Callable[[], bool]) -> None:
    _gate()
    if not callable(check) or check() is not True:
        raise PermissionError("Current private media transfer permission is required")


def _edit(source: bytes, filename: str, prompt: str, *, client: Any,
          permission: Callable[[], bool], reserve_attempt: Callable[[], bool],
          source_moderator: Callable[[bytes], bool],
          prompt_moderator: Callable[[str], bool],
          image_moderator: Callable[[bytes], bool]) -> bytes:
    _permission(permission)
    if client is None or not all(callable(fn) for fn in (
        reserve_attempt, source_moderator, prompt_moderator, image_moderator,
    )):
        raise ValueError("Explicit client and independent checks required")
    if source_moderator(source) is not True or prompt_moderator(prompt) is not True:
        raise PermissionError("Input moderation did not approve")
    _permission(permission)
    # Trusted caller must atomically reserve a fresh attempt in its ledger.
    # A successful reservation is never treated as approval to transfer media.
    if reserve_attempt() is not True:
        raise PermissionError("No fresh attempt reservation")
    _permission(permission)
    with BytesIO(source) as upload:
        upload.name = filename
        response = client.images.edit(
            model=PHOTO_EDIT_MODEL, image=upload, prompt=prompt,
            size="1024x1024", n=1, output_format="png",
        )
    _permission(permission)
    data = getattr(response, "data", None)
    if not isinstance(data, (list, tuple)) or len(data) != 1:
        raise ValueError("Invalid image edit response")
    encoded = getattr(data[0], "b64_json", None)
    if not isinstance(encoded, str) or not 0 < len(encoded) <= OUTPUT_MAX_BASE64:
        raise ValueError("Invalid image edit response size")
    try:
        raw = base64.b64decode(encoded, validate=True)
    except (ValueError, binascii.Error) as exc:
        raise ValueError("Invalid image edit response") from exc
    result = normalize_private_illustration(raw)
    if image_moderator(result) is not True:
        raise PermissionError("Output moderation did not approve")
    _permission(permission)
    return result


def create_character_sheet(
    source_photo: bytes, *, style: str, hero_mode: str, client: Any,
    permission: Callable[[], bool], reserve_attempt: Callable[[], bool],
    source_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
    image_moderator: Callable[[bytes], bool],
) -> ApprovedCharacterSheet:
    """Produce one in-memory approved illustrated reference; no persistence."""
    _permission(permission)
    prompt = build_character_sheet_prompt(style, hero_mode)
    clean = normalize_private_reference_photo(source_photo)
    png = _edit(clean, "reference.jpg", prompt, client=client,
                permission=permission, reserve_attempt=reserve_attempt,
                source_moderator=source_moderator, prompt_moderator=prompt_moderator,
                image_moderator=image_moderator)
    return ApprovedCharacterSheet(png, hashlib.sha256(png).hexdigest(), style, hero_mode)


def edit_character_sheet_page(
    sheet: ApprovedCharacterSheet, *, scene_number: int, client: Any,
    permission: Callable[[], bool], reserve_attempt: Callable[[], bool],
    source_moderator: Callable[[bytes], bool],
    prompt_moderator: Callable[[str], bool],
    image_moderator: Callable[[bytes], bool],
) -> bytes:
    """Reuse the approved illustration, never accept the original portrait here.

    Caller must verify ownership, expiry, durable moderation evidence and
    consent for derived media before every attempt. A digest detects accidental
    changes, not authorization or authenticity of an untrusted input.
    """
    _permission(permission)
    if not isinstance(sheet, ApprovedCharacterSheet) or not isinstance(sheet.png, bytes):
        raise ValueError("An approved character reference is required")
    if not hmac.compare_digest(hashlib.sha256(sheet.png).hexdigest(), sheet.sha256):
        raise ValueError("Character sheet integrity mismatch")
    prompt = build_character_sheet_page_prompt(scene_number, sheet.style, sheet.hero_mode)
    clean = normalize_private_illustration(sheet.png)
    return _edit(clean, "character-sheet.png", prompt, client=client,
                 permission=permission, reserve_attempt=reserve_attempt,
                 source_moderator=source_moderator, prompt_moderator=prompt_moderator,
                 image_moderator=image_moderator)
