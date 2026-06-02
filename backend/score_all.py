"""
Score all unscored jobs against the active CV.

Usage (from the project root):
    docker exec jobradar-fastapi-1 python score_all.py

Options:
    --all     Re-score every job, including already-scored ones
"""
import sys
import json
import time

from app.db.database import SessionLocal
from app.models.models import Job, CVVersion
from app.services.match_service import match_cv_to_job


def run(rescore_all: bool = False):
    db = SessionLocal()
    try:
        cv = db.query(CVVersion).filter(CVVersion.is_active == True).first()
        if not cv or not cv.summary:
            print("ERROR: No active CV found. Upload your CV first via the web app.")
            sys.exit(1)

        query = db.query(Job).filter(Job.is_deleted == False)
        if not rescore_all:
            query = query.filter(Job.score == None)

        jobs = query.all()
        total = len(jobs)

        if total == 0:
            print("All jobs already scored. Use --all to re-score everything.")
            return

        mode = "Re-scoring all" if rescore_all else "Scoring unscored"
        print(f"{mode} {total} jobs against CV: {cv.filename}")
        print("-" * 50)

        scored = 0
        failed = 0
        start = time.time()

        for i, job in enumerate(jobs, 1):
            try:
                result = match_cv_to_job(cv.summary, job)
                job.score = result["score"]
                job.analysis = json.dumps({
                    "summary":     result["summary"],
                    "strengths":   result["strengths"],
                    "gaps":        result["gaps"],
                    "suggestions": result["suggestions"],
                })
                job.cv_version_id = cv.id
                db.commit()
                scored += 1

                bar = "#" * int(i / total * 30)
                pct = int(i / total * 100)
                print(f"\r[{bar:<30}] {pct:3d}%  {i}/{total}  ({result['score']}% — {job.title[:40]})", end="", flush=True)

            except Exception as e:
                db.rollback()
                failed += 1
                print(f"\nWARN: Failed to score job {job.id} ({job.title[:40]}): {e}")

        elapsed = time.time() - start
        print(f"\n{'-' * 50}")
        print(f"Done in {elapsed:.1f}s — {scored} scored, {failed} failed")

    finally:
        db.close()


if __name__ == "__main__":
    rescore_all = "--all" in sys.argv
    run(rescore_all)
