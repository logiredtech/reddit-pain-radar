"""Offline ingestion of a JSON fixture of Reddit-like posts."""
from __future__ import annotations

import json
from typing import List

from .models import Post


class IngestError(Exception):
    """Raised when a fixture file cannot be read or does not contain valid posts."""


def load_posts_from_fixture(path: str) -> List[Post]:
    try:
        with open(path, "r", encoding="utf-8") as f:
            raw_items = json.load(f)
    except FileNotFoundError as exc:
        raise IngestError(f"Fixture file not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise IngestError(f"Fixture file is not valid JSON: {path} ({exc})") from exc

    if not isinstance(raw_items, list):
        raise IngestError(f"Fixture file must contain a JSON list of posts: {path}")

    posts: List[Post] = []
    for index, raw in enumerate(raw_items):
        try:
            posts.append(Post.from_dict(raw))
        except (ValueError, TypeError) as exc:
            raise IngestError(f"Invalid post at index {index} in {path}: {exc}") from exc
    return posts
