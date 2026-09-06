const URL_RE = /https?:\/\/\S+/g;
const WHITESPACE_RE = /\s+/g;

export function normalizeText(text: string): string {
  let result = text.replace(URL_RE, "");
  result = result.toLowerCase();
  result = result.replace(WHITESPACE_RE, " ");
  return result.trim();
}

const TOKEN_RE = /[a-z0-9']+/g;

export const STOPWORDS: ReadonlySet<string> = new Set([
  "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be",
  "been", "being", "to", "of", "in", "on", "for", "with", "that", "this",
  "it", "i", "we", "you", "they", "my", "our", "your", "at", "as", "so",
  "do", "does", "did", "have", "has", "had", "not", "no", "if", "than",
  "then", "there", "here", "just", "very", "really", "would", "could",
  "can", "will", "all", "every", "some", "any", "into", "out", "up",
  "about", "from", "by", "because", "between", "anyone", "found",
  "which", "way", "too", "such", "something", "without", "exists",
  "existing", "huge", "me", "go", "two", "person", "anything",
  "immediately", "actually", "even", "get", "gets", "getting", "new",
  "one", "own", "still", "much", "already", "again", "back",
]);

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  const tokens = normalized.match(TOKEN_RE) ?? [];
  return tokens.filter((t) => !STOPWORDS.has(t) && t.length > 1);
}
