"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowUp, Loader2, Sparkles } from "lucide-react";
import { useCanvasState } from "@/hooks/useCanvasState";
import type { GenerateWidgetResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Revenue trend by quarter",
  "Market share as a pie chart",
  "Summarize churn drivers",
  "Retention cohort over time",
  "Revenue by region as a table",
];

export function AiActionBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documents = useCanvasState((s) => s.documents);
  const spawn = useCanvasState((s) => s.spawnWidgetFromSchema);
  const viewportCenter = useCanvasState((s) => s.viewportCenter);

  async function generate(text: string) {
    const query = text.trim();
    if (!query || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-widget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: query,
          documentIds: documents.map((d) => d.id),
        }),
      });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data: GenerateWidgetResponse = await res.json();

      // Anchor near the viewport center; the store finds the nearest
      // non-overlapping slot from here so widgets auto-cascade.
      const center = viewportCenter(window.innerWidth, window.innerHeight);
      spawn(data.widget, { x: center.x - 210, y: center.y - 160 });
      setPrompt("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    // Centering lives on a plain wrapper: framer-motion owns `transform` on the
    // motion element, so a Tailwind `-translate-x-1/2` there would be wiped out
    // by the entrance animation, knocking the bar off-center.
    <div className="absolute bottom-6 left-1/2 z-30 w-[min(680px,calc(100vw-2rem))] -translate-x-1/2">
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, type: "spring", stiffness: 200, damping: 24 }}
      className="w-full"
    >
      {/* Suggestion chips */}
      <div className="mb-2.5 flex flex-wrap items-center justify-center gap-2 px-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={loading}
            onClick={() => generate(s)}
            className="shrink-0 rounded-full border border-white/[0.07] bg-canvas-panel/70 px-3 py-1 text-[11px] text-zinc-400 backdrop-blur transition hover:border-accent-glow/40 hover:text-zinc-100 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          generate(prompt);
        }}
        className={cn(
          "flex items-center gap-2 rounded-2xl border bg-canvas-panel/90 p-2 pl-3.5 backdrop-blur-xl transition-shadow",
          "border-white/[0.1] shadow-card",
          "focus-within:border-accent-glow/50 focus-within:shadow-glow"
        )}
      >
        <Sparkles className="h-4 w-4 shrink-0 text-accent-glow" />
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask your data anything — e.g. “revenue trend by quarter”"
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className={cn(
            "grid h-8 w-8 shrink-0 place-items-center rounded-xl transition",
            "bg-accent text-white hover:bg-accent-glow disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </button>
      </form>

      {error && (
        <p className="mt-1.5 text-center text-[11px] text-accent-rose">{error}</p>
      )}
    </motion.div>
    </div>
  );
}
