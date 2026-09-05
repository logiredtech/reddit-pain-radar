"""Transparent, rule-based pain signal detection.

Detection is purely phrase/pattern based (no ML, no external calls) so that every
match can be explained back to the user with the exact phrase that triggered it.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, List, Set

from .textnorm import normalize_text

# Each category maps to a list of regex patterns (already lowercase, matched against
# normalized text). Patterns are intentionally simple and readable so the rules stay
# auditable by a human.
PAIN_CATEGORIES: Dict[str, List[str]] = {
    "manual_work": [
        r"\bmanually\b",
        r"\bmanual work\b",
        r"\bmanual process\b",
        r"\bby hand\b",
        r"\bcopy[- ]?paste\b",
        r"\bevery (week|day|single day)\b.*\b(manual|copy|type|enter)\w*\b",
        r"\brepetitive\b",
    ],
    "expensive_tools": [
        r"\btoo expensive\b",
        r"\bexpensive\b",
        r"\bcost(s|ing)? too much\b",
        r"\b(way )?overpriced\b",
        r"\benterprise[- ]priced\b",
        r"\$\d+\s*/?\s*(month|mo|year)\b",
    ],
    "missing_solution": [
        r"\bno (good )?solution\b",
        r"\bno affordable\b",
        r"\bmissing solution\b",
        r"\bdoesn'?t exist\b",
        r"\bnothing (out there|exists)\b",
        r"\bcan'?t find (a|any) (tool|solution)\b",
    ],
    "frustration": [
        r"\bfrustrat\w*\b",
        r"\bexhaust\w*\b",
        r"\bdraining\b",
        r"\bso (tired|sick) of\b",
        r"\bkilling me\b",
        r"\bdestroying my\b",
    ],
    "willingness_to_pay": [
        r"\bwould pay\b",
        r"\bwilling to pay\b",
        r"\bi'?d pay\b",
        r"\bhappily pay\b",
        r"\bpay for (a|any|something)\b",
        r"\btake my money\b",
    ],
}

_COMPILED: Dict[str, List[re.Pattern]] = {
    category: [re.compile(p) for p in patterns]
    for category, patterns in PAIN_CATEGORIES.items()
}


@dataclass
class PainSignalResult:
    matched_categories: Set[str] = field(default_factory=set)
    matched_phrases: Dict[str, List[str]] = field(default_factory=dict)

    @property
    def diversity_score(self) -> int:
        return len(self.matched_categories)


def detect_pain_signals(text: str) -> PainSignalResult:
    normalized = normalize_text(text)
    result = PainSignalResult()
    for category, patterns in _COMPILED.items():
        matches = [p.pattern for p in patterns if p.search(normalized)]
        if matches:
            result.matched_categories.add(category)
            result.matched_phrases[category] = matches
    return result
