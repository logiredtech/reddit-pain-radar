import { Cluster } from "./clustering.js";
import { detectPainSignals } from "./signals.js";

export const MAX_SCORE = 100.0;

const WEIGHT_AUTHORS = 25.0;
const WEIGHT_SUBREDDITS = 15.0;
const WEIGHT_ENGAGEMENT = 20.0;
const WEIGHT_DIVERSITY = 20.0;
const WEIGHT_RECURRENCE = 20.0;

export interface ScoreResult {
  totalScore: number;
  reasons: string[];
  marketEvidenceState: string;
}

function saturating(value: number, halfPoint: number): number {
  if (value <= 0) {
    return 0.0;
  }
  return value / (value + halfPoint);
}

export function scoreCluster(cluster: Cluster): ScoreResult {
  const posts = cluster.posts;
  const reasons: string[] = [];

  const authors = new Set(posts.map((p) => p.author));
  const subreddits = new Set(posts.map((p) => p.subreddit));
  const totalEngagement = posts.reduce(
    (sum, p) => sum + Math.max(0, p.score) + Math.max(0, p.num_comments),
    0,
  );
  const diversity = new Set<string>();
  for (const p of posts) {
    detectPainSignals(p.title + " " + p.selftext).matchedCategories.forEach((c) => diversity.add(c));
  }
  const recurrence = posts.length;

  const authorFactor = saturating(authors.size, 3);
  const subredditFactor = saturating(subreddits.size, 2);
  const engagementFactor = saturating(Math.log1p(totalEngagement), 6);
  const diversityFactor = diversity.size / 5.0;
  const recurrenceFactor = saturating(recurrence, 3);

  let score =
    authorFactor * WEIGHT_AUTHORS +
    subredditFactor * WEIGHT_SUBREDDITS +
    engagementFactor * WEIGHT_ENGAGEMENT +
    diversityFactor * WEIGHT_DIVERSITY +
    recurrenceFactor * WEIGHT_RECURRENCE;
  score = Math.max(0.0, Math.min(MAX_SCORE, score));

  reasons.push(`${authors.size} auteur(s) indépendant(s) évoquent ce problème.`);
  reasons.push(`Présent dans ${subreddits.size} subreddit(s) différent(s).`);
  reasons.push(`Engagement cumulé (score + commentaires) : ${totalEngagement}.`);
  reasons.push(
    `${diversity.size}/5 catégories de signaux de douleur détectées : ${[...diversity].sort().join(", ") || "aucune"}.`,
  );
  reasons.push(`${recurrence} post(s) regroupé(s) dans ce cluster (récurrence).`);

  let marketEvidenceState: string;
  if (recurrence >= 5 && authors.size >= 4) {
    marketEvidenceState = "forte";
  } else if (recurrence >= 2 && authors.size >= 2) {
    marketEvidenceState = "modérée";
  } else {
    marketEvidenceState = "faible";
  }

  return {
    totalScore: Math.round(score * 10) / 10,
    reasons,
    marketEvidenceState,
  };
}
