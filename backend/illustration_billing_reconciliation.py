"""Immutable, operator-only recording of manually verified image-provider charges.

Never accesses the provider or generates an image. An entry does not change job
state, refund quotas or enable automatic retries. No HTTP routes are exposed.
"""
from datetime import datetime, timezone
import os
import re

_ALLOWED={"charged","not_charged","unknown"}
_DIGEST=re.compile(r"[0-9a-f]{64}\Z")
_UUID=re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\Z")


def _operator_gate()->None:
    if os.getenv("APP_ENV","development").lower() not in ("development","preview","staging"):
        raise RuntimeError("Billing reconciliation refuses production")
    if os.getenv("ENABLE_ILLUSTRATION_BILLING_RECONCILIATION","false").lower()!="true":
        raise RuntimeError("Billing reconciliation disabled")


def record_verified_charge(
    *,job_id:str,charge_status:str,amount_micro_usd:int|None,evidence_sha256:str
)->dict:
    """Record a single immutable, manually verified finding.

    evidence_sha256 is a digest of evidence stored outside this application.
    No emails, provider secrets, receipts or child data are persisted here.
    Values are not inferred from reserved quotas.
    """
    _operator_gate()
    if not isinstance(job_id,str) or not _UUID.fullmatch(job_id):
        raise ValueError("Invalid job id")
    if charge_status not in _ALLOWED:
        raise ValueError("Invalid charge status")
    if not isinstance(evidence_sha256,str) or not _DIGEST.fullmatch(evidence_sha256):
        raise ValueError("Invalid evidence digest")
    if amount_micro_usd is not None and (type(amount_micro_usd) is not int or not 0<=amount_micro_usd<=100_000_000):
        raise ValueError("Invalid charge amount")
    if charge_status=="not_charged" and amount_micro_usd!=0:
        raise ValueError("A verified non-charge must have amount zero")
    if charge_status=="charged" and (amount_micro_usd is None or amount_micro_usd<=0):
        raise ValueError("A charged review must have positive amount")
    if charge_status=="unknown" and amount_micro_usd is not None:
        raise ValueError("Unknown charges cannot have an amount")

    import secure_main as db
    now=datetime.now(timezone.utc).isoformat()
    with db.connection() as c:
        if not db.IS_PG:
            c.execute("BEGIN IMMEDIATE")
        query="SELECT status FROM illustration_jobs WHERE id=?"
        if db.IS_PG:
            query+=" FOR UPDATE"
        row=db.sql(c,query,(job_id,)).fetchone()
        if row is None:
            raise ValueError("Job not found")
        if row[0] in ("queued","processing"):
            raise ValueError("Only terminal jobs can be reconciled")
        result=db.sql(c,(
            "INSERT INTO illustration_billing_reviews(job_id,charge_status,amount_micro_usd,evidence_sha256,reviewed_at) "
            "VALUES(?,?,?,?,?) ON CONFLICT(job_id) DO NOTHING"
        ),(job_id,charge_status,amount_micro_usd,evidence_sha256,now))
        if result.rowcount!=1:
            raise ValueError("Job has already been reconciled")
        c.commit()
    return {"job_id":job_id,"charge_status":charge_status,"amount_micro_usd":amount_micro_usd}


def billing_review_snapshot()->dict:
    """Aggregate confirmed/unknown outcomes; zero personal details."""
    _operator_gate()
    import secure_main as db
    with db.connection() as c:
        rows=db.sql(c,
            "SELECT charge_status,COUNT(*),SUM(amount_micro_usd) "
            "FROM illustration_billing_reviews GROUP BY charge_status").fetchall()
    return {
        "confirmed_micro_usd":sum(int(total or 0) for status,_,total in rows if status=="charged"),
        "reviewed_counts":{str(status):int(count) for status,count,_ in rows},
        "note":"Provider billing must be verified externally. This summary excludes unreviewed jobs.",
    }
