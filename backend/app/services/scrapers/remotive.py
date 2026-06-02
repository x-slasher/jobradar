import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs"


class RemotiveScraper(BaseScraper):
    PLATFORM_NAME = "remotive"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                response = await client.get(REMOTIVE_API_URL)
                response.raise_for_status()
                data = response.json()

            for entry in data.get("jobs", []):
                try:
                    posted_at = self._parse_date(entry.get("publication_date"))
                    if posted_at and not (from_dt <= posted_at <= to_dt):
                        continue

                    tags = entry.get("tags") or []

                    job = NormalizedJob(
                        platform=self.PLATFORM_NAME,
                        title=entry.get("title", ""),
                        company=entry.get("company_name", "Unknown"),
                        url=entry.get("url", ""),
                        description=entry.get("description", ""),
                        location=entry.get("candidate_required_location") or "Anywhere",
                        job_type="remote",
                        experience_level=self._map_experience(tags),
                        location_region=self._map_region(entry.get("candidate_required_location", "")),
                        tech_stack=tags[:10],
                        salary=entry.get("salary") or None,
                        posted_at=posted_at,
                        raw=entry,
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"Remotive: Error parsing entry: {e}")
                    continue

        except Exception as e:
            logger.error(f"Remotive: Fetch failed: {e}")

        logger.info(f"Remotive: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, value) -> datetime:
        if not value:
            return None
        try:
            dt = datetime.fromisoformat(str(value))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except Exception:
            return None

    def _map_experience(self, tags: list) -> str:
        combined = " ".join(tags).lower()
        return self.normalize_experience_level(combined)

    def _map_region(self, location: str) -> str:
        loc = location.lower()
        if not loc or loc in ("anywhere", "worldwide", ""):
            return "Anywhere"
        if any(r in loc for r in ("usa", "united states", "us only", "north america")):
            return "USA"
        if any(r in loc for r in ("europe", "eu only", "uk", "emea")):
            return "Europe"
        if any(r in loc for r in ("asia", "apac")):
            return "Asia"
        if any(r in loc for r in ("latin america", "latam", "south america")):
            return "Latin America"
        return "Anywhere"
