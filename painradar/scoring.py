"""Explainable opportunity scoring for a cluster of posts.

The score is a weighted sum of independently understandable factors. Every factor
contributes a human-readable reason string so the final score is fully auditable.
This score reflects Reddit discussion signal only — it is NOT a market size
estimate and must never be presented as such (see report_html.py TAM/SAM/SOM
disclaimer).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import List

from .clustering import Cluster
from .signals import detect_pain_signals

MAX_SCORE = 100.0

# Weights sum to MAX_SCORE so each factor's contribution is easy to reason about.
WEIGHT_AUTHORS = 25.0
WEIGHT_SUBREDDITS = 15.0
WEIGHT_ENGAGEMENT = 20.0
WEIGHT_DIVERSITY = 20.0
WEIGHT_RECURRENCE = 20.0


@dataclass
class ScoreResult:
    total_score: float
    reasons: List[str] = field(default_factory=list)
    market_evidence_state: str = "faible"


def _saturating(value: float, half_point: float) -> float:
    """Map value in [0, inf) to [0, 1) with diminishing returns, so a handful of
    extra posts/authors doesn't blow the score past what evidence supports."""
    if value <= 0:
        return 0.0
    return value / (value + half_point)


def score_cluster(cluster: Cluster) -> ScoreResult:
    posts = cluster.posts
    reasons: List[str] = []

    authors = {p.author for p in posts}
    subreddits = {p.subreddit for p in posts}
    total_engagement = sum(p.score for p in posts) + sum(p.num_comments for p in posts)
    diversity = set()
    for p in posts:
        diversity |= detect_pain_signals(p.title + " " + p.selftext).matched_categories
    recurrence = len(posts)

    author_factor = _saturating(len(authors), half_point=3)
    subreddit_factor = _saturating(len(subreddits), half_point=2)
    engagement_factor = _saturating(math.log1p(total_engagement), half_point=6)
    diversity_factor = len(diversity) / 5.0
    recurrence_factor = _saturating(recurrence, half_point=3)

    score = (
        author_factor * WEIGHT_AUTHORS
        + subreddit_factor * WEIGHT_SUBREDDITS
        + engagement_factor * WEIGHT_ENGAGEMENT
        + diversity_factor * WEIGHT_DIVERSITY
        + recurrence_factor * WEIGHT_RECURRENCE
    )
    score = max(0.0, min(MAX_SCORE, score))

    reasons.append(f"{len(authors)} auteur(s) indépendant(s) évoquent ce problème.")
    reasons.append(f"Présent dans {len(subreddits)} subreddit(s) différent(s).")
    reasons.append(f"Engagement cumulé (score + commentaires) : {total_engagement}.")
    reasons.append(
        f"{len(diversity)}/5 catégories de signaux de douleur détectées : {', '.join(sorted(diversity)) or 'aucune'}."
    )
    reasons.append(f"{recurrence} post(s) regroupé(s) dans ce cluster (récurrence).")

    if recurrence >= 5 and len(authors) >= 4:
        market_evidence_state = "forte"
    elif recurrence >= 2 and len(authors) >= 2:
        market_evidence_state = "modérée"
    else:
        market_evidence_state = "faible"

    return ScoreResult(total_score=round(score, 1), reasons=reasons, market_evidence_state=market_evidence_state)
