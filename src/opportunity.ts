import { Cluster } from "./clustering.js";
import { extractProblemStatement } from "./problem.js";
import { ScoreResult, scoreCluster } from "./scoring.js";

const EXCERPT_LENGTH = 180;

export interface Evidence {
  postId: string;
  author: string;
  subreddit: string;
  url: string;
  excerpt: string;
}

export interface Opportunity {
  label: string;
  problemStatement: string;
  score: ScoreResult;
  confidence: string;
  suggestedIcp: string;
  mvpIdea: string;
  validationSteps: string[];
  evidence: Evidence[];
}

function excerpt(text: string, length: number = EXCERPT_LENGTH): string {
  const collapsed = text.split(/\s+/).filter(Boolean).join(" ");
  if (collapsed.length <= length) {
    return collapsed;
  }
  const cut = collapsed.slice(0, length - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= 0 ? cut.slice(0, lastSpace) : cut;
  return base + "…";
}

function confidenceFromScore(scoreResult: ScoreResult): string {
  if (scoreResult.totalScore >= 60) {
    return "élevée";
  }
  if (scoreResult.totalScore >= 30) {
    return "moyenne";
  }
  return "faible";
}

function suggestedIcp(cluster: Cluster): string {
  const subreddits = [...new Set(cluster.posts.map((p) => p.subreddit))].sort();
  return `Utilisateurs actifs sur r/${subreddits.join(", r/")}, confrontés à ce problème au quotidien.`;
}

function mvpIdea(problemStatement: string): string {
  return (
    `Un outil ciblé et simple qui résout précisément : « ${problemStatement} » ` +
    "— sans les fonctionnalités superflues des suites payantes existantes."
  );
}

function validationSteps(): string[] {
  return [
    "Interroger 5 à 10 auteurs des posts cités pour valider le problème et le budget disponible.",
    "Publier une landing page décrivant la solution et mesurer les inscriptions à la liste d'attente.",
    "Construire un prototype minimal (MVP) et le tester avec 3 utilisateurs issus des subreddits identifiés.",
    "Vérifier des sources externes (études de marché, données Google Trends) avant tout chiffrage de marché.",
  ];
}

function byId<T extends { id: string }>(a: T, b: T): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildOpportunities(clusters: Cluster[]): Opportunity[] {
  const opportunities: Opportunity[] = [];
  for (const cluster of clusters) {
    const posts = cluster.posts;
    const leadPost = [...posts].sort(byId)[0]!;
    const problemStatement = extractProblemStatement(leadPost.title, leadPost.selftext);
    const scoreResult = scoreCluster(cluster);

    const evidence: Evidence[] = [...posts].sort(byId).map((p) => ({
      postId: p.id,
      author: p.author,
      subreddit: p.subreddit,
      url: p.url,
      excerpt: excerpt(p.selftext || p.title),
    }));

    opportunities.push({
      label: cluster.label,
      problemStatement,
      score: scoreResult,
      confidence: confidenceFromScore(scoreResult),
      suggestedIcp: suggestedIcp(cluster),
      mvpIdea: mvpIdea(problemStatement),
      validationSteps: validationSteps(),
      evidence,
    });
  }

  opportunities.sort((a, b) => b.score.totalScore - a.score.totalScore);
  return opportunities;
}
