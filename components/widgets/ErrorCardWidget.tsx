"use client";

import { motion } from "framer-motion";
import { SearchX } from "lucide-react";
import type { ErrorData } from "@/lib/types";

/**
 * Guardrail card (AC 3.3): shown when the AI bar can't find anything in the
 * indexed documents relevant to the prompt — an explicit, calm dead-end rather
 * than a silent failure or a misleading chart. Fades in gently so the guardrail
 * never feels like a hard error.
 */
export function ErrorCardWidget({ data }: { data: ErrorData }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="flex h-full w-full flex-col items-center justify-center gap-2.5 px-4 text-center"
    >
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.3 }}
        className="grid h-10 w-10 place-items-center rounded-xl border border-accent-amber/30 bg-accent-amber/10 text-accent-amber"
      >
        <SearchX className="h-5 w-5" />
      </motion.div>
      <p className="text-[13px] font-medium leading-snug text-zinc-200">
        {data.message}
      </p>
      {data.hint && (
        <p className="max-w-[280px] text-xs leading-relaxed text-zinc-500">
          {data.hint}
        </p>
      )}
    </motion.div>
  );
}
