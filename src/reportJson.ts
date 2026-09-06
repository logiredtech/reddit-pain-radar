import { Opportunity } from "./opportunity.js";

export const DISCLAIMER =
  "Ce rapport analyse des discussions publiques sur Reddit (échantillon fixture ou API OAuth bornée). " +
  "Le nombre de posts/auteurs Reddit ne constitue en aucun cas une estimation de marché (TAM/SAM/SOM). " +
  "Toute taille de marché mentionnée est une hypothèse à valider avec des sources externes.";

function marketSizeHypotheses(): Record<string, string> {
  return {
    note: "Hypothèses non validées, à confirmer avec des sources de marché externes (INSEE, rapports sectoriels, etc.).",
    tam: "Hypothèse : à définir selon le nombre total d'entreprises/utilisateurs concernés par ce problème.",
    sam: "Hypothèse : à définir selon le sous-segment atteignable par les canaux de distribution envisagés.",
    som: "Hypothèse : à définir selon la capacité réaliste de conversion en phase de lancement.",
  };
}

function opportunityToDict(opportunity: Opportunity): Record<string, unknown> {
  return {
    label: opportunity.label,
    problem_statement: opportunity.problemStatement,
    confidence: opportunity.confidence,
    suggested_icp: opportunity.suggestedIcp,
    mvp_idea: opportunity.mvpIdea,
    validation_steps: [...opportunity.validationSteps],
    score: {
      total: opportunity.score.totalScore,
      reasons: [...opportunity.score.reasons],
      market_evidence_state: opportunity.score.marketEvidenceState,
    },
    evidence: opportunity.evidence.map((e) => ({
      post_id: e.postId,
      author: e.author,
      subreddit: e.subreddit,
      url: e.url,
      excerpt: e.excerpt,
    })),
    market_size_hypotheses: marketSizeHypotheses(),
  };
}

export function buildReportDict(opportunities: Opportunity[], sourceDescription: string): Record<string, unknown> {
  return {
    generated_at: new Date().toISOString(),
    source_description: sourceDescription,
    disclaimer: DISCLAIMER,
    opportunities: opportunities.map(opportunityToDict),
  };
}
