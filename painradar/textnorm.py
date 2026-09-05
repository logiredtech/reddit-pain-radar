"""Lightweight text normalization used before pain-signal detection and clustering."""
from __future__ import annotations

import re

_URL_RE = re.compile(r"https?://\S+")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    text = _URL_RE.sub("", text)
    text = text.lower()
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()


_TOKEN_RE = re.compile(r"[a-z0-9']+")

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
    "been", "being", "to", "of", "in", "on", "for", "with", "that", "this",
    "it", "i", "we", "you", "they", "my", "our", "your", "at", "as", "so",
    "do", "does", "did", "have", "has", "had", "not", "no", "if", "than",
    "then", "there", "here", "just", "very", "really", "would", "could",
    "can", "will", "all", "every", "some", "any", "into", "out", "up",
    "about", "from", "by", "because", "between", "anyone", "found",
    "which", "way", "too", "such", "something", "without", "exists",
    "existing", "huge", "me", "go", "two", "person", "anything",
    "immediately", "actually", "even", "get", "gets", "getting", "new",
    "one", "own", "still", "much", "already", "again", "back",
}


def tokenize(text: str) -> list[str]:
    """Normalize then split into meaningful lowercase tokens, dropping stopwords."""
    normalized = normalize_text(text)
    tokens = _TOKEN_RE.findall(normalized)
    return [t for t in tokens if t not in STOPWORDS and len(t) > 1]
