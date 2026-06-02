import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

HIMALAYAS_API_URL = "https://himalayas.app/api/jobs"


class HimalayanScraper(BaseScraper):
    PLATFORM_NAME = "himalayas"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        page = 1
        limit = 50

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                while True:
                    response = await client.get(
                        HIMALAYAS_API_URL,
                        params={"limit": limit, "offset": (page - 1) * limit},
                    )
                    response.raise_for_status()
                    data = response.json()

                    entries = data.get("jobs", [])
                    if not entries:
                        break

                    for entry in entries:
                        try:
                            posted_at = self._parse_date(entry.get("createdAt", ""))

                            # Apply time window
                            if posted_at and not (from_dt <= posted_at <= to_dt):
                                continue

                            job = NormalizedJob(
                                platform=self.PLATFORM_NAME,
                                title=entry.get("title", ""),
                                company=entry.get("company", {}).get("name", "Unknown"),
                                url=entry.get("applicationLink") or entry.get("url", ""),
                                description=entry.get("description", ""),
                                location=entry.get("locationRestrictions", "Anywhere"),
                                job_type=self._map_job_type(entry),
                                experience_level=self._map_experience(entry),
                                location_region=entry.get("locationRestrictions", "Anywhere"),
                                tech_stack=self._extract_tech(entry),
                                salary=self._extract_salary(entry),
                                posted_at=posted_at,
                                raw=entry,
                            )
                            jobs.append(job)

                        except Exception as e:
                            logger.warning(f"Himalayas: Error parsing entry: {e}")
                            continue

                    # Stop paginating if we've passed the time window
                    if entries and posted_at and posted_at < from_dt:
                        break

                    page += 1

        except Exception as e:
            logger.error(f"Himalayas: Fetch failed: {e}")

        logger.info(f"Himalayas: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, date_str: str) -> datetime:
        try:
            dt = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            return dt
        except Exception:
            return None

    def _map_job_type(self, entry: dict) -> str:
        remote = entry.get("isRemote", False)
        return "remote" if remote else "onsite"

    def _map_experience(self, entry: dict) -> str:
        level = entry.get("jobType", "") or entry.get("seniority", "")
        return self.normalize_experience_level(level)

    def _extract_tech(self, entry: dict) -> List[str]:
        tech_list = entry.get("techStack", []) or []
        if isinstance(tech_list, list):
            return [t.get("name", t) if isinstance(t, dict) else t for t in tech_list]
        return []

    def _extract_salary(self, entry: dict) -> str:
        salary_min = entry.get("salaryMin")
        salary_max = entry.get("salaryMax")
        currency = entry.get("salaryCurrency", "USD")
        if salary_min and salary_max:
            return f"{currency} {salary_min:,} – {salary_max:,}"
        if salary_min:
            return f"{currency} {salary_min:,}+"
        return None
