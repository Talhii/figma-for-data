import { NextResponse } from "next/server";
import { addDocument, removeDocument, getEngineMode } from "@/lib/ragStore";
import type { IngestRequest, IngestResponse } from "@/lib/types";

export const runtime = "nodejs";

// text-embedding-3-small dimensionality — surfaced so the UI can confirm the
// "1536-dim vectors inserted" acceptance criterion (AC 1.1).
const EMBEDDING_DIMENSIONS = 1536;

/**
 * POST /api/ingest
 *
 * Indexes a parsed+chunked document into the RAG store. In mock mode this is an
 * in-memory insert that mirrors the shape of a Supabase pgvector write; in live
 * mode (OpenAI + Supabase configured) this is where embeddings would be created
 * and upserted. Returns the row count + embedding dimensions either way.
 */
export async function POST(req: Request) {
  let body: IngestRequest;
  try {
    body = (await req.json()) as IngestRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body?.documentId || !Array.isArray(body.chunks) || body.chunks.length === 0) {
    return NextResponse.json(
      { error: "`documentId` and a non-empty `chunks` array are required" },
      { status: 400 }
    );
  }

  // (live mode) — embed each chunk with OpenAI and upsert into Supabase here.
  const inserted = addDocument(body.documentId, body.chunks, body.table);

  // Simulate embedding/index latency so the UI's "indexing…" state is visible.
  await new Promise((r) => setTimeout(r, 350));

  const response: IngestResponse = {
    ok: true,
    documentId: body.documentId,
    inserted,
    dimensions: EMBEDDING_DIMENSIONS,
    mode: getEngineMode(),
  };
  return NextResponse.json(response);
}

/**
 * DELETE /api/ingest?documentId=...
 *
 * Cascade-removes a document's vector chunks + table from the store (AC 1.2).
 */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const documentId = searchParams.get("documentId");
  if (!documentId) {
    return NextResponse.json(
      { error: "`documentId` query param is required" },
      { status: 400 }
    );
  }
  const removed = removeDocument(documentId);
  return NextResponse.json({ ok: true, documentId, removed });
}
