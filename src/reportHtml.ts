import { Opportunity } from "./opportunity.js";
import { ScoreResult } from "./scoring.js";

const DISCLAIMER =
  "Ce rapport analyse des discussions publiques sur Reddit (échantillon fixture ou API OAuth bornée). " +
  "Le nombre de posts/auteurs Reddit ne constitue en aucun cas une estimation de marché (TAM/SAM/SOM). " +
  "Toute taille de marché mentionnée ci-dessous est une hypothèse à valider avec des sources externes.";

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

function safeHref(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return escapeHtml(url);
    }
  } catch {
    // fall through: not a parseable absolute URL
  }
  return "#";
}

function confidenceClass(confidence: string): string {
  const mapping: Record<string, string> = {
    élevée: "confidence-high",
    moyenne: "confidence-medium",
    faible: "confidence-low",
  };
  return mapping[confidence] ?? "confidence-low";
}

function renderEvidence(opportunity: Opportunity): string {
  const items = opportunity.evidence.map(
    (ev) =>
      `<li class="evidence-item">` +
      `<a href="${safeHref(ev.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(ev.url)}</a> ` +
      `— <span class="evidence-meta">u/${escapeHtml(ev.author)} · r/${escapeHtml(ev.subreddit)}</span>` +
      `<blockquote>${escapeHtml(ev.excerpt)}</blockquote>` +
      `</li>`,
  );
  return `<ul class="evidence-list">${items.join("")}</ul>`;
}

function renderReasons(reasons: string[]): string {
  return `<ul class="reasons-list">${reasons.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ul>`;
}

function renderValidationSteps(steps: string[]): string {
  return `<ol class="validation-steps">${steps.map((s) => `<li>${escapeHtml(s)}</li>`).join("")}</ol>`;
}

function renderOpportunityCard(opportunity: Opportunity, rank: number): string {
  const score: ScoreResult = opportunity.score;
  return `
    <article class="opportunity-card">
      <header>
        <h2>#${rank} — ${escapeHtml(opportunity.label)}</h2>
        <div class="score-badge">Score : ${score.totalScore}/100</div>
        <div class="confidence ${confidenceClass(opportunity.confidence)}">Confiance : ${escapeHtml(opportunity.confidence)}</div>
        <div class="market-evidence">Preuve de marché (Reddit) : ${escapeHtml(score.marketEvidenceState)}</div>
      </header>

      <section>
        <h3>Énoncé du problème</h3>
        <p class="problem-statement">${escapeHtml(opportunity.problemStatement)}</p>
      </section>

      <section>
        <h3>Pourquoi ce score ?</h3>
        ${renderReasons(score.reasons)}
      </section>

      <section>
        <h3>Preuves / extraits</h3>
        ${renderEvidence(opportunity)}
      </section>

      <section>
        <h3>ICP suggéré</h3>
        <p>${escapeHtml(opportunity.suggestedIcp)}</p>
      </section>

      <section>
        <h3>Idée de MVP</h3>
        <p>${escapeHtml(opportunity.mvpIdea)}</p>
      </section>

      <section>
        <h3>Étapes de validation</h3>
        ${renderValidationSteps(opportunity.validationSteps)}
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
    `;
}

const STYLE = `
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
`;

export function renderHtmlReport(opportunities: Opportunity[], sourceDescription: string): string {
  const generatedAt = new Date().toISOString();
  const cards = opportunities.map((o, i) => renderOpportunityCard(o, i + 1)).join("");

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>Reddit Pain Radar — Rapport d'opportunités</title>
<style>${STYLE}</style>
</head>
<body>
  <h1>Reddit Pain Radar — Rapport d'Opportunités</h1>
  <p>Généré le ${escapeHtml(generatedAt)} — Source : ${escapeHtml(sourceDescription)}</p>
  <div class="disclaimer">
    <strong>Avertissement</strong> : ${escapeHtml(DISCLAIMER)}
  </div>
  ${opportunities.length > 0 ? cards : "<p>Aucune opportunité détectée dans ce jeu de données.</p>"}
  <footer>
    Reddit Pain Radar — proof of concept, données synthétiques ou publiques uniquement, API Reddit officielle en mode application-only.
  </footer>
</body>
</html>
`;
}
