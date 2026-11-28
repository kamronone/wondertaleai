"""Opt-in experimental image-edit adapter for transforming a private portrait.

This module is NOT imported by any FastAPI endpoint, existing story worker
or public frontend. It deliberately cannot read photos from the database,
grant consent, enqueue jobs, charge users or save an output. An operator-run
prototype must separately establish explicit, informed consent for *external*
child-image transfer and independent image moderation before invoking it.

Never pass child names, personal stories, identifiers or exact locations in
a prompt. Never log source bytes, prompts or provider outputs.
"""
import base64
import binascii
from io import BytesIO
import os
from typing import Any

from illustration_planning import SCENES, STYLES
from private_photo_reference import normalize_private_reference_photo
from private_illustration_media import normalize_private_illustration, MAX_INPUT_BYTES

# A distinct model and feature gate, independent of the generic mascot pipeline.
PHOTO_EDIT_MODEL="gpt-image-2"
PHOTO_EDIT_MODES={
    "explorer": "a friendly young explorer wearing a teal travel coat and a little backpack",
    "astronaut": "a friendly young astronaut in a white and lavender spacesuit",
    "storybook": "a kind fairytale protagonist wearing an original emerald-green tunic",
}
OUTPUT_MAX_BASE64=((MAX_INPUT_BYTES+2)//3)*4


def build_reference_edit_prompt(page_number:int,style:str,hero_mode:str)->str:
    """Pure, curated description that contains no account or child information."""
    if type(page_number) is not int or not 1<=page_number<=20:
        raise ValueError("Invalid page number")
    if style not in STYLES or hero_mode not in PHOTO_EDIT_MODES:
        raise ValueError("Unknown illustration style or hero mode")
    return (
        f"Create an original children's storybook illustration in "
        f"{STYLES[style]} style. Use the submitted reference portrait as "
        f"the visual reference for the SINGLE main character. "
        f"Transform them into {PHOTO_EDIT_MODES[hero_mode]}, retaining "
        f"recognizable general facial features and hairstyle while avoiding "
        f"a photorealistic likeness. In this page, show the character "
        f"{SCENES[page_number-1]}. Keep the exact same outfit, color palette, "
        f"hair, facial design, and body proportions across all pages of the "
        f"storybook. Gentle, age-appropriate scene; no violence, distress, "
        f"text, logos, identifying details, or existing franchise designs. "
        f"Do not reproduce the original photographic background."
    )


def edit_private_reference_portrait(
    source_photo:bytes,*,page_number:int,style:str,hero_mode:str,
    explicit_external_transfer_consent:bool=False,client:Any=None,
)->bytes:
    """Single non-retrying image-edit call; the result is a scrubbed PNG.

    Never call this from an HTTP handler without owner and retention checks,
    fresh photo-specific EXTERNAL transfer consent, moderation and quotas.
    The flag does not create or record user consent; the trusted caller must
    provide evidence separately. No automatic retries on uncertain spend.
    """
    if os.getenv("APP_ENV","development").lower()!="development":
        raise RuntimeError("Photo edit prototype is restricted to local development")
    if os.getenv("ENABLE_DEV_PHOTO_UPLOAD","false").lower()!="true":
        raise RuntimeError("Local reference processing is disabled")
    if os.getenv("ENABLE_PRIVATE_REFERENCE_IMAGE_EDITS","false").lower()!="true":
        raise RuntimeError("Reference image editing is disabled")
    if os.getenv("ENABLE_OPENAI_IMAGE_PROVIDER","false").lower()!="true":
        raise RuntimeError("Image provider is disabled")
    if explicit_external_transfer_consent is not True:
        raise PermissionError("Explicit external photo transfer consent required")
    if os.getenv("OPENAI_IMAGE_MODEL",PHOTO_EDIT_MODEL)!=PHOTO_EDIT_MODEL:
        raise RuntimeError("Unapproved image edit model")
    prompt=build_reference_edit_prompt(page_number,style,hero_mode)
    clean=normalize_private_reference_photo(source_photo)
    if client is None:
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY is not configured")
        from openai import OpenAI
        client=OpenAI(timeout=90,max_retries=0)
    # Name is file metadata required by the SDK; no source filename is reused.
    upload=BytesIO(clean)
    upload.name="reference.jpg"
    response=client.images.edit(
        model=PHOTO_EDIT_MODEL,image=upload,prompt=prompt,
        size="1024x1024",n=1,output_format="png",
    )
    data=getattr(response,"data",None)
    if not isinstance(data,(list,tuple)) or len(data)!=1:
        raise ValueError("Invalid image edit response count")
    encoded=getattr(data[0],"b64_json",None)
    if not isinstance(encoded,str) or not encoded or len(encoded)>OUTPUT_MAX_BASE64:
        raise ValueError("Invalid image edit response size")
    try:
        raw=base64.b64decode(encoded,validate=True)
    except (binascii.Error,ValueError) as exc:
        raise ValueError("Invalid encoded image edit") from exc
    if len(raw)>MAX_INPUT_BYTES:
        raise ValueError("Image edit exceeds allowed size")
    return normalize_private_illustration(raw)
