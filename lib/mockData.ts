import type { DocumentChunk, SourceDocument } from "@/lib/types";

// Seed documents present a realistic "uploaded a couple days ago" timestamp.
const SEED_UPLOADED_AT = Date.now() - 1000 * 60 * 60 * 24 * 2;

// ─────────────────────────────────────────────────────────────────────────────
// Mock corpus for "Figma for Data".
//
// A small, internally-consistent company dataset so the canvas is interactive
// the moment it loads — no Supabase / OpenAI keys required. Documents are
// pre-positioned on the canvas; chunks carry keyword "embeddings" the mock
// vector store scores against.
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_DOCUMENTS: SourceDocument[] = [
  {
    id: "doc-financials",
    name: "FY24_Financials.csv",
    type: "csv",
    x: -640,
    y: -260,
    summary: "Quarterly revenue, expenses & profit by region.",
    chunkCount: 3,
    uploadedAt: SEED_UPLOADED_AT,
  },
  {
    id: "doc-product",
    name: "Product_Roadmap.pdf",
    type: "pdf",
    x: -660,
    y: 180,
    summary: "Feature adoption and roadmap commitments.",
    chunkCount: 2,
    uploadedAt: SEED_UPLOADED_AT,
  },
  {
    id: "doc-market",
    name: "Market_Research.md",
    type: "markdown",
    x: 560,
    y: -300,
    summary: "Competitive landscape, market share & churn drivers.",
    chunkCount: 3,
    uploadedAt: SEED_UPLOADED_AT,
  },
  {
    id: "doc-users",
    name: "User_Metrics.csv",
    type: "csv",
    x: 600,
    y: 200,
    summary: "Activation, retention cohorts and DAU/MAU.",
    chunkCount: 2,
    uploadedAt: SEED_UPLOADED_AT,
  },
];

export const MOCK_CHUNKS: DocumentChunk[] = [
  // ── Financials ────────────────────────────────────────────────────────────
  {
    id: "chunk-fin-1",
    documentId: "doc-financials",
    content:
      "Total revenue grew from $2.1M in Q1 to $3.8M in Q4, a 81% increase across the fiscal year driven by enterprise expansion.",
    keywords: ["revenue", "quarter", "sales", "growth", "income", "trend", "fiscal"],
  },
  {
    id: "chunk-fin-2",
    documentId: "doc-financials",
    content:
      "Revenue by region: North America led with $5.4M, followed by EMEA at $3.1M, APAC $2.0M and LATAM $0.9M.",
    keywords: ["region", "revenue", "geography", "north america", "emea", "apac", "sales"],
  },
  {
    id: "chunk-fin-3",
    documentId: "doc-financials",
    content:
      "Operating expenses held at 62% of revenue; gross margin improved 6 points to 71% by Q4.",
    keywords: ["expenses", "margin", "profit", "cost", "operating", "ebitda"],
  },

  // ── Product ───────────────────────────────────────────────────────────────
  {
    id: "chunk-prod-1",
    documentId: "doc-product",
    content:
      "Feature adoption: Dashboards 82%, Automations 64%, Collaboration 58%, AI Insights 41%, Mobile 33%.",
    keywords: ["feature", "adoption", "product", "usage", "dashboards", "automations"],
  },
  {
    id: "chunk-prod-2",
    documentId: "doc-product",
    content:
      "Roadmap priorities for next two quarters: real-time sync, granular permissions, and an embeddable SDK.",
    keywords: ["roadmap", "priorities", "product", "plan", "features", "sdk"],
  },

  // ── Market ────────────────────────────────────────────────────────────────
  {
    id: "chunk-mkt-1",
    documentId: "doc-market",
    content:
      "Market share split: our product 28%, Competitor A 34%, Competitor B 21%, Others 17%.",
    keywords: ["market", "share", "competitor", "distribution", "split", "landscape"],
  },
  {
    id: "chunk-mkt-2",
    documentId: "doc-market",
    content:
      "Primary churn drivers: onboarding friction (38%), missing integrations (27%), pricing (22%), and support latency (13%).",
    keywords: ["churn", "retention", "drivers", "cancel", "reasons", "attrition"],
  },
  {
    id: "chunk-mkt-3",
    documentId: "doc-market",
    content:
      "Net promoter score climbed from 31 to 48 year-over-year; enterprise NPS outpaces SMB by 14 points.",
    keywords: ["nps", "sentiment", "satisfaction", "promoter", "summary", "insight"],
  },

  // ── Users ─────────────────────────────────────────────────────────────────
  {
    id: "chunk-usr-1",
    documentId: "doc-users",
    content:
      "Monthly retention by cohort: M1 88%, M2 79%, M3 73%, M4 69%, M5 66%, M6 64%.",
    keywords: ["retention", "cohort", "users", "trend", "monthly", "stickiness"],
  },
  {
    id: "chunk-usr-2",
    documentId: "doc-users",
    content:
      "DAU/MAU ratio improved to 0.42; daily active users reached 18,400 with 31% week-over-week activation.",
    keywords: ["dau", "mau", "active", "users", "engagement", "activation"],
  },
];

/** Lookup helpers used by the vector store + router. */
export const documentById = (id: string): SourceDocument | undefined =>
  MOCK_DOCUMENTS.find((d) => d.id === id);

export const chunkById = (id: string): DocumentChunk | undefined =>
  MOCK_CHUNKS.find((c) => c.id === id);
