"""Read-only private illustration reconciliation for trusted operators.

No HTTP routes, no automatic retries, no database mutation, and no provider
calls. An unresolved in-flight job is *uncertain*, not automatically failed.
"""
from datetime import datetime,timezone
import os


def _utc(value:str)->datetime|None:
    try:
        result=datetime.fromisoformat(value)
        if result.tzinfo is None:
            return None
        return result.astimezone(timezone.utc)
    except (ValueError,TypeError):
        return None


def unresolved_illustration_report(*,older_than_seconds:int=180,limit:int=100)->dict:
    """Summarize possibly lost worker responses without private story content.

    Called only from a trusted operator process using isolated Preview DB.
    Returns opaque job IDs and state timing, not parent IDs or book IDs.
    """
    if os.getenv("APP_ENV","development").lower() not in ("development","preview","staging"):
        raise RuntimeError("Reconciliation reports refuse production")
    if not isinstance(older_than_seconds,int) or older_than_seconds<60:
        raise ValueError("Invalid recovery threshold")
    if not isinstance(limit,int) or not 1<=limit<=100:
        raise ValueError("Invalid report limit")
    # Import after environment check: secure_main validates auth secret on import.
    from illustration_worker import illustration_attempt_snapshot
    import secure_main as db
    now=datetime.now(timezone.utc)
    with db.connection() as c:
        rows=db.sql(c,
            "SELECT id,started_at FROM illustration_jobs WHERE status='processing' "
            "ORDER BY started_at,id LIMIT ?",(limit,)).fetchall()
        audit=db.sql(c,"SELECT event,COUNT(*) FROM illustration_job_events GROUP BY event").fetchall()
    stuck=[]
    for job_id,started in rows:
        date=_utc(started)
        age=max(0,int((now-date).total_seconds())) if date else None
        if age is None or age>=older_than_seconds:
            stuck.append({"job_id":job_id,"age_seconds":age,"status":"needs_review"})
    return {
        "as_of":now.isoformat(),
        "active_processing_examined":len(rows),
        "unresolved":stuck,
        "event_counts":{str(event):int(count) for event,count in audit},
        "attempts":illustration_attempt_snapshot(),
        "note":"Reserved attempts are not actual provider charges. Never retry uncertain jobs automatically.",
    }
