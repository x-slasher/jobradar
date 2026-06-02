from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime


@dataclass
class NormalizedJob:
    """Master schema — all platform adapters normalize into this format."""
    platform: str
    title: str
    company: str
    url: str
    description: str
    location: Optional[str] = None
    job_type: Optional[str] = None          # remote / hybrid / onsite
    experience_level: Optional[str] = None  # junior / mid / senior
    location_region: Optional[str] = None
    tech_stack: List[str] = field(default_factory=list)
    salary: Optional[str] = None
    posted_at: Optional[datetime] = None
    raw: Optional[dict] = field(default_factory=dict)


class BaseScraper(ABC):
    """All platform scrapers inherit from this base class."""

    PLATFORM_NAME: str = ""

    @abstractmethod
    async def fetch(self, from_dt: datetime, to_dt: datetime) -> List[NormalizedJob]:
        """
        Fetch jobs posted between from_dt and to_dt.
        Returns a list of NormalizedJob objects.
        """
        pass

    def normalize_experience_level(self, raw: str) -> Optional[str]:
        raw = raw.lower()
        if any(k in raw for k in ["senior", "sr.", "lead", "principal", "staff"]):
            return "senior"
        if any(k in raw for k in ["junior", "jr.", "entry", "graduate"]):
            return "junior"
        if any(k in raw for k in ["mid", "intermediate", "associate"]):
            return "mid"
        return None

    def normalize_job_type(self, raw: str) -> Optional[str]:
        raw = raw.lower()
        if "remote" in raw:
            return "remote"
        if "hybrid" in raw:
            return "hybrid"
        if any(k in raw for k in ["onsite", "on-site", "in-office", "in office"]):
            return "onsite"
        return None
