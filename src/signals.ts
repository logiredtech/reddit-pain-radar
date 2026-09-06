import { normalizeText } from "./textnorm.js";

export const PAIN_CATEGORIES: Readonly<Record<string, readonly string[]>> = {
  manual_work: [
    "\\bmanually\\b",
    "\\bmanual work\\b",
    "\\bmanual process\\b",
    "\\bby hand\\b",
    "\\bcopy[- ]?paste\\b",
    "\\bevery (week|day|single day)\\b.*\\b(manual|copy|type|enter)\\w*\\b",
    "\\brepetitive\\b",
  ],
  expensive_tools: [
    "\\btoo expensive\\b",
    "\\bexpensive\\b",
    "\\bcost(s|ing)? too much\\b",
    "\\b(way )?overpriced\\b",
    "\\benterprise[- ]priced\\b",
    "\\$\\d+\\s*/?\\s*(month|mo|year)\\b",
  ],
  missing_solution: [
    "\\bno (good )?solution\\b",
    "\\bno affordable\\b",
    "\\bmissing solution\\b",
    "\\bdoesn'?t exist\\b",
    "\\bnothing (out there|exists)\\b",
    "\\bcan'?t find (a|any) (tool|solution)\\b",
  ],
  frustration: [
    "\\bfrustrat\\w*\\b",
    "\\bexhaust\\w*\\b",
    "\\bdraining\\b",
    "\\bso (tired|sick) of\\b",
    "\\bkilling me\\b",
    "\\bdestroying my\\b",
  ],
  willingness_to_pay: [
    "\\bwould pay\\b",
    "\\bwilling to pay\\b",
    "\\bi'?d pay\\b",
    "\\bhappily pay\\b",
    "\\bpay for (a|any|something)\\b",
    "\\btake my money\\b",
  ],
};

const COMPILED: Record<string, RegExp[]> = Object.fromEntries(
  Object.entries(PAIN_CATEGORIES).map(([category, patterns]) => [
    category,
    patterns.map((p) => new RegExp(p)),
  ]),
);

export class PainSignalResult {
  matchedCategories: Set<string> = new Set();
  matchedPhrases: Record<string, string[]> = {};

  get diversityScore(): number {
    return this.matchedCategories.size;
  }
}

export function detectPainSignals(text: string): PainSignalResult {
  const normalized = normalizeText(text);
  const result = new PainSignalResult();
  for (const [category, patterns] of Object.entries(COMPILED)) {
    const matches = patterns.filter((p) => p.test(normalized)).map((p) => p.source);
    if (matches.length > 0) {
      result.matchedCategories.add(category);
      result.matchedPhrases[category] = matches;
    }
  }
  return result;
}
