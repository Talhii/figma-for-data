// ─────────────────────────────────────────────────────────────────────────────
// Core domain types for "Figma for Data".
// These are the single source of truth shared by the canvas, widgets, the
// Zustand store, and the AI router API contract.
// ─────────────────────────────────────────────────────────────────────────────

/** Canvas-space 2D point (world coordinates, pre-pan/zoom transform). */
export interface Point {
  x: number;
  y: number;
}

export type WidgetType = "chart" | "sheet" | "text" | "error";

/** The concrete chart sub-types the AI router can emit. */
export type ChartKind = "bar" | "line" | "pie";

/**
 * A row in a normalized data array. Recharts and the spreadsheet grid both
 * consume `Record<string, string | number>`; we keep it loose on purpose so the
 * AI can shape columns freely while staying typed at the boundary.
 */
export type DataRow = Record<string, string | number>;

/** Payload for a chart widget. */
export interface ChartData {
  kind: ChartKind;
  /** Field name used for the category / X axis. */
  xKey: string;
  /** One or more numeric series keys plotted against `xKey`. */
  series: { key: string; label: string; color: string }[];
  rows: DataRow[];
}

/** Payload for a spreadsheet/grid widget. */
export interface SheetData {
  columns: { key: string; label: string }[];
  rows: DataRow[];
}

/** Payload for a text insight widget. */
export interface TextInsightData {
  summary: string;
  bullets: string[];
  /** Optional headline metrics rendered as stat chips. */
  metrics?: { label: string; value: string; delta?: string }[];
}

/** Payload for the guardrail error card (Phase 3 / AC 3.3). */
export interface ErrorData {
  message: string;
  hint?: string;
}

export type WidgetData = ChartData | SheetData | TextInsightData | ErrorData;

/**
 * A widget materialized onto the canvas. `sourceIds` references the
 * SourceDocument nodes that produced it — used to draw SVG connections.
 */
export interface Widget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
  data: WidgetData;
  sourceIds: string[];
  /** Document chunk ids the AI cited; surfaced in the source badge. */
  sourceChunkIds: string[];
  createdAt: number;
}

/** An uploaded source document represented as a node on the canvas. */
export interface SourceDocument {
  id: string;
  name: string;
  x: number;
  y: number;
  /** File flavor — drives the node icon/color. */
  type: "pdf" | "csv" | "markdown" | "text";
  /** Short human description shown on the node. */
  summary: string;
  /** Number of embedded chunks indexed for this document. */
  chunkCount: number;
  /** Upload time (epoch ms). Seed documents use the app's load time. */
  uploadedAt: number;
}

/** A retrievable, embedded slice of a source document. */
export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  /** Lightweight bag-of-words "embedding" stand-in for the mock vector store. */
  keywords: string[];
}

// ── AI router contract (Phase 2) ─────────────────────────────────────────────

export type AiWidgetType =
  | "bar-chart"
  | "line-chart"
  | "pie-chart"
  | "spreadsheet-grid"
  | "text-insight"
  | "error-card";

/**
 * The structured-output schema the `/api/generate-widget` route returns.
 * Mirrors the JSON the live OpenAI function-call would produce, so swapping
 * the mock router for a live one requires no client changes.
 */
export interface GeneratedWidgetSchema {
  widgetType: AiWidgetType;
  title: string;
  /** Normalized, ready-to-render data array + chart hints. */
  cleanData: WidgetData;
  /** Document chunk ids used to build this widget. */
  sourceChunkIds: string[];
  /** Resolved parent SourceDocument ids (derived from the chunk ids). */
  sourceIds: string[];
}

export interface GenerateWidgetRequest {
  prompt: string;
  /** Ids of documents currently on the canvas, to scope retrieval. */
  documentIds?: string[];
}

export interface GenerateWidgetResponse {
  widget: GeneratedWidgetSchema;
  /** Retrieval debug info — handy for the "wow factor" source trace. */
  retrieval: { chunkId: string; documentId: string; score: number }[];
}

// ── Ingestion contract (Module A / Phase 1) ──────────────────────────────────

/**
 * Payload posted to `/api/ingest` after a file is parsed + chunked client-side.
 * `table` is present only for CSV uploads so the router can build real charts
 * and grids from the actual data.
 */
export interface IngestRequest {
  documentId: string;
  name: string;
  type: SourceDocument["type"];
  chunks: DocumentChunk[];
  table?: SheetData;
}

export interface IngestResponse {
  ok: boolean;
  documentId: string;
  /** Number of vector rows "inserted" (chunks indexed). */
  inserted: number;
  /** Embedding dimensionality — 1536 mirrors text-embedding-3-small. */
  dimensions: number;
  /** "live" once OpenAI + Supabase are configured, else "mock". */
  mode: "mock" | "live";
}
