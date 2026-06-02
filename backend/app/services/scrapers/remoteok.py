import httpx
from datetime import datetime, timezone
from typing import List
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

REMOTEOK_API_URL = "https://remoteok.com/api"


class RemoteOKScraper(BaseScraper):
    PLATFORM_NAME = "remoteok"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            async with httpx.AsyncClient(
                timeout=30,
                headers={"User-Agent": "Mozilla/5.0 (compatible; JobRadar/1.0)"},
            ) as client:
                response = await client.get(REMOTEOK_API_URL)
                response.raise_for_status()
                data = response.json()

            entries = [e for e in data if isinstance(e, dict) and "position" in e]

            for entry in entries:
                try:
                    posted_at = self._parse_epoch(entry.get("epoch"))
                    if posted_at and not (from_dt <= posted_at <= to_dt):
                        continue

                    tags = entry.get("tags") or []
                    tags = [t for t in tags if isinstance(t, str)]

                    salary = self._extract_salary(entry)

                    job = NormalizedJob(
                        platform=self.PLATFORM_NAME,
                        title=entry.get("position", ""),
                        company=entry.get("company", "Unknown"),
                        url=entry.get("apply_url") or entry.get("url", ""),
                        description=entry.get("description", ""),
                        location=entry.get("location") or "Remote",
                        job_type="remote",
                        experience_level=self._map_experience(tags),
                        location_region="Anywhere",
                        tech_stack=tags[:10],
                        salary=salary,
                        posted_at=posted_at,
                        raw=entry,
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"RemoteOK: Error parsing entry: {e}")
                    continue

        except Exception as e:
            logger.error(f"RemoteOK: Fetch failed: {e}")

        logger.info(f"RemoteOK: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_epoch(self, value) -> datetime:
        if value is None:
            return None
        try:
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        except Exception:
            return None

    def _map_experience(self, tags: list) -> str:
        combined = " ".join(tags).lower()
        return self.normalize_experience_level(combined)

    def _extract_salary(self, entry: dict) -> str:
        lo = entry.get("salary_min")
        hi = entry.get("salary_max")
        if lo and hi and lo > 0 and hi > 0:
            return f"USD {lo:,} – {hi:,}"
        if lo and lo > 0:
            return f"USD {lo:,}+"
        return None
