import "server-only";
import type { DocumentChunk, SheetData } from "@/lib/types";
import { MOCK_CHUNKS } from "@/lib/mockData";

// ─────────────────────────────────────────────────────────────────────────────
// RAG engine — the storage/retrieval layer behind ingestion and the AI router.
//
// Adapter pattern: both the in-memory mock engine and the (stubbed) live
// Supabase/pgvector engine satisfy the same `RagEngine` interface, selected at
// startup from the environment. Callers (`/api/ingest`, `aiAgentRouter`) depend
// only on the interface, never the implementation — so going live is a config
// change, not a rewrite.
// ─────────────────────────────────────────────────────────────────────────────

export type EngineMode = "mock" | "live";

/** Live mode requires BOTH an OpenAI key and a Supabase URL; else simulate. */
export function getEngineMode(): EngineMode {
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY);
  const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  return hasOpenAI && hasSupabase ? "live" : "mock";
}

/** The contract every engine implementation must satisfy. */
export interface RagEngine {
  readonly mode: EngineMode;
  /** All indexed chunks, optionally scoped to a set of document ids. */
  getChunks(documentIds?: string[]): DocumentChunk[];
  /** Structured tabular data for a CSV-derived document, if any. */
  getTable(documentId: string): SheetData | undefined;
  /** Index a document's chunks (+ optional CSV table); returns rows written. */
  addDocument(
    documentId: string,
    chunks: DocumentChunk[],
    table?: SheetData
  ): number;
  /** Cascade-remove a document's chunks + table; returns rows removed. */
  removeDocument(documentId: string): number;
}

// ── Mock engine (high-fidelity local simulation) ─────────────────────────────

interface RagRegistry {
  chunks: DocumentChunk[];
  tables: Map<string, SheetData>;
}

const g = globalThis as unknown as {
  __ragRegistry?: RagRegistry;
  __ragModeLogged?: boolean;
};

// Pinned to globalThis so the seed corpus + any uploads survive Next.js HMR and
// are shared across route modules in a single dev process.
const registry: RagRegistry =
  g.__ragRegistry ??
  (g.__ragRegistry = { chunks: [...MOCK_CHUNKS], tables: new Map() });

function createMockEngine(): RagEngine {
  return {
    mode: "mock",
    getChunks(documentIds) {
      if (!documentIds?.length) return registry.chunks;
      const set = new Set(documentIds);
      return registry.chunks.filter((c) => set.has(c.documentId));
    },
    getTable(documentId) {
      return registry.tables.get(documentId);
    },
    addDocument(documentId, chunks, table) {
      // Idempotent re-ingest: replace any prior chunks for this document.
      registry.chunks = registry.chunks.filter(
        (c) => c.documentId !== documentId
      );
      registry.chunks.push(...chunks);
      if (table) registry.tables.set(documentId, table);
      return chunks.length;
    },
    removeDocument(documentId) {
      const before = registry.chunks.length;
      registry.chunks = registry.chunks.filter(
        (c) => c.documentId !== documentId
      );
      registry.tables.delete(documentId);
      return before - registry.chunks.length;
    },
  };
}

// ── Live engine (stub) ───────────────────────────────────────────────────────

function createLiveEngine(): RagEngine {
  // Real implementation: embed chunks with OpenAI text-embedding-3-small and
  // upsert / similarity-search via Supabase pgvector (see README "Going live").
  const notConfigured = (): never => {
    throw new Error(
      "Live RAG engine selected but not implemented. Wire OpenAI + Supabase in lib/ragStore.ts (see README)."
    );
  };
  return {
    mode: "live",
    getChunks: notConfigured,
    getTable: notConfigured,
    addDocument: notConfigured,
    removeDocument: notConfigured,
  };
}

function logEngineModeOnce(mode: EngineMode): void {
  if (g.__ragModeLogged) return;
  g.__ragModeLogged = true;
  if (mode === "mock") {
    console.info(
      "[Figma for Data] Running in Cost-Isolated Local Simulation Mode — no OPENAI_API_KEY / NEXT_PUBLIC_SUPABASE_URL detected; using the high-fidelity mock pipeline."
    );
  } else {
    console.info(
      "[Figma for Data] Running in Live mode — OpenAI + Supabase detected."
    );
  }
}

const mode = getEngineMode();
logEngineModeOnce(mode);

/** The selected engine. Import this (or the bound helpers below) — never an impl. */
export const ragEngine: RagEngine =
  mode === "live" ? createLiveEngine() : createMockEngine();

// Bound convenience exports so existing call sites stay terse.
export const getChunks: RagEngine["getChunks"] = (ids) =>
  ragEngine.getChunks(ids);
export const getTable: RagEngine["getTable"] = (id) => ragEngine.getTable(id);
export const addDocument: RagEngine["addDocument"] = (id, chunks, table) =>
  ragEngine.addDocument(id, chunks, table);
export const removeDocument: RagEngine["removeDocument"] = (id) =>
  ragEngine.removeDocument(id);
