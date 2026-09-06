import { clusterPosts } from "./clustering.js";
import { Post } from "./models.js";
import { buildOpportunities } from "./opportunity.js";
import { renderHtmlReport } from "./reportHtml.js";
import { buildReportDict } from "./reportJson.js";
import { detectPainSignals } from "./signals.js";

export interface PipelineResult {
  reportDict: Record<string, unknown>;
  html: string;
}

export function runPipeline(posts: Post[], sourceDescription: string): PipelineResult {
  const painPosts = posts.filter(
    (post) => detectPainSignals(`${post.title}\n${post.selftext}`).matchedCategories.size > 0,
  );
  const clusters = clusterPosts(painPosts);
  const opportunities = buildOpportunities(clusters);
  const reportDict = buildReportDict(opportunities, sourceDescription);
  const html = renderHtmlReport(opportunities, sourceDescription);
  return { reportDict, html };
}
