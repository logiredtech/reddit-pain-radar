"""Turn a list of clusters into ranked, explainable business opportunities."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import List

from .clustering import Cluster
from .problem import extract_problem_statement
from .scoring import ScoreResult, score_cluster

EXCERPT_LENGTH = 180


@dataclass
class Evidence:
    post_id: str
    author: str
    subreddit: str
    url: str
    excerpt: str


@dataclass
class Opportunity:
    label: str
    problem_statement: str
    score: ScoreResult
    confidence: str
    suggested_icp: str
    mvp_idea: str
    validation_steps: List[str]
    evidence: List[Evidence] = field(default_factory=list)


def _excerpt(text: str, length: int = EXCERPT_LENGTH) -> str:
    text = " ".join(text.split())
    if len(text) <= length:
        return text
    return text[: length - 1].rsplit(" ", 1)[0] + "…"


def _confidence_from_score(score_result: ScoreResult) -> str:
    if score_result.total_score >= 60:
        return "élevée"
    if score_result.total_score >= 30:
        return "moyenne"
    return "faible"


def _suggested_icp(cluster: Cluster) -> str:
    subreddits = sorted({p.subreddit for p in cluster.posts})
    return f"Utilisateurs actifs sur r/{', r/'.join(subreddits)}, confrontés à ce problème au quotidien."


def _mvp_idea(cluster: Cluster, problem_statement: str) -> str:
    return (
        f"Un outil ciblé et simple qui résout précisément : « {problem_statement} » "
        "— sans les fonctionnalités superflues des suites payantes existantes."
    )


def _validation_steps(cluster: Cluster) -> List[str]:
    return [
        "Interroger 5 à 10 auteurs des posts cités pour valider le problème et le budget disponible.",
        "Publier une landing page décrivant la solution et mesurer les inscriptions à la liste d'attente.",
        "Construire un prototype minimal (MVP) et le tester avec 3 utilisateurs issus des subreddits identifiés.",
        "Vérifier des sources externes (études de marché, données Google Trends) avant tout chiffrage de marché.",
    ]


def build_opportunities(clusters: List[Cluster]) -> List[Opportunity]:
    opportunities: List[Opportunity] = []
    for cluster in clusters:
        posts = cluster.posts
        lead_post = min(posts, key=lambda p: p.id)
        problem_statement = extract_problem_statement(lead_post.title, lead_post.selftext)
        score_result = score_cluster(cluster)

        evidence = [
            Evidence(
                post_id=p.id,
                author=p.author,
                subreddit=p.subreddit,
                url=p.url,
                excerpt=_excerpt(p.selftext or p.title),
            )
            for p in sorted(posts, key=lambda p: p.id)
        ]

        opportunities.append(
            Opportunity(
                label=cluster.label,
                problem_statement=problem_statement,
                score=score_result,
                confidence=_confidence_from_score(score_result),
                suggested_icp=_suggested_icp(cluster),
                mvp_idea=_mvp_idea(cluster, problem_statement),
                validation_steps=_validation_steps(cluster),
                evidence=evidence,
            )
        )

    opportunities.sort(key=lambda o: o.score.total_score, reverse=True)
    return opportunities
