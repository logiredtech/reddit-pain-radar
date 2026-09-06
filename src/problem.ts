import { detectPainSignals } from "./signals.js";

const SENTENCE_SPLIT_RE = /(?<=[.!?])\s+/;
const MAX_LENGTH = 220;

function splitSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }
  return trimmed
    .split(SENTENCE_SPLIT_RE)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function truncate(text: string, maxLength: number = MAX_LENGTH): string {
  if (text.length <= maxLength) {
    return text;
  }
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= 0 ? cut.slice(0, lastSpace) : cut;
  return base + "…";
}

export function extractProblemStatement(title: string, selftext: string): string {
  for (const sentence of splitSentences(selftext)) {
    if (detectPainSignals(sentence).matchedCategories.size > 0) {
      return truncate(sentence);
    }
  }
  return truncate(title.trim());
}
