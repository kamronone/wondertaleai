"""Adapter for future AI integration; no provider calls or live API changes.
Use within the same transaction as job/idempotency state changes.
"""
import re
from uuid import UUID, uuid5
from billing_quota import reserve_story, settle_story

_NAMESPACE = UUID("8dcbda23-1f48-4fb0-a235-1dcd96028a89")

def request_id(owner_id: str, request_key: str) -> UUID:
    if not owner_id or not isinstance(request_key,str) or not re.fullmatch(r"[A-Za-z0-9_-]{16,128}",request_key):
        raise ValueError("Valid owner and idempotency key required")
    return uuid5(_NAMESPACE, f"{len(owner_id)}:{owner_id}:{request_key}")

def reserve_generation(conn, owner_id, request_key, now):
    """Only a newly created reservation may authorize a new provider call.
    Caller must also verify payload digest and enforce global spend limits.
    """
    result = reserve_story(conn,owner_id,request_id(owner_id,request_key),now)
    return {**result,"may_start":result["created"] and result["state"]=="reserved"}

def settle_generation(conn, owner_id, request_key, outcome):
    """Unknown provider outcomes retain reservation pending reconciliation."""
    if outcome == "unknown":
        return False
    if outcome not in ("saved","confirmed_no_charge"):
        raise ValueError("Unsupported generation outcome")
    return settle_story(conn,owner_id,request_id(owner_id,request_key),
                        succeeded=outcome=="saved")
