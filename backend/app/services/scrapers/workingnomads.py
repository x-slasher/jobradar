import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

WORKINGNOMADS_API_URL = "https://www.workingnomads.com/api/exposed_jobs/"


class WorkingNomadsScraper(BaseScraper):
    PLATFORM_NAME = "workingnomads"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        limit = 50
        offset = 0

        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                while True:
                    response = await client.get(
                        WORKINGNOMADS_API_URL,
                        params={"limit": limit, "offset": offset},
                    )
                    response.raise_for_status()
                    entries = response.json()

                    if not entries:
                        break

                    oldest_on_page = None
                    for entry in entries:
                        try:
                            posted_at = self._parse_date(entry.get("pub_date"))
                            if oldest_on_page is None or (posted_at and posted_at < oldest_on_page):
                                oldest_on_page = posted_at

                            if posted_at and not (from_dt <= posted_at <= to_dt):
                                continue

                            tags = [
                                t.strip()
                                for t in (entry.get("tags") or "").split(",")
                                if t.strip()
                            ]

                            job = NormalizedJob(
                                platform=self.PLATFORM_NAME,
                                title=entry.get("title", ""),
                                company=entry.get("company_name", "Unknown"),
                                url=entry.get("url", ""),
                                description=entry.get("description", ""),
                                location=entry.get("location") or "Anywhere",
                                job_type=self._map_job_type(entry),
                                experience_level=self._map_experience(tags),
                                location_region=self._map_region(entry),
                                tech_stack=tags[:10],
                                salary=None,
                                posted_at=posted_at,
                                raw=entry,
                            )
                            jobs.append(job)

                        except Exception as e:
                            logger.warning(f"WorkingNomads: Error parsing entry: {e}")
                            continue

                    if oldest_on_page and oldest_on_page < from_dt:
                        break

                    if len(entries) < limit:
                        break

                    offset += limit

        except Exception as e:
            logger.error(f"WorkingNomads: Fetch failed: {e}")

        logger.info(f"WorkingNomads: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, value) -> datetime:
        if not value:
            return None
        try:
            return datetime.fromisoformat(str(value))
        except Exception:
            return None

    def _map_job_type(self, entry: dict) -> str:
        location = (entry.get("location") or "").lower()
        if "remote" in location or not location or location in ("anywhere", "anywhere in the world"):
            return "remote"
        if "hybrid" in location:
            return "hybrid"
        return "remote"

    def _map_experience(self, tags: list) -> str:
        combined = " ".join(tags).lower()
        return self.normalize_experience_level(combined)

    def _map_region(self, entry: dict) -> str:
        location = (entry.get("location") or "").lower()
        for region in ("usa", "us only", "united states", "north america"):
            if region in location:
                return "USA"
        for region in ("europe", "eu"):
            if region in location:
                return "Europe"
        for region in ("asia",):
            if region in location:
                return "Asia"
        return "Anywhere"
