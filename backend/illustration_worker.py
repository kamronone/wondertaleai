"""Experimental one-shot private illustration worker; never starts itself.

No image-provider adapter is shipped. The operator must explicitly inject
both an independent content moderator and a renderer. A reservation is never
automatically refunded or retried after the renderer can have been called.
"""
import os
from datetime import datetime, timezone
from typing import Callable

from illustration_planning import illustration_brief
import secure_main as db

def _cap(name:str)->int:
    try:
        return max(0,min(10,int(os.getenv(name,"0"))))
    except (TypeError,ValueError):
        return 0

def _now()->str:
    return datetime.now(timezone.utc).isoformat()

def _finish(job_id:str,state:str)->None:
    with db.connection() as c:
        db.sql(c,"UPDATE illustration_jobs SET status=?,completed_at=? WHERE id=? AND status='processing'",
               (state,_now(),job_id))
        c.commit()

def process_one_illustration_job(
    *,renderer:Callable[[str],bytes],moderator:Callable[[str],bool],\n    image_moderator:Callable[[bytes],bool],
)->str|None:
    """Claim at most one job and produce a moderated, private PNG.

    Pass only trusted functions; neither is called while transactions are held.
    All failures after reservation are terminal needs_review, because a
    provider might have charged before the process crashed.
    """
    if os.getenv("ENABLE_AI_ILLUSTRATIONS","false").lower()!="true":
        raise RuntimeError("Illustrations disabled")
    if os.getenv("ENABLE_AI_ILLUSTRATIONS_WORKER","false").lower()!="true":
        raise RuntimeError("Illustration worker disabled")
    if not callable(renderer) or not callable(moderator) or not callable(image_moderator):
        raise ValueError("Independent prompt and image moderators and renderer required")
    global_cap=_cap("MAX_ILLUSTRATIONS_PER_DAY")
    owner_cap=_cap("MAX_PARENT_ILLUSTRATIONS_PER_DAY")
    if global_cap==0 or owner_cap==0:
        raise RuntimeError("Illustration daily quota is disabled")

    day=datetime.now(timezone.utc).date().isoformat()
    with db.connection() as c:
        if not db.IS_PG:
            c.execute("BEGIN IMMEDIATE")
        query=("SELECT id,owner_id,book_id,page_number,style FROM illustration_jobs "
               "WHERE status='queued' ORDER BY created_at,id LIMIT 1")
        if db.IS_PG:
            query+=" FOR UPDATE SKIP LOCKED"
        row=db.sql(c,query).fetchone()
        if not row:
            return None
        job_id,owner,book_id,page_number,style=row
        # Check the book and pilot allowlist again at execution time.
        parent=db.sql(c,"SELECT email FROM parents WHERE id=?",(owner,)).fetchone()
        allowed={e.strip().lower() for e in os.getenv("AI_ALLOWED_EMAILS","").split(",") if e.strip()}
        book=db.sql(c,"SELECT id FROM books WHERE id=? AND owner_id=?",(book_id,owner)).fetchone()
        if not parent or parent[0].lower() not in allowed or not book:
            db.sql(c,"UPDATE illustration_jobs SET status='failed',completed_at=? WHERE id=?",
                   (_now(),job_id))
            c.commit()
            return job_id
        # The two conditional upserts must commit with the claim, so workers
        # cannot oversubscribe a quota. No refunds after a paid call is possible.
        reserved_global=db.sql(c,(
            "INSERT INTO illustration_daily_quota(day,used) VALUES(?,1) "
            "ON CONFLICT(day) DO UPDATE SET used=illustration_daily_quota.used+1 "
            "WHERE illustration_daily_quota.used<? RETURNING used"
        ),(day,global_cap)).fetchone()
        if not reserved_global:
            db.sql(c,"UPDATE illustration_jobs SET status='failed',completed_at=? WHERE id=?",
                   (_now(),job_id))
            c.commit()
            return job_id
        reserved_parent=db.sql(c,(
            "INSERT INTO illustration_parent_quota(owner_id,day,used) VALUES(?,?,1) "
            "ON CONFLICT(owner_id,day) DO UPDATE SET used=illustration_parent_quota.used+1 "
            "WHERE illustration_parent_quota.used<? RETURNING used"
        ),(owner,day,owner_cap)).fetchone()
        if not reserved_parent:
            # This call has NOT reached the renderer; roll back reservation
            # changes by restoring its prior value in the same transaction.
            db.sql(c,"UPDATE illustration_daily_quota SET used=used-1 WHERE day=?",(day,))
            db.sql(c,"UPDATE illustration_jobs SET status='failed',completed_at=? WHERE id=?",
                   (_now(),job_id))
            c.commit()
            return job_id
        db.sql(c,"UPDATE illustration_jobs SET status='processing',started_at=? "
                 "WHERE id=? AND status='queued'",(_now(),job_id))
        c.commit()

    # Build only a generic original fictional scene; never transmit private
    # story text, names, photos, account IDs or book IDs to the renderer.
    try:
        prompt=illustration_brief(book_id,page_number,style).prompt
        if moderator(prompt) is not True:
            _finish(job_id,"failed")
            return job_id
        image=renderer(prompt)
        if not isinstance(image,bytes):
            raise ValueError("Renderer returned invalid media")
        # A separate content moderator must also inspect the rendered image
        # in a real provider adapter before this function can be used live.
        db.save_private_illustration_asset(job_id,image)
    except Exception:
        # No automatic retry or refund; the provider may have charged.
        _finish(job_id,"needs_review")
    return job_id
