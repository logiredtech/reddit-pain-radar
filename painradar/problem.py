"""Extract a concise problem statement out of a post's title and body."""
from __future__ import annotations

import re

from .signals import detect_pain_signals

_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?])\s+")
MAX_LENGTH = 220


def _split_sentences(text: str) -> list[str]:
    text = text.strip()
    if not text:
        return []
    return [s.strip() for s in _SENTENCE_SPLIT_RE.split(text) if s.strip()]


def _truncate(text: str, max_length: int = MAX_LENGTH) -> str:
    if len(text) <= max_length:
        return text
    return text[: max_length - 1].rsplit(" ", 1)[0] + "…"


def extract_problem_statement(title: str, selftext: str) -> str:
    """Pick the most informative sentence describing the pain, defaulting to the title."""
    for sentence in _split_sentences(selftext):
        if detect_pain_signals(sentence).matched_categories:
            return _truncate(sentence)
    return _truncate(title.strip())
