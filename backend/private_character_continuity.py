"""Pure whole-book continuity plan. No image generation, I/O or database access.

A future worker can create one approved character sheet, then use that same
illustrated reference for every page rather than repeatedly sending a portrait.
This plan is not consent, a moderation decision or a paid-job reservation.
"""
from dataclasses import dataclass
import hashlib
import json

from illustration_planning import SCENES, STYLES, plan_story_illustrations
from private_reference_image_edits import PHOTO_EDIT_MODES, build_reference_edit_prompt

PLAN_VERSION = "character-continuity-v1"


@dataclass(frozen=True)
class ReferencePage:
    page_number: int
    scene_number: int
    reference_prompt: str
    character_sheet_prompt: str


@dataclass(frozen=True)
class ReferenceBookPlan:
    version: str
    style: str
    hero_mode: str
    character_prompt: str
    pages: tuple[ReferencePage, ...]
    fingerprint: str


def build_character_sheet_prompt(style: str, hero_mode: str) -> str:
    """Describe an original illustrated hero, using only curated values."""
    if style not in STYLES or hero_mode not in PHOTO_EDIT_MODES:
        raise ValueError("Unknown character style or hero mode")
    return (
        f"Create one original children's book character reference in {STYLES[style]} style. "
        f"Use the submitted portrait only as inspiration for {PHOTO_EDIT_MODES[hero_mode]}. "
        "Show a single full-body character in a neutral standing pose, on a plain light background. "
        "Preserve general hairstyle and facial design in a clearly illustrated, non-photorealistic form. "
        "Keep one fixed outfit, color palette, accessories and proportions. "
        "Gentle age-appropriate artwork; no text, logos, real photographic background, "
        "identifying information or existing franchise designs."
    )


def build_character_sheet_page_prompt(scene_number: int, style: str, hero_mode: str) -> str:
    """Describe a scene based on an already approved illustrated character."""
    if type(scene_number) is not int or not 1 <= scene_number <= len(SCENES):
        raise ValueError("Invalid scene number")
    if style not in STYLES or hero_mode not in PHOTO_EDIT_MODES:
        raise ValueError("Unknown character style or hero mode")
    return (
        f"Create an original children's storybook page in {STYLES[style]} style. "
        f"Use the supplied approved illustrated character reference for {PHOTO_EDIT_MODES[hero_mode]}. "
        f"Show that character {SCENES[scene_number - 1]}. "
        "Preserve the reference character's exact illustrated hairstyle, face, outfit, "
        "accessories, palette and body proportions. Change only pose, expression, "
        "composition and the curated environment. Do not introduce a second version "
        "of the protagonist. Gentle age-appropriate scene; no violence, distress, "
        "text, logos, identifying details or existing franchise designs."
    )


def plan_reference_book(
    book_id: str, chapters: list[str], style: str, hero_mode: str
) -> ReferenceBookPlan:
    character = build_character_sheet_prompt(style, hero_mode)
    # The v1 fingerprint must remain stable for existing approved sheets.
    # A future persisted plan version can opt into the improved planner.
    briefs = plan_story_illustrations(book_id, chapters, style, legacy=True)
    pages = tuple(
        ReferencePage(
            brief.page_number, SCENES.index(brief.scene) + 1,
            build_reference_edit_prompt(SCENES.index(brief.scene) + 1, style, hero_mode),
            build_character_sheet_page_prompt(SCENES.index(brief.scene) + 1, style, hero_mode),
        )
        for brief in briefs
    )
    # Only curated descriptions enter the fingerprint. Book IDs, private
    # chapters, names, photographs and account identifiers are excluded.
    canonical = json.dumps(
        [PLAN_VERSION, style, hero_mode, character,
         [[p.page_number, p.scene_number, p.reference_prompt, p.character_sheet_prompt]
          for p in pages]],
        ensure_ascii=True, separators=(",", ":"),
    )
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return ReferenceBookPlan(PLAN_VERSION, style, hero_mode, character, pages, digest)
