"""Serialize a list of Opportunity objects into a structured, JSON-safe report."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List

from .opportunity import Opportunity

DISCLAIMER = (
    "Ce rapport analyse des discussions publiques sur Reddit (échantillon fixture ou flux RSS bornés). "
    "Le nombre de posts/auteurs Reddit ne constitue en aucun cas une estimation de marché (TAM/SAM/SOM). "
    "Toute taille de marché mentionnée est une hypothèse à valider avec des sources externes."
)


def _market_size_hypotheses(opportunity: Opportunity) -> dict:
    return {
        "note": "Hypothèses non validées, à confirmer avec des sources de marché externes (INSEE, rapports sectoriels, etc.).",
        "tam": "Hypothèse : à définir selon le nombre total d'entreprises/utilisateurs concernés par ce problème.",
        "sam": "Hypothèse : à définir selon le sous-segment atteignable par les canaux de distribution envisagés.",
        "som": "Hypothèse : à définir selon la capacité réaliste de conversion en phase de lancement.",
    }


def _opportunity_to_dict(opportunity: Opportunity) -> dict:
    return {
        "label": opportunity.label,
        "problem_statement": opportunity.problem_statement,
        "confidence": opportunity.confidence,
        "suggested_icp": opportunity.suggested_icp,
        "mvp_idea": opportunity.mvp_idea,
        "validation_steps": list(opportunity.validation_steps),
        "score": {
            "total": opportunity.score.total_score,
            "reasons": list(opportunity.score.reasons),
            "market_evidence_state": opportunity.score.market_evidence_state,
        },
        "evidence": [
            {
                "post_id": e.post_id,
                "author": e.author,
                "subreddit": e.subreddit,
                "url": e.url,
                "excerpt": e.excerpt,
            }
            for e in opportunity.evidence
        ],
        "market_size_hypotheses": _market_size_hypotheses(opportunity),
    }


def build_report_dict(opportunities: List[Opportunity], source_description: str) -> dict:
    return {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_description": source_description,
        "disclaimer": DISCLAIMER,
        "opportunities": [_opportunity_to_dict(o) for o in opportunities],
    }
