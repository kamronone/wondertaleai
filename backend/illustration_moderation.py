"""Fail-closed OpenAI text/image moderation for a private, opt-in worker.

This module never starts work on import and makes no network calls unless its
functions are explicitly invoked with all pilot flags enabled. Tests inject
a fake client. It must not be used as the sole child-safety review at launch.
"""
import base64
import os
from typing import Any

from private_illustration_media import MAX_INPUT_BYTES, normalize_private_illustration

MODEL="omni-moderation-latest"


def _require_pilot()->None:
    for name in ("ENABLE_AI_ILLUSTRATIONS","ENABLE_AI_ILLUSTRATIONS_WORKER",
                 "ENABLE_OPENAI_IMAGE_PROVIDER","ENABLE_OPENAI_IMAGE_MODERATION"):
        if os.getenv(name,"false").lower()!="true":
            raise RuntimeError("Illustration moderation pilot disabled")
    if os.getenv("APP_ENV","development").lower() not in ("preview","staging","development"):
        raise RuntimeError("Illustration moderation pilot refuses production")


def _client(client:Any)->Any:
    if client is not None:
        return client
    if not os.getenv("OPENAI_API_KEY"):
        raise RuntimeError("OPENAI_API_KEY is not configured")
    from openai import OpenAI
    return OpenAI(timeout=30,max_retries=0)


def _approved(response:Any)->bool:
    """Only an explicit single, clean provider result is acceptable."""
    results=getattr(response,"results",None)
    if not isinstance(results,(list,tuple)) or len(results)!=1:
        return False
    result=results[0]
    if getattr(result,"flagged",None) is not False:
        return False
    categories=getattr(result,"categories",None)
    if categories is None:
        return False
    if isinstance(categories,dict):
        values=categories
    else:
        try:
            values=categories.model_dump()
        except (AttributeError,TypeError,ValueError):
            return False
    if not isinstance(values,dict) or not values:
        return False
    # Unknown/unsupported category values should not silently pass.
    return all(value is False for value in values.values())


def moderate_illustration_prompt(prompt:str,client:Any=None)->bool:
    _require_pilot()
    from illustration_planning import SAFETY, STYLES, MASCOTS
    if (not isinstance(prompt,str) or len(prompt)>2500 or
        not prompt.endswith(SAFETY) or
        not any(prompt.startswith(style+".") for style in STYLES.values()) or
        not any(mascot in prompt for mascot in MASCOTS)):
        return False
    response=_client(client).moderations.create(
        model=MODEL,input=[{"type":"text","text":prompt}]
    )
    return _approved(response)


def moderate_illustration_image(data:bytes,client:Any=None)->bool:
    _require_pilot()
    if not isinstance(data,bytes) or not 0<len(data)<=MAX_INPUT_BYTES:
        return False
    # Normalize first: do not send unknown files, comments, EXIF or GPS
    # anywhere. No external URL or persistent upload is involved.
    try:
        clean=normalize_private_illustration(data)
    except ValueError:
        return False
    uri="data:image/png;base64,"+base64.b64encode(clean).decode("ascii")
    response=_client(client).moderations.create(
        model=MODEL,input=[{"type":"image_url","image_url":{"url":uri}}]
    )
    return _approved(response)
