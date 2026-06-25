"use client";

import { motion } from "framer-motion";
import { FileText, FileSpreadsheet, FileCode, File, Trash2 } from "lucide-react";
import type { SourceDocument } from "@/lib/types";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useDragNode } from "@/hooks/useDragNode";
import { cn, timeAgo } from "@/lib/utils";

const ICONS = {
  pdf: FileText,
  csv: FileSpreadsheet,
  markdown: FileCode,
  text: File,
} as const;

const TYPE_COLOR = {
  pdf: "text-accent-rose",
  csv: "text-accent-emerald",
  markdown: "text-accent-cyan",
  text: "text-zinc-400",
} as const;

/**
 * A source document rendered as a draggable canvas node. These are the anchors
 * that generated widgets trace their SVG connections back to.
 */
export function DocumentNode({ doc }: { doc: SourceDocument }) {
  const moveDocument = useCanvasState((s) => s.moveDocument);
  const removeDocument = useCanvasState((s) => s.removeDocument);
  const select = useCanvasState((s) => s.select);
  const selected = useCanvasState((s) => s.selectedId === doc.id);
  const isTraced = useCanvasState((s) => {
    // Matches SvgConnections: highlight when this doc feeds the hovered or the
    // selected/dragged widget.
    const activeId = s.tracedWidgetId ?? s.selectedId;
    if (!activeId) return false;
    const w = s.widgets.find((w) => w.id === activeId);
    return Boolean(w?.sourceIds.includes(doc.id));
  });

  const { onPointerDown, dragging } = useDragNode({
    x: doc.x,
    y: doc.y,
    onMove: (x, y) => moveDocument(doc.id, x, y),
    onStart: () => select(doc.id),
  });

  async function handleDelete() {
    // Optimistic: clear the node + its visual links immediately, then cascade
    // the vector-store cleanup server-side (AC 1.2).
    removeDocument(doc.id);
    try {
      await fetch(`/api/ingest?documentId=${encodeURIComponent(doc.id)}`, {
        method: "DELETE",
      });
    } catch {
      // Node is already removed locally; ignore network cleanup failures.
    }
  }

  const Icon = ICONS[doc.type];

  return (
    <motion.div
      data-node-id={doc.id}
      onPointerDown={onPointerDown}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "group absolute w-56 cursor-grab touch-none select-none rounded-xl border bg-canvas-panel/90 p-3 backdrop-blur-sm transition-shadow",
        "border-white/[0.08]",
        dragging && "cursor-grabbing",
        selected && "shadow-card-active",
        isTraced && "border-accent-glow/50 shadow-glow"
      )}
      style={{ left: doc.x, top: doc.y }}
    >
      <button
        data-no-drag
        onClick={handleDelete}
        title="Delete document & its vectors"
        className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-md text-zinc-500 opacity-0 transition hover:bg-accent-rose/15 hover:text-accent-rose group-hover:opacity-100"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            "grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-white/[0.06] bg-white/[0.03]",
            TYPE_COLOR[doc.type]
          )}
        >
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-zinc-100">
            {doc.name}
          </div>
          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-zinc-500">
            {doc.summary}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between border-t border-white/[0.05] pt-2">
        <span className="text-[10px] uppercase tracking-wide text-zinc-600">
          {doc.type} · {timeAgo(doc.uploadedAt)}
        </span>
        <span className="text-[10px] text-zinc-500">
          {doc.chunkCount} chunks indexed
        </span>
      </div>
    </motion.div>
  );
}
