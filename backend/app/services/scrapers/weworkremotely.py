import feedparser
import httpx
from datetime import datetime, timezone
from typing import List
from email.utils import parsedate_to_datetime
from bs4 import BeautifulSoup
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging

logger = logging.getLogger(__name__)

WWR_RSS_URL = "https://weworkremotely.com/remote-jobs.rss"


class WeWorkRemotelyScraper(BaseScraper):
    PLATFORM_NAME = "weworkremotely"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                response = await client.get(WWR_RSS_URL)
                response.raise_for_status()

            feed = feedparser.parse(response.text)

            for entry in feed.entries:
                try:
                    posted_at = self._parse_date(entry.get("published", ""))

                    # Apply time window filter
                    if posted_at and not (from_dt <= posted_at <= to_dt):
                        continue

                    title, company = self._parse_title_company(entry.get("title", ""))
                    description = self._clean_html(entry.get("summary", ""))

                    job = NormalizedJob(
                        platform=self.PLATFORM_NAME,
                        title=title,
                        company=company,
                        url=entry.get("link", ""),
                        description=description,
                        job_type="remote",
                        location="Remote",
                        location_region="Anywhere",
                        experience_level=self.normalize_experience_level(title),
                        tech_stack=self._extract_tech_stack(description),
                        posted_at=posted_at,
                        raw=dict(entry),
                    )
                    jobs.append(job)

                except Exception as e:
                    logger.warning(f"WWR: Error parsing entry: {e}")
                    continue

        except Exception as e:
            logger.error(f"WWR: Fetch failed: {e}")

        logger.info(f"WWR: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_date(self, date_str: str) -> datetime:
        try:
            dt = parsedate_to_datetime(date_str)
            return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
        except Exception:
            return None

    def _parse_title_company(self, raw_title: str):
        """WWR titles are often: 'Company: Job Title'"""
        if ":" in raw_title:
            parts = raw_title.split(":", 1)
            return parts[1].strip(), parts[0].strip()
        return raw_title.strip(), "Unknown"

    def _clean_html(self, html: str) -> str:
        return BeautifulSoup(html, "lxml").get_text(separator=" ").strip()

    def _extract_tech_stack(self, text: str) -> List[str]:
        known_tech = [
            "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "Kotlin",
            "Ruby", "PHP", "C++", "C#", "Swift", "React", "Vue", "Angular",
            "Node.js", "FastAPI", "Django", "Flask", "Laravel", "Rails",
            "Docker", "Kubernetes", "AWS", "Azure", "GCP", "PostgreSQL",
            "MySQL", "MongoDB", "Redis", "GraphQL", "REST", "gRPC",
        ]
        found = []
        text_lower = text.lower()
        for tech in known_tech:
            if tech.lower() in text_lower:
                found.append(tech)
        return found
