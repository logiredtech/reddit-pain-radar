"""Typed domain model for a Reddit-like post."""
from __future__ import annotations

from dataclasses import dataclass

REQUIRED_FIELDS = (
    "id",
    "title",
    "selftext",
    "subreddit",
    "author",
    "score",
    "num_comments",
    "created_utc",
    "url",
)


@dataclass(frozen=True)
class Post:
    id: str
    title: str
    selftext: str
    subreddit: str
    author: str
    score: int
    num_comments: int
    created_utc: int
    url: str

    @staticmethod
    def from_dict(raw: dict) -> "Post":
        missing = [f for f in REQUIRED_FIELDS if f not in raw]
        if missing:
            raise ValueError(f"Post is missing required fields: {missing}")
        return Post(
            id=str(raw["id"]),
            title=str(raw["title"]),
            selftext=str(raw["selftext"]),
            subreddit=str(raw["subreddit"]),
            author=str(raw["author"]),
            score=int(raw["score"]),
            num_comments=int(raw["num_comments"]),
            created_utc=int(raw["created_utc"]),
            url=str(raw["url"]),
        )
