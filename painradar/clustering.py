"""Deterministic clustering of similar posts using token-set Jaccard similarity.

No ML/embeddings involved: clusters are formed greedily in a fixed order (post id),
so the same input always produces the same clusters.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Set

from .models import Post
from .textnorm import tokenize

SIMILARITY_THRESHOLD = 0.2

# Coarse category keywords used only to give clusters a human-readable label; this is
# NOT the clustering mechanism itself (that's pure Jaccard similarity on tokens).
CATEGORY_KEYWORDS: Dict[str, List[str]] = {
    "facturation / paiements": ["invoice", "invoicing", "payment", "billing", "reconcil"],
    "saisie de données manuelle": ["data", "spreadsheet", "excel", "csv", "entry", "dedupe", "contacts"],
    "outils trop chers": ["crm", "tool", "tools", "software", "saas", "dashboard", "analytics"],
    "support client": ["support", "ticket", "helpdesk", "customer"],
    "contenu / marketing": ["newsletter", "social", "marketing", "content", "schedul"],
}


@dataclass
class Cluster:
    posts: List[Post] = field(default_factory=list)
    token_union: Set[str] = field(default_factory=set)

    @property
    def label(self) -> str:
        best_category = "divers"
        best_hits = 0
        for category, keywords in CATEGORY_KEYWORDS.items():
            hits = sum(1 for kw in keywords if any(kw in tok for tok in self.token_union))
            if hits > best_hits:
                best_hits = hits
                best_category = category
        return best_category


def jaccard_similarity(a: Set[str], b: Set[str]) -> float:
    if not a and not b:
        return 0.0
    intersection = a & b
    union = a | b
    if not union:
        return 0.0
    return len(intersection) / len(union)


def _post_tokens(post: Post) -> Set[str]:
    return set(tokenize(post.title + " " + post.selftext))


def cluster_posts(posts: List[Post]) -> List[Cluster]:
    """Greedy, order-stable clustering: iterate posts sorted by id, attach each post
    to the first existing cluster whose token union is similar enough, else start a
    new cluster."""
    ordered_posts = sorted(posts, key=lambda p: p.id)
    clusters: List[Cluster] = []

    for post in ordered_posts:
        tokens = _post_tokens(post)
        best_cluster = None
        best_score = 0.0
        for cluster in clusters:
            score = jaccard_similarity(tokens, cluster.token_union)
            if score >= SIMILARITY_THRESHOLD and score > best_score:
                best_score = score
                best_cluster = cluster
        if best_cluster is not None:
            best_cluster.posts.append(post)
            best_cluster.token_union |= tokens
        else:
            clusters.append(Cluster(posts=[post], token_union=set(tokens)))

    return clusters
