import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

EMPLLO_API_URL = "https://empllo.com/api/v1"

TECH_CATEGORIES = {
    "engineering", "data", "dev ops", "devops", "product", "design",
    "software", "it", "security", "infrastructure", "machine learning",
    "artificial intelligence", "ai", "mobile", "qa", "testing",
}


class EmplloScraper(BaseScraper):
    PLATFORM_NAME = "empllo"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        limit = 100
        offset = 0

        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                while True:
                    response = await client.get(
                        EMPLLO_API_URL,
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
                            posted_at = self._parse_epoch(entry.get("pubDate"))
                            if oldest_on_page is None or (posted_at and posted_at < oldest_on_page):
                                oldest_on_page = posted_at

                            if posted_at and not (from_dt <= posted_at <= to_dt):
                                continue

                            # Skip non-tech categories
                            category = (entry.get("mainCategory") or "").lower()
                            if category and category not in TECH_CATEGORIES:
                                continue

                            # Only include remote/hybrid — empllo covers all work models
                            work_model = (entry.get("workModel") or "").lower()
                            if work_model == "on site":
                                continue

                            locations = entry.get("locations") or []
                            location = ", ".join(locations) if locations else "Anywhere"

                            job = NormalizedJob(
                                platform=self.PLATFORM_NAME,
                                title=entry.get("title", ""),
                                company=entry.get("companyName", "Unknown"),
                                url=entry.get("applicationLink") or entry.get("guid", ""),
                                description=entry.get("description", ""),
                                location=location,
                                job_type=self._map_job_type(work_model),
                                experience_level=self._map_experience(entry),
                                location_region=self._map_region(locations),
                                tech_stack=(entry.get("tags") or [])[:10],
                                salary=self._extract_salary(entry),
                                posted_at=posted_at,
                                raw=entry,
                            )
                            jobs.append(job)

                        except Exception as e:
                            logger.warning(f"Empllo: Error parsing entry: {e}")
                            continue

                    if oldest_on_page and oldest_on_page < from_dt:
                        break

                    if len(entries) < limit:
                        break

                    offset += limit

        except Exception as e:
            logger.error(f"Empllo: Fetch failed: {e}")

        logger.info(f"Empllo: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_epoch(self, value) -> datetime:
        if value is None:
            return None
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None

    def _map_job_type(self, work_model: str) -> str:
        if "hybrid" in work_model:
            return "hybrid"
        return "remote"

    def _map_experience(self, entry: dict) -> str:
        level = (entry.get("seniorityLevel") or "").lower()
        return self.normalize_experience_level(level)

    def _map_region(self, locations: list) -> str:
        text = " ".join(locations).lower()
        if not text or "anywhere" in text or "worldwide" in text or "world" in text:
            return "Anywhere"
        if any(r in text for r in ("usa", "united states", "north america")):
            return "USA"
        if any(r in text for r in ("europe", "eu", "uk", "germany", "france")):
            return "Europe"
        if any(r in text for r in ("asia", "india", "singapore", "japan")):
            return "Asia"
        return "Anywhere"

    def _extract_salary(self, entry: dict) -> str:
        lo = entry.get("minSalary")
        hi = entry.get("maxSalary")
        currency = entry.get("currency") or "USD"
        if lo and hi:
            return f"{currency} {int(lo):,} – {int(hi):,}"
        if lo:
            return f"{currency} {int(lo):,}+"
        return None
