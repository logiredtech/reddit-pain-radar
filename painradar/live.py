"""Bounded, polite, best-effort collection of public Reddit posts via subreddit RSS/Atom feeds.

Design constraints (no bypassing, no scraping tricks):
- a clear, identifiable User-Agent is always sent
- a hard request timeout is always set
- an optional delay is applied between feed requests to avoid hammering the server
- the number of items pulled per feed is capped (max_items)
- HTTP errors (429 rate-limited, 403 forbidden), network errors, and malformed
  XML are all reported back as data, never raised past this module or retried
  in a way that could be seen as evasive.

Only the standard library is used (urllib for HTTP, xml.etree for parsing).
"""
from __future__ import annotations

import time
import urllib.error
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from typing import Dict, List
from urllib.request import Request, urlopen

from .models import Post

FEED_URL_TEMPLATE = "https://www.reddit.com/r/{subreddit}/.rss"

ATOM_NS = {"atom": "http://www.w3.org/2005/Atom"}


@dataclass
class FeedResult:
    ok: bool
    posts: List[Post] = field(default_factory=list)
    error: str = ""


@dataclass
class LiveCollectionResult:
    posts: List[Post] = field(default_factory=list)
    errors: Dict[str, str] = field(default_factory=dict)


def _strip_author_prefix(raw_author: str) -> str:
    return raw_author.replace("/u/", "").strip()


def _parse_atom(root: ET.Element, subreddit: str, max_items: int) -> List[Post]:
    posts: List[Post] = []
    for entry in root.findall("atom:entry", ATOM_NS)[:max_items]:
        entry_id = entry.findtext("atom:id", default="", namespaces=ATOM_NS) or ""
        title = entry.findtext("atom:title", default="", namespaces=ATOM_NS) or ""
        content = entry.findtext("atom:content", default="", namespaces=ATOM_NS) or ""
        author = entry.findtext("atom:author/atom:name", default="", namespaces=ATOM_NS) or ""
        link_el = entry.find("atom:link", ATOM_NS)
        url = link_el.get("href") if link_el is not None else ""
        posts.append(
            Post(
                id=entry_id or url,
                title=title.strip(),
                selftext=content.strip(),
                subreddit=subreddit,
                author=_strip_author_prefix(author),
                score=0,
                num_comments=0,
                created_utc=0,
                url=url,
            )
        )
    return posts


def _parse_rss(root: ET.Element, subreddit: str, max_items: int) -> List[Post]:
    posts: List[Post] = []
    channel = root.find("channel")
    items = channel.findall("item") if channel is not None else []
    for item in items[:max_items]:
        title = item.findtext("title", default="") or ""
        description = item.findtext("description", default="") or ""
        author = item.findtext("author", default="") or ""
        link = item.findtext("link", default="") or ""
        guid = item.findtext("guid", default="") or ""
        posts.append(
            Post(
                id=guid or link,
                title=title.strip(),
                selftext=description.strip(),
                subreddit=subreddit,
                author=_strip_author_prefix(author),
                score=0,
                num_comments=0,
                created_utc=0,
                url=link,
            )
        )
    return posts


def fetch_subreddit_feed(subreddit: str, user_agent: str, timeout: float, max_items: int) -> FeedResult:
    """Fetch and parse one subreddit's public RSS/Atom feed. Never raises: all
    failure modes are reported through FeedResult.error in French."""
    url = FEED_URL_TEMPLATE.format(subreddit=subreddit)
    request = Request(url, headers={"User-Agent": user_agent})

    try:
        with urlopen(request, timeout=timeout) as response:
            raw = response.read()
    except urllib.error.HTTPError as exc:
        if exc.code == 429:
            return FeedResult(ok=False, error=f"Erreur HTTP 429 (trop de requêtes) pour r/{subreddit}, réessayez plus tard.")
        if exc.code == 403:
            return FeedResult(ok=False, error=f"Erreur HTTP 403 (accès refusé) pour r/{subreddit}.")
        return FeedResult(ok=False, error=f"Erreur HTTP {exc.code} pour r/{subreddit}.")
    except urllib.error.URLError as exc:
        return FeedResult(ok=False, error=f"Erreur réseau pour r/{subreddit} : {exc.reason}")

    try:
        root = ET.fromstring(raw)
    except ET.ParseError as exc:
        return FeedResult(ok=False, error=f"Flux invalide (XML non parseable) pour r/{subreddit} : {exc}")

    tag = root.tag.lower()
    if tag.endswith("feed"):
        posts = _parse_atom(root, subreddit, max_items)
    elif tag.endswith("rss"):
        posts = _parse_rss(root, subreddit, max_items)
    else:
        return FeedResult(ok=False, error=f"Flux invalide (format non reconnu) pour r/{subreddit}.")

    return FeedResult(ok=True, posts=posts)


def collect_live_posts(
    subreddits: List[str],
    user_agent: str,
    timeout: float,
    max_items_per_feed: int,
    delay_seconds: float,
) -> LiveCollectionResult:
    """Bounded collection across several subreddits: applies `delay_seconds` between
    requests (politeness) and keeps going even if one feed fails."""
    result = LiveCollectionResult()
    for index, subreddit in enumerate(subreddits):
        if index > 0 and delay_seconds > 0:
            time.sleep(delay_seconds)
        feed_result = fetch_subreddit_feed(subreddit, user_agent=user_agent, timeout=timeout, max_items=max_items_per_feed)
        if feed_result.ok:
            result.posts.extend(feed_result.posts)
        else:
            result.errors[subreddit] = feed_result.error
    return result
