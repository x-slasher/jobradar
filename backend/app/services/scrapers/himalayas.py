import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

HIMALAYAS_API_URL = "https://himalayas.app/jobs/api"


class HimalayanScraper(BaseScraper):
    PLATFORM_NAME = "himalayas"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        offset = 0
        limit = 50

        try:
            async with httpx.AsyncClient(timeout=30) as client:
                while True:
                    response = await client.get(
                        HIMALAYAS_API_URL,
                        params={"limit": limit, "offset": offset},
                    )
                    response.raise_for_status()
                    data = response.json()

                    entries = data.get("jobs", [])
                    if not entries:
                        break

                    oldest_on_page = None
                    for entry in entries:
                        try:
                            posted_at = self._parse_date(entry.get("pubDate"))
                            if oldest_on_page is None or (posted_at and posted_at < oldest_on_page):
                                oldest_on_page = posted_at

                            if posted_at and not (from_dt <= posted_at <= to_dt):
                                continue

                            location_list = entry.get("locationRestrictions") or []
                            location = ", ".join(location_list) if location_list else "Anywhere"

                            job = NormalizedJob(
                                platform=self.PLATFORM_NAME,
                                title=entry.get("title", ""),
                                company=entry.get("companyName", "Unknown"),
                                url=entry.get("applicationLink") or entry.get("guid", ""),
                                description=entry.get("description", ""),
                                location=location,
                                job_type=self._map_job_type(entry),
                                experience_level=self._map_experience(entry),
                                location_region=location,
                                tech_stack=self._extract_tech(entry),
                                salary=self._extract_salary(entry),
                                posted_at=posted_at,
                                raw=entry,
                            )
                            jobs.append(job)

                        except Exception as e:
                            logger.warning(f"Himalayas: Error parsing entry: {e}")
                            continue

                    if oldest_on_page and oldest_on_page < from_dt:
                        break

                    offset += limit

        except Exception as e:
            logger.error(f"Himalayas: Fetch failed: {e}")

        logger.info(f"Himalayas: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, value) -> datetime:
        if value is None:
            return None
        try:
            if isinstance(value, (int, float)):
                return datetime.fromtimestamp(value, tz=timezone.utc)
            return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        except Exception:
            return None

    def _map_job_type(self, entry: dict) -> str:
        restrictions = entry.get("locationRestrictions") or []
        if not restrictions or restrictions == ["Anywhere"]:
            return "remote"
        employment = (entry.get("employmentType") or "").lower()
        if "remote" in employment:
            return "remote"
        return "remote"  # Himalayas is a remote-first board

    def _map_experience(self, entry: dict) -> str:
        seniority = entry.get("seniority") or []
        level = " ".join(seniority) if isinstance(seniority, list) else str(seniority)
        return self.normalize_experience_level(level)

    def _extract_tech(self, entry: dict) -> List[str]:
        categories = entry.get("categories") or []
        return [c.replace("-", " ").title() for c in categories[:5]] if categories else []

    def _extract_salary(self, entry: dict) -> str:
        salary_min = entry.get("minSalary")
        salary_max = entry.get("maxSalary")
        currency = entry.get("currency", "USD")
        if salary_min and salary_max:
            return f"{currency} {salary_min:,} – {salary_max:,}"
        if salary_min:
            return f"{currency} {salary_min:,}+"
        return None
