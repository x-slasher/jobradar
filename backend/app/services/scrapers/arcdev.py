import httpx
from bs4 import BeautifulSoup
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from app.services.scrapers.base import BaseScraper, NormalizedJob
import logging
import re

logger = logging.getLogger(__name__)

ARCDEV_JOBS_URL = "https://arc.dev/remote-jobs"


class ArcDevScraper(BaseScraper):
    PLATFORM_NAME = "arcdev"

    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        jobs = []
        try:
            headers = {
                "User-Agent": (
                    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            }

            async with httpx.AsyncClient(timeout=30, headers=headers, follow_redirects=True) as client:
                response = await client.get(ARCDEV_JOBS_URL)
                response.raise_for_status()

            soup = BeautifulSoup(response.text, "lxml")

            # Arc.dev job cards — selectors may need updating if they change HTML
            job_cards = soup.select("div[class*='job-card'], article[class*='job'], div[data-job-id]")

            if not job_cards:
                # Fallback: try generic link-based discovery
                job_cards = soup.select("a[href*='/remote-jobs/']")

            for card in job_cards:
                try:
                    job = self._parse_card(card, from_dt, to_dt)
                    if job:
                        jobs.append(job)
                except Exception as e:
                    logger.warning(f"Arc.dev: Error parsing card: {e}")
                    continue

        except Exception as e:
            logger.error(f"Arc.dev: Fetch failed: {e}")

        logger.info(f"Arc.dev: Fetched {len(jobs)} jobs")
        return jobs

    def _parse_card(self, card, from_dt: datetime, to_dt: datetime) -> Optional[NormalizedJob]:
        title_el = card.select_one("[class*='title'], [class*='job-title'], h2, h3")
        company_el = card.select_one("[class*='company'], [class*='employer']")
        url_el = card.select_one("a[href]")
        date_el = card.select_one("[class*='date'], [class*='time'], time")

        title = title_el.get_text(strip=True) if title_el else ""
        company = company_el.get_text(strip=True) if company_el else "Unknown"
        url = url_el["href"] if url_el else ""

        if not url.startswith("http"):
            url = f"https://arc.dev{url}"

        if not title or not url:
            return None

        posted_at = self._parse_relative_date(date_el.get_text(strip=True) if date_el else "")

        if posted_at and not (from_dt <= posted_at <= to_dt):
            return None

        description = card.get_text(separator=" ", strip=True)

        return NormalizedJob(
            platform=self.PLATFORM_NAME,
            title=title,
            company=company,
            url=url,
            description=description,
            job_type="remote",
            location="Remote",
            location_region="Anywhere",
            experience_level=self.normalize_experience_level(title),
            tech_stack=self._extract_tech_stack(description),
            posted_at=posted_at,
            raw={"html": str(card)[:500]},
        )

    def _parse_relative_date(self, text: str) -> Optional[datetime]:
        """Convert relative dates like '2 days ago' to absolute datetime."""
        now = datetime.now(timezone.utc)
        text = text.lower().strip()
        try:
            if "hour" in text:
                hours = int(re.search(r"(\d+)", text).group(1))
                return now - timedelta(hours=hours)
            if "day" in text:
                days = int(re.search(r"(\d+)", text).group(1))
                return now - timedelta(days=days)
            if "week" in text:
                weeks = int(re.search(r"(\d+)", text).group(1))
                return now - timedelta(weeks=weeks)
            if "today" in text or "just" in text:
                return now
            if "yesterday" in text:
                return now - timedelta(days=1)
        except Exception:
            pass
        return None

    def _extract_tech_stack(self, text: str) -> List[str]:
        known_tech = [
            "Python", "JavaScript", "TypeScript", "Go", "Rust", "Java", "Kotlin",
            "Ruby", "PHP", "C++", "C#", "Swift", "React", "Vue", "Angular",
            "Node.js", "FastAPI", "Django", "Flask", "Docker", "Kubernetes",
            "AWS", "Azure", "GCP", "PostgreSQL", "MySQL", "MongoDB", "Redis",
        ]
        found = []
        text_lower = text.lower()
        for tech in known_tech:
            if tech.lower() in text_lower:
                found.append(tech)
        return found
