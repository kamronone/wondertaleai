"""Privacy-first storybook illustration brief construction.

This module NEVER calls an image model. Briefs use a stable fictional mascot
and a curated scene list; no child name, private story text, email, photo,
or other parent content is sent to any provider by this module.
"""
from dataclasses import dataclass
import hashlib
from typing import Literal

IllustrationStyle=Literal["watercolor","storybook","pencil"]
STYLES:dict[str,str]={
    "watercolor":"delicate hand-painted watercolor with warm paper texture",
    "storybook":"soft original 2D storybook painting with rounded forms",
    "pencil":"gentle colored-pencil drawing on ivory paper",
}
MASCOTS=(
    "a little russet fox with a cream scarf and amber eyes",
    "a small teal-blue dragon with golden horns and round glasses",
    "a white rabbit with a lavender vest and long ears",
    "a curious brown bear cub wearing a blue satchel",
)
SCENES=(
    "walking beside a flowering path in the morning",
    "discovering a glowing paper lantern in a quiet garden",
    "meeting friendly birds beside a river",
    "finding a colorful bridge above a gentle stream",
    "exploring an enchanted library full of bright windows",
    "sharing a picnic with kind woodland friends",
    "helping a lost butterfly find a safe meadow",
    "watching the first stars appear in the sky",
)
SAFETY=(
    "Original child-safe artwork, not based on any existing franchise. "
    "No realistic child likeness, no text or logos, no violent or frightening "
    "imagery, no identifying information. Maintain the identical fictional "
    "character appearance, outfit, and proportions in every page."
)


@dataclass(frozen=True)
class IllustrationBrief:
    book_id: str
    page_number: int
    style: IllustrationStyle
    character_guide: str
    scene: str
    prompt: str


def illustration_brief(book_id:str,page_number:int,style:IllustrationStyle)->IllustrationBrief:
    """Return a consistent, generic draft illustration prompt.

    This is not a substitute for human-reviewed scene planning from story
    text. No API is called and no page data leaves the private database.
    """
    import uuid
    try:
        normalized=str(uuid.UUID(book_id))
    except (ValueError,AttributeError,TypeError) as exc:
        raise ValueError("Invalid book ID") from exc
    if style not in STYLES:
        raise ValueError("Unsupported illustration style")
    if isinstance(page_number,bool) or not isinstance(page_number,int) or not 1<=page_number<=20:
        raise ValueError("Page outside permitted range")
    seed=int.from_bytes(hashlib.sha256(normalized.encode()).digest()[:4],"big")
    character=MASCOTS[seed%len(MASCOTS)]
    scene=SCENES[(page_number-1)%len(SCENES)]
    prompt=f"{STYLES[style]}. Depict {character} {scene}. {SAFETY}"
    return IllustrationBrief(normalized,page_number,style,character,scene,prompt)
