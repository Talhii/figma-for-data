"use client";

import { Sparkles, TrendingUp } from "lucide-react";
import type { TextInsightData } from "@/lib/types";

/**
 * Narrative widget: a one-line summary, optional headline metrics rendered as
 * stat chips, and a bulleted list of takeaways.
 */
export function InsightsWidget({ data }: { data: TextInsightData }) {
  const { summary, bullets, metrics } = data;

  return (
    <div className="thin-scrollbar flex h-full w-full flex-col gap-3 overflow-auto pr-1">
      <p className="text-[13px] leading-relaxed text-zinc-200">{summary}</p>

      {metrics && metrics.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {metrics.map((m) => (
            <div
              key={m.label}
              className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2"
            >
              <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                {m.label}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-base font-semibold text-zinc-100">
                  {m.value}
                </span>
                {m.delta && (
                  <span className="flex items-center gap-0.5 text-[11px] font-medium text-accent-emerald">
                    <TrendingUp className="h-3 w-3" />
                    {m.delta}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-1.5">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-zinc-400">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-accent-glow" />
            <span className="leading-relaxed">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
