import { Post } from "./models.js";
import { tokenize } from "./textnorm.js";

export const SIMILARITY_THRESHOLD = 0.2;

const CATEGORY_KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  "facturation / paiements": ["invoice", "invoicing", "payment", "billing", "reconcil"],
  "saisie de données manuelle": ["data", "spreadsheet", "excel", "csv", "entry", "dedupe", "contacts"],
  "outils trop chers": ["crm", "tool", "tools", "software", "saas", "dashboard", "analytics"],
  "support client": ["support", "ticket", "helpdesk", "customer"],
  "contenu / marketing": ["newsletter", "social", "marketing", "content", "schedul"],
};

export class Cluster {
  posts: Post[];
  tokenUnion: Set<string>;

  constructor(posts: Post[] = [], tokenUnion: Set<string> = new Set()) {
    this.posts = posts;
    this.tokenUnion = tokenUnion;
  }

  get label(): string {
    let bestCategory = "divers";
    let bestHits = 0;
    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
      const hits = keywords.filter((kw) => [...this.tokenUnion].some((tok) => tok.includes(kw))).length;
      if (hits > bestHits) {
        bestHits = hits;
        bestCategory = category;
      }
    }
    return bestCategory;
  }
}

export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) {
    return 0.0;
  }
  const intersectionSize = [...a].filter((x) => b.has(x)).length;
  const unionSize = new Set([...a, ...b]).size;
  if (unionSize === 0) {
    return 0.0;
  }
  return intersectionSize / unionSize;
}

function postTokens(post: Post): Set<string> {
  return new Set(tokenize(post.title + " " + post.selftext));
}

export function clusterPosts(posts: Post[]): Cluster[] {
  const orderedPosts = [...posts].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const clusters: Cluster[] = [];

  for (const post of orderedPosts) {
    const tokens = postTokens(post);
    let bestCluster: Cluster | null = null;
    let bestScore = 0.0;
    for (const cluster of clusters) {
      const score = jaccardSimilarity(tokens, cluster.tokenUnion);
      if (score >= SIMILARITY_THRESHOLD && score > bestScore) {
        bestScore = score;
        bestCluster = cluster;
      }
    }
    if (bestCluster !== null) {
      bestCluster.posts.push(post);
      tokens.forEach((t) => bestCluster!.tokenUnion.add(t));
    } else {
      clusters.push(new Cluster([post], new Set(tokens)));
    }
  }

  return clusters;
}
