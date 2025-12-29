#!/usr/bin/env python3
"""
IMDB Parental Guide Scraper
Scrapes parental guide information from IMDB movie pages.

This version uses regex parsing and only requires `requests` (no BeautifulSoup).

Extracts:
- Content rating (MPA rating)
- Sex & Nudity
- Violence & Gore
- Profanity
- Alcohol, Drugs & Smoking
- Frightening & Intense Scenes
"""

import html
import json
import re
import time
from dataclasses import dataclass, field, asdict
from typing import Optional

import requests


@dataclass
class CertificationRating:
    """A single rating for a certification (e.g., '16' with note 'original rating')."""
    rating: str = ""
    note: str = ""


@dataclass
class CertificationItem:
    """Certification information for a specific country/region."""
    country: str = ""
    ratings: list[CertificationRating] = field(default_factory=list)


@dataclass
class CategoryInfo:
    """Information for a single parental guide category."""
    severity: str = ""
    items: list[str] = field(default_factory=list)


@dataclass
class ParentalGuide:
    """Complete parental guide information for a movie."""
    imdb_id: str = ""
    title: str = ""
    url: str = ""
    content_rating: str = ""
    sex_nudity: CategoryInfo = field(default_factory=CategoryInfo)
    violence_gore: CategoryInfo = field(default_factory=CategoryInfo)
    profanity: CategoryInfo = field(default_factory=CategoryInfo)
    alcohol_drugs_smoking: CategoryInfo = field(default_factory=CategoryInfo)
    frightening_intense: CategoryInfo = field(default_factory=CategoryInfo)
    certifications: list[CertificationItem] = field(default_factory=list)

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            "imdb_id": self.imdb_id,
            "title": self.title,
            "url": self.url,
            "content_rating": self.content_rating,
            "sex_nudity": asdict(self.sex_nudity),
            "violence_gore": asdict(self.violence_gore),
            "profanity": asdict(self.profanity),
            "alcohol_drugs_smoking": asdict(self.alcohol_drugs_smoking),
            "frightening_intense": asdict(self.frightening_intense),
            "certifications": [asdict(cert) for cert in self.certifications],
        }


