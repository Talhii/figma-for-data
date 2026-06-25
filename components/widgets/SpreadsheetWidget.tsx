"use client";

import { useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { DataRow, SheetData } from "@/lib/types";
import { useCanvasState } from "@/hooks/useCanvasState";

/**
 * Editable data grid (AC 3.2). Numeric cells are editable inputs; the pinned
 * footer recomputes per-column totals live as cells change. Edits are written
 * back to the widget's data in the store so they persist and stay the source of
 * truth.
 */
export function SpreadsheetWidget({
  widgetId,
  data,
}: {
  widgetId: string;
  data: SheetData;
}) {
  const updateWidgetData = useCanvasState((s) => s.updateWidgetData);
  const { columns, rows } = data;

  // A column is "numeric" if any row holds a number there — those get inputs
  // and a column total.
  const numericKeys = useMemo(() => {
    const set = new Set<string>();
    for (const c of columns) {
      if (rows.some((r) => typeof r[c.key] === "number")) set.add(c.key);
    }
    return set;
  }, [columns, rows]);

  const totals = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const key of numericKeys) {
      acc[key] = rows.reduce(
        (sum, r) => sum + (typeof r[key] === "number" ? (r[key] as number) : 0),
        0
      );
    }
    return acc;
  }, [numericKeys, rows]);

  function setCell(rowIdx: number, key: string, raw: string) {
    // Keep numeric columns numeric; tolerate transient input like "" or "-".
    const parsed = raw === "" ? 0 : Number(raw);
    const value: string | number = Number.isNaN(parsed) ? raw : parsed;
    const nextRows: DataRow[] = rows.map((r, i) =>
      i === rowIdx ? { ...r, [key]: value } : r
    );
    updateWidgetData(widgetId, { ...data, rows: nextRows });
  }

  const hasTotals = numericKeys.size > 0;

  return (
    <div className="thin-scrollbar h-full w-full overflow-auto rounded-lg">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 bg-canvas-elevated/95 backdrop-blur">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="border-b border-white/[0.08] px-3 py-2 text-[10px] font-medium uppercase tracking-wide text-zinc-400"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group transition-colors hover:bg-white/[0.03]">
              {columns.map((col) => {
                const value = row[col.key];
                const editable = numericKeys.has(col.key);
                return (
                  <td
                    key={col.key}
                    className="border-b border-white/[0.04] px-1.5 py-1 tabular-nums"
                  >
                    {editable ? (
                      <input
                        data-no-drag
                        inputMode="decimal"
                        value={String(value ?? "")}
                        onChange={(e) => setCell(ri, col.key, e.target.value)}
                        className="w-full rounded bg-transparent px-1.5 py-1 text-right font-medium text-zinc-200 outline-none transition focus:bg-white/[0.05] focus:ring-1 focus:ring-accent-glow/40"
                      />
                    ) : (
                      <span className="block px-1.5 py-1 text-zinc-400">
                        {String(value ?? "")}
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
        {hasTotals && (
          <tfoot className="sticky bottom-0 z-10 bg-canvas-elevated/95 backdrop-blur">
            <tr>
              {columns.map((col, ci) => (
                <td
                  key={col.key}
                  className="border-t border-white/[0.1] px-3 py-1.5 text-right tabular-nums"
                >
                  {ci === 0 && !numericKeys.has(col.key) ? (
                    <span className="text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Σ Total
                    </span>
                  ) : numericKeys.has(col.key) ? (
                    // Re-key on the rounded total so it fades/slides on change.
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span
                        key={round(totals[col.key])}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="inline-block font-semibold text-accent-glow"
                      >
                        {round(totals[col.key]).toLocaleString()}
                      </motion.span>
                    </AnimatePresence>
                  ) : null}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
