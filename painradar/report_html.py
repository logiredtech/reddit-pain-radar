"""Render a standalone, French-language HTML report from a list of Opportunity objects.

Every piece of untrusted content (post excerpts, authors, subreddits, URLs) goes
through `html.escape` before being embedded in the page. Nothing here uses raw
string interpolation of user-controlled text into HTML.
"""
from __future__ import annotations

from datetime import datetime, timezone
from html import escape
from typing import List
from urllib.parse import urlparse

from .opportunity import Opportunity

DISCLAIMER = (
    "Ce rapport analyse des discussions publiques sur Reddit (échantillon fixture ou flux RSS bornés). "
    "Le nombre de posts/auteurs Reddit ne constitue en aucun cas une estimation de marché (TAM/SAM/SOM). "
    "Toute taille de marché mentionnée ci-dessous est une hypothèse à valider avec des sources externes."
)


def _e(value: object) -> str:
    """Escape any value for safe inclusion in HTML text content or attributes."""
    return escape(str(value), quote=True)


def _safe_href(url: str) -> str:
    """Only allow http(s) URLs as hrefs; anything else (javascript:, data:, ...) is neutralized."""
    parsed = urlparse(url)
    if parsed.scheme in ("http", "https"):
        return _e(url)
    return "#"


def _confidence_class(confidence: str) -> str:
    return {"élevée": "confidence-high", "moyenne": "confidence-medium", "faible": "confidence-low"}.get(
        confidence, "confidence-low"
    )


def _render_evidence(opportunity: Opportunity) -> str:
    items = []
    for ev in opportunity.evidence:
        items.append(
            "<li class=\"evidence-item\">"
            f"<a href=\"{_safe_href(ev.url)}\" target=\"_blank\" rel=\"noopener noreferrer\">{_e(ev.url)}</a> "
            f"— <span class=\"evidence-meta\">u/{_e(ev.author)} · r/{_e(ev.subreddit)}</span>"
            f"<blockquote>{_e(ev.excerpt)}</blockquote>"
            "</li>"
        )
    return "<ul class=\"evidence-list\">" + "".join(items) + "</ul>"


def _render_reasons(reasons: List[str]) -> str:
    return "<ul class=\"reasons-list\">" + "".join(f"<li>{_e(r)}</li>" for r in reasons) + "</ul>"


def _render_validation_steps(steps: List[str]) -> str:
    return "<ol class=\"validation-steps\">" + "".join(f"<li>{_e(s)}</li>" for s in steps) + "</ol>"


def _render_opportunity_card(opportunity: Opportunity, rank: int) -> str:
    score = opportunity.score
    return f"""
    <article class="opportunity-card">
      <header>
        <h2>#{rank} — {_e(opportunity.label)}</h2>
        <div class="score-badge">Score : {score.total_score}/100</div>
        <div class="confidence {_confidence_class(opportunity.confidence)}">Confiance : {_e(opportunity.confidence)}</div>
        <div class="market-evidence">Preuve de marché (Reddit) : {_e(score.market_evidence_state)}</div>
      </header>

      <section>
        <h3>Énoncé du problème</h3>
        <p class="problem-statement">{_e(opportunity.problem_statement)}</p>
      </section>

      <section>
        <h3>Pourquoi ce score ?</h3>
        {_render_reasons(score.reasons)}
      </section>

      <section>
        <h3>Preuves / extraits</h3>
        {_render_evidence(opportunity)}
      </section>

      <section>
        <h3>ICP suggéré</h3>
        <p>{_e(opportunity.suggested_icp)}</p>
      </section>

      <section>
        <h3>Idée de MVP</h3>
        <p>{_e(opportunity.mvp_idea)}</p>
      </section>

      <section>
        <h3>Étapes de validation</h3>
        {_render_validation_steps(opportunity.validation_steps)}
      </section>

      <section class="tam-sam-som">
        <h3>TAM / SAM / SOM (hypothèses — à valider)</h3>
        <p class="hypothesis-warning">
          ⚠️ Ces chiffres sont des <strong>hypothèses de travail</strong>, pas des estimations fiables.
          Le volume de discussions Reddit ne mesure pas la taille d'un marché : validez avec des sources
          externes (études sectorielles, INSEE, enquêtes utilisateurs) avant toute décision d'investissement.
        </p>
        <ul>
          <li><strong>TAM (hypothèse)</strong> : à définir selon le nombre total d'entreprises/utilisateurs concernés.</li>
          <li><strong>SAM (hypothèse)</strong> : à définir selon le sous-segment atteignable par vos canaux.</li>
          <li><strong>SOM (hypothèse)</strong> : à définir selon votre capacité réaliste de conversion au lancement.</li>
        </ul>
      </section>
    </article>
    """


_STYLE = """
    body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 920px; margin: 0 auto; padding: 2rem 1.5rem 4rem; color: #1a1a2e; background: #f7f7fb; }
    h1 { font-size: 1.8rem; }
    .disclaimer { background: #fff3cd; border: 1px solid #ffe08a; padding: 1rem; border-radius: 8px; margin-bottom: 2rem; }
    .opportunity-card { background: #fff; border: 1px solid #e2e2ee; border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
    .opportunity-card header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; margin-bottom: 1rem; }
    .opportunity-card h2 { flex: 1 1 100%; margin: 0 0 0.25rem; }
    .score-badge { background: #4338ca; color: white; padding: 0.25rem 0.6rem; border-radius: 999px; font-weight: 600; font-size: 0.85rem; }
    .confidence { padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.85rem; font-weight: 600; }
    .confidence-high { background: #d1fae5; color: #065f46; }
    .confidence-medium { background: #fef3c7; color: #92400e; }
    .confidence-low { background: #fee2e2; color: #991b1b; }
    .market-evidence { font-size: 0.85rem; color: #555; }
    .problem-statement { font-style: italic; font-size: 1.05rem; }
    .evidence-list { list-style: none; padding: 0; }
    .evidence-item { border-left: 3px solid #4338ca; padding-left: 0.75rem; margin-bottom: 0.75rem; }
    .evidence-meta { color: #666; font-size: 0.85rem; }
    blockquote { margin: 0.35rem 0 0; color: #333; }
    .hypothesis-warning { background: #fff3cd; padding: 0.75rem; border-radius: 8px; }
    footer { margin-top: 3rem; font-size: 0.8rem; color: #666; text-align: center; }
"""


def render_html_report(opportunities: List[Opportunity], source_description: str) -> str:
    generated_at = datetime.now(timezone.utc).isoformat()
    cards = "".join(_render_opportunity_card(o, i + 1) for i, o in enumerate(opportunities))

    return f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Reddit Pain Radar — Rapport d'opportunités</title>
<style>{_STYLE}</style>
</head>
<body>
  <h1>Reddit Pain Radar — Rapport d'Opportunités</h1>
  <p>Généré le {_e(generated_at)} — Source : {_e(source_description)}</p>
  <div class="disclaimer">
    <strong>Avertissement</strong> : {_e(DISCLAIMER)}
  </div>
  {cards if opportunities else '<p>Aucune opportunité détectée dans ce jeu de données.</p>'}
  <footer>
    Reddit Pain Radar — proof of concept, données synthétiques ou publiques uniquement, aucune clé API requise.
  </footer>
</body>
</html>
"""