class IMDBParentalGuideScraper:
    """Scraper for IMDB parental guide pages (regex-based, no BeautifulSoup required)."""

    BASE_URL = "https://www.imdb.com"
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                      "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }

    # Category section IDs
    CATEGORY_IDS = {
        "sex_nudity": "nudity",
        "violence_gore": "violence",
        "profanity": "profanity",
        "alcohol_drugs_smoking": "alcohol",
        "frightening_intense": "frightening",
    }

    def __init__(self, timeout: int = 30, max_retries: int = 3, retry_delay: float = 2.0):
        """
        Initialize the scraper.

        Args:
            timeout: Request timeout in seconds.
            max_retries: Maximum number of retry attempts.
            retry_delay: Delay between retries in seconds.
        """
        self.timeout = timeout
        self.max_retries = max_retries
        self.retry_delay = retry_delay
        self.session = requests.Session()
        self.session.headers.update(self.HEADERS)

    def _make_request(self, url: str) -> Optional[requests.Response]:
        """
        Make HTTP request with retry logic.

        Args:
            url: The URL to request.

        Returns:
            Response object if successful, None otherwise.
        """
        for attempt in range(self.max_retries):
            try:
                response = self.session.get(url, timeout=self.timeout)
                if response.status_code == 200:
                    return response
                elif response.status_code == 403:
                    print(f"Access forbidden (403). Attempt {attempt + 1}/{self.max_retries}")
                elif response.status_code == 429:
                    print(f"Rate limited (429). Waiting longer...")
                    time.sleep(self.retry_delay * (attempt + 2))
                else:
                    print(f"HTTP {response.status_code}. Attempt {attempt + 1}/{self.max_retries}")
            except requests.RequestException as e:
                print(f"Request failed: {e}. Attempt {attempt + 1}/{self.max_retries}")

            if attempt < self.max_retries - 1:
                time.sleep(self.retry_delay * (attempt + 1))

        return None

    def _decode_html_entities(self, text: str) -> str:
        """Decode HTML entities in text."""
        return html.unescape(text)

    def _clean_text(self, text: str) -> str:
        """Clean extracted text from HTML."""
        # Decode HTML entities
        text = self._decode_html_entities(text)
        # Remove extra whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def _extract_title(self, html_content: str) -> str:
        """Extract movie title from the page."""
        # Try to get subtitle (movie name)
        match = re.search(r'data-testid="subtitle"[^>]*>([^<]+)', html_content)
        if match:
            return self._clean_text(match.group(1))

        # Fallback: extract from page title
        match = re.search(r'<title>([^<]+)</title>', html_content)
        if match:
            title_text = match.group(1)
            title_match = re.search(r'^(.+?)\s*\(\d{4}\)', title_text)
            if title_match:
                return self._clean_text(title_match.group(1))
        return ""

    def _extract_content_rating(self, html_content: str) -> str:
        """Extract content rating (MPA rating) from the page."""
        # Find the content-rating section
        section_match = re.search(
            r'data-testid="content-rating".*?Motion Picture Rating.*?'
            r'ipc-html-content-inner-div[^>]*>([^<]+)',
            html_content,
            re.DOTALL
        )
        if section_match:
            return self._clean_text(section_match.group(1))
        return ""

    def _find_section_content(self, html_content: str, section_id: str) -> str:
        """Find the content of a specific section by ID."""
        # Find the section starting from its ID anchor
        pattern = rf'id="{section_id}".*?(?=id="(?:nudity|violence|profanity|alcohol|frightening|certificates)"|$)'
        match = re.search(pattern, html_content, re.DOTALL)
        if match:
            return match.group(0)
        return ""

    def _extract_category_severity(self, html_content: str, section_id: str) -> str:
        """Extract severity level for a category."""
        section_content = self._find_section_content(html_content, section_id)
        if not section_content:
            return ""

        # Find severity in the signpost text
        match = re.search(r'ipc-signpost__text[^>]*>([^<]+)', section_content)
        if match:
            return self._clean_text(match.group(1))
        return ""

    def _extract_category_items(self, html_content: str, section_id: str) -> list[str]:
        """Extract all items for a category."""
        items = []
        section_content = self._find_section_content(html_content, section_id)
        if not section_content:
            return items

        # Find all item-html content divs
        # Pattern: data-testid="item-html" followed by inner-div with content
        pattern = r'data-testid="item-html".*?ipc-html-content-inner-div[^>]*>([^<]+)'
        matches = re.findall(pattern, section_content, re.DOTALL)
        for match in matches:
            text = self._clean_text(match)
            if text:
                items.append(text)

        return items

    def _extract_category(self, html_content: str, section_id: str) -> CategoryInfo:
        """Extract complete information for a category."""
        return CategoryInfo(
            severity=self._extract_category_severity(html_content, section_id),
            items=self._extract_category_items(html_content, section_id),
        )

    def _extract_certifications(self, html_content: str) -> list[CertificationItem]:
        """Extract certifications (country ratings) from the page."""
        certifications = []

        # Find the certificates section (from container to end of section or footer)
        cert_section_match = re.search(
            r'data-testid="certificates-container"(.*?)(?:</section>|<footer)',
            html_content,
            re.DOTALL
        )
        if not cert_section_match:
            return certifications

        cert_section = cert_section_match.group(0)

        # Split by certificates-item to get each country block
        # Use lookahead to keep the delimiter
        country_blocks = re.split(r'(?=data-testid="certificates-item")', cert_section)

        for block in country_blocks:
            if 'certificates-item' not in block:
                continue

            # Extract country name
            country_match = re.search(
                r'ipc-metadata-list-item__label[^>]*>([^<]+)',
                block
            )
            country = self._clean_text(country_match.group(1)) if country_match else ""

            if not country:
                continue

            # Extract all ratings for this country
            ratings = []
            # Pattern to match rating links and optional subtext
            rating_pattern = (
                r'ipc-metadata-list-item__list-content-item--link[^>]*>([^<]+)</a>'
                r'(?:<span class="ipc-metadata-list-item__list-content-item--subText">([^<]*)</span>)?'
            )
            rating_matches = re.findall(rating_pattern, block, re.DOTALL)

            for rating_match in rating_matches:
                rating_text = self._clean_text(rating_match[0])
                note_text = self._clean_text(rating_match[1]) if len(rating_match) > 1 else ""
                if rating_text:
                    ratings.append(CertificationRating(rating=rating_text, note=note_text))

            if ratings:
                certifications.append(CertificationItem(country=country, ratings=ratings))

        return certifications

    def scrape(self, imdb_id: str) -> Optional[ParentalGuide]:
        """
        Scrape parental guide for a movie.

        Args:
            imdb_id: IMDB title ID (e.g., 'tt0111161').

        Returns:
            ParentalGuide object if successful, None otherwise.
        """
        # Normalize IMDB ID format
        if not imdb_id.startswith("tt"):
            imdb_id = f"tt{imdb_id}"

        url = f"{self.BASE_URL}/title/{imdb_id}/parentalguide/"
        print(f"Scraping: {url}")

        response = self._make_request(url)
        if not response:
            print(f"Failed to fetch page for {imdb_id}")
            return None

        html_content = response.text

        guide = ParentalGuide(
            imdb_id=imdb_id,
            url=url,
            title=self._extract_title(html_content),
            content_rating=self._extract_content_rating(html_content),
            sex_nudity=self._extract_category(html_content, self.CATEGORY_IDS["sex_nudity"]),
            violence_gore=self._extract_category(html_content, self.CATEGORY_IDS["violence_gore"]),
            profanity=self._extract_category(html_content, self.CATEGORY_IDS["profanity"]),
            alcohol_drugs_smoking=self._extract_category(html_content, self.CATEGORY_IDS["alcohol_drugs_smoking"]),
            frightening_intense=self._extract_category(html_content, self.CATEGORY_IDS["frightening_intense"]),
            certifications=self._extract_certifications(html_content),
        )

        return guide

    def scrape_from_url(self, url: str) -> Optional[ParentalGuide]:
        """
        Scrape parental guide from a full URL.

        Args:
            url: Full IMDB parental guide URL.

        Returns:
            ParentalGuide object if successful, None otherwise.
        """
        # Extract IMDB ID from URL
        match = re.search(r"/title/(tt\d+)/", url)
        if not match:
            print(f"Invalid IMDB URL: {url}")
            return None

        return self.scrape(match.group(1))


