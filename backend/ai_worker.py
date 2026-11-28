"""One-shot isolated WonderTale AI worker.

Use only with a dedicated WonderTale preview DATABASE_URL, private credentials,
and ENABLE_AI_JOBS=true. This does NOT create an automatic scheduler on Vercel.
Run as a separately managed trusted process; it processes at most one job.
"""
import os
import sys


def main() -> int:
    if os.getenv("APP_ENV", "").lower() not in ("preview", "staging", "development"):
        print("AI worker refuses production", file=sys.stderr)
        return 2
    if os.getenv("ENABLE_AI_JOBS", "false").lower() != "true":
        print("AI worker queue is disabled", file=sys.stderr)
        return 2
    from secure_main import process_one_queued_ai_job
    processed = process_one_queued_ai_job()
    print("One job processed" if processed else "No queued jobs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
