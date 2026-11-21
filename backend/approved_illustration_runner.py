"""Explicit opt-in orchestration of private illustrations and moderation.

This file provides a callable, not an HTTP route, timer or background process.
It intentionally refuses Production and requires all safety/cost switches.
The operator must review child safety, provider access, data retention, and
billing reconciliation before using it against live APIs.
"""
import os
from typing import Any

from illustration_worker import process_one_illustration_job
from illustration_moderation import moderate_illustration_prompt,moderate_illustration_image
from openai_illustration_provider import generate_private_illustration


def run_one_approved_illustration(*,image_client:Any=None,moderation_client:Any=None)->str|None:
    """At most one job. Unknown errors remain needs_review, never retried."""
    if os.getenv("ENABLE_OPENAI_IMAGE_MODERATION","false").lower()!="true":
        raise RuntimeError("Moderation gate disabled")
    if os.getenv("APP_ENV","development").lower() not in ("preview","staging","development"):
        raise RuntimeError("Production is not permitted")
    return process_one_illustration_job(
        renderer=lambda prompt:generate_private_illustration(prompt,client=image_client),
        moderator=lambda prompt:moderate_illustration_prompt(prompt,client=moderation_client),
        image_moderator=lambda data:moderate_illustration_image(data,client=moderation_client),
    )