def save_to_json(guide: ParentalGuide, output_path: str) -> None:
    """
    Save parental guide to JSON file.

    Args:
        guide: ParentalGuide object to save.
        output_path: Output file path.
    """
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(guide.to_dict(), f, ensure_ascii=False, indent=2)
    print(f"Saved to: {output_path}")


def main():
    """Main entry point."""
    import argparse
    import os

    parser = argparse.ArgumentParser(description="Scrape IMDB Parental Guide")
    parser.add_argument(
        "imdb_id",
        nargs="?",
        default="tt0111161",
        help="IMDB title ID (e.g., tt0111161) or full URL. Default: tt0111161",
    )
    parser.add_argument(
        "-o", "--output",
        help="Output JSON file path. Default: <imdb_id>_parental_guide.json",
    )
    args = parser.parse_args()

    scraper = IMDBParentalGuideScraper()

    # Determine if input is URL or ID
    if args.imdb_id.startswith("http"):
        guide = scraper.scrape_from_url(args.imdb_id)
    else:
        guide = scraper.scrape(args.imdb_id)

    if guide:
        # Determine output path
        if args.output:
            output_path = args.output
        else:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            output_path = os.path.join(script_dir, f"{guide.imdb_id}_parental_guide.json")

        save_to_json(guide, output_path)

        # Print summary
        print(f"\n{'=' * 50}")
        print(f"Title: {guide.title}")
        print(f"IMDB ID: {guide.imdb_id}")
        print(f"Content Rating: {guide.content_rating}")
        print(f"\nSex & Nudity: {guide.sex_nudity.severity} ({len(guide.sex_nudity.items)} items)")
        print(f"Violence & Gore: {guide.violence_gore.severity} ({len(guide.violence_gore.items)} items)")
        print(f"Profanity: {guide.profanity.severity} ({len(guide.profanity.items)} items)")
        print(f"Alcohol, Drugs & Smoking: {guide.alcohol_drugs_smoking.severity} ({len(guide.alcohol_drugs_smoking.items)} items)")
        print(f"Frightening & Intense: {guide.frightening_intense.severity} ({len(guide.frightening_intense.items)} items)")
        print(f"Certifications: {len(guide.certifications)} countries")
        print(f"{'=' * 50}")
    else:
        print("Failed to scrape parental guide.")
        exit(1)


if __name__ == "__main__":
    main()
