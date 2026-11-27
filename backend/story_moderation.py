"""Fail-closed text moderation for the children's story generation pipeline.

Moderation is a separate classification request to the configured AI provider.
No account identifiers, photographs, or raw moderation decisions are logged.
A moderation pass does not guarantee child safety or literary quality.
"""
import re
import unicodedata

_EMAIL=re.compile(r"(?i)\b[^\s@]+@[^\s@]+\.[a-z]{2,}\b")
_PHONE=re.compile(r"(?<!\d)\+?\d(?:[\d ().-]*\d){8,}(?!\d)")
_LINK=re.compile(r"(?i)\b(?:https?://|www\.)\S+")


class StoryModerationDenied(ValueError):
    """Generic denial; never include user-provided text or provider details."""


def validate_private_text(parts):
    """Reject obvious contact details before any external request.

    This is only a narrow privacy safeguard, not comprehensive PII detection.
    Fictional character names are allowed.
    """
    for part in parts:
        if not isinstance(part,str):
            raise StoryModerationDenied("Invalid moderation input")
        value=unicodedata.normalize("NFKC",part)
        if _EMAIL.search(value) or _PHONE.search(value) or _LINK.search(value):
            raise StoryModerationDenied("Remove private contact details and links")


def moderate_story_text(parts,client):
    """Check each bounded text segment and reject unavailable results."""
    if not isinstance(parts,(list,tuple)) or not 1<=len(parts)<=32:
        raise StoryModerationDenied("Invalid moderation batch")
    if any(not isinstance(part,str) or not part.strip() or len(part)>1200 for part in parts):
        raise StoryModerationDenied("Invalid moderation text")
    validate_private_text(parts)
    try:
        response=client.moderations.create(model="omni-moderation-latest",input=list(parts))
        results=getattr(response,"results",None)
        if not isinstance(results,(list,tuple)) or len(results)!=len(parts):
            raise StoryModerationDenied("Moderation result unavailable")
        if any(getattr(result,"flagged",None) is not False for result in results):
            raise StoryModerationDenied("Story content requires review")
    except StoryModerationDenied:
        raise
    except Exception:
        raise StoryModerationDenied("Moderation service unavailable") from None
