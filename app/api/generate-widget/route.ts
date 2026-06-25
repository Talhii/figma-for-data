import { NextResponse } from "next/server";
import { routeWidget } from "@/lib/aiAgentRouter";
import type {
  GenerateWidgetRequest,
  GenerateWidgetResponse,
} from "@/lib/types";

export const runtime = "nodejs";

/**
 * POST /api/generate-widget
 *
 * Accepts a natural-language prompt + the documents on the canvas, runs RAG
 * retrieval, and returns a structured widget schema (`GeneratedWidgetSchema`)
 * ready to render. Currently backed by the mock router; the response contract
 * matches a live OpenAI structured-output call so the swap is transparent.
 */
export async function POST(req: Request) {
  let body: GenerateWidgetRequest;
  try {
    body = (await req.json()) as GenerateWidgetRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body?.prompt?.trim();
  if (!prompt) {
    return NextResponse.json(
      { error: "`prompt` is required" },
      { status: 400 }
    );
  }

  const { schema, retrieval } = routeWidget(prompt, body.documentIds);

  // Light artificial latency so the loading state is perceptible in the demo.
  await new Promise((r) => setTimeout(r, 280));

  const response: GenerateWidgetResponse = {
    widget: schema,
    retrieval: retrieval.map((r) => ({
      chunkId: r.chunk.id,
      documentId: r.chunk.documentId,
      score: r.score,
    })),
  };

  return NextResponse.json(response);
}
