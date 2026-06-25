import type { DocumentChunk } from "@/lib/types";

// ─────────────────────────────────────────────────────────────────────────────
// Mock vector store.
//
// Stands in for pgvector + embeddings. Scores chunks against a query using a
// keyword/term-overlap heuristic so retrieval feels real without network calls.
// `retrieve` is pure over the chunk set it's given (the route supplies the live
// set from the RAG registry), so swapping in a Supabase similarity query later
// is a drop-in change.
// ─────────────────────────────────────────────────────────────────────────────

export interface RetrievedChunk {
  chunk: DocumentChunk;
  score: number;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "by", "to", "in", "on", "and", "or", "show",
  "me", "with", "is", "are", "our", "us", "this", "that", "give", "create",
  "make", "build", "chart", "graph", "plot", "table", "grid", "as",
]);

/**
 * Crude English singularizer used to normalize plural vocabulary so a query
 * term matches a column header regardless of number ("countries" → "country",
 * "companies" → "company", "customers" → "customer"). Applied symmetrically to
 * both query tokens and indexed keywords/content, so it never causes a mismatch.
 */
export function singularize(w: string): string {
  if (w.length <= 3) return w;
  if (w.endsWith("ies")) return w.slice(0, -3) + "y";
  if (/(?:ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2);
  if (w.endsWith("ss")) return w;
  if (w.endsWith("s")) return w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(singularize);
}

/**
 * Score a single chunk against query tokens. Keyword tags are weighted higher
 * than incidental content-word overlap.
 */
function scoreChunk(chunk: DocumentChunk, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const keywordSet = new Set(
    chunk.keywords.map((k) => singularize(k.toLowerCase()))
  );
  const contentTokens = new Set(tokenize(chunk.content));

  let score = 0;
  for (const token of tokens) {
    // Direct keyword hit (also catch multi-word keywords containing the token).
    if (keywordSet.has(token)) score += 3;
    else if ([...keywordSet].some((k) => k.includes(token))) score += 2;
    if (contentTokens.has(token)) score += 1;
  }
  return score;
}

/**
 * Retrieve the top-k most relevant chunks for a query from a chunk set. Returns
 * only positive-scoring matches (empty when nothing is relevant) so callers can
 * apply a confidence guardrail.
 */
export function retrieve(
  query: string,
  chunks: DocumentChunk[],
  topK = 4
): RetrievedChunk[] {
  const tokens = tokenize(query);
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
