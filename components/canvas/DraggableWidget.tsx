"use client";

import { motion } from "framer-motion";
import { BarChart3, Table2, Sparkles, X, Link2, AlertTriangle } from "lucide-react";
import type { Widget } from "@/lib/types";
import { useCanvasState } from "@/hooks/useCanvasState";
import { useDragNode } from "@/hooks/useDragNode";
import { WidgetRenderer } from "@/components/widgets/WidgetRenderer";
import { cn } from "@/lib/utils";

const TYPE_META = {
  chart: { icon: BarChart3, label: "Chart" },
  sheet: { icon: Table2, label: "Spreadsheet" },
  text: { icon: Sparkles, label: "Insight" },
  error: { icon: AlertTriangle, label: "No result" },
} as const;

export function DraggableWidget({ widget }: { widget: Widget }) {
  const moveWidget = useCanvasState((s) => s.moveWidget);
  const removeWidget = useCanvasState((s) => s.removeWidget);
  const select = useCanvasState((s) => s.select);
  const setTracedWidget = useCanvasState((s) => s.setTracedWidget);
  const selected = useCanvasState((s) => s.selectedId === widget.id);
  const traced = useCanvasState((s) => s.tracedWidgetId === widget.id);

  const { onPointerDown, dragging } = useDragNode({
    x: widget.x,
    y: widget.y,
    onMove: (x, y) => moveWidget(widget.id, x, y),
    onStart: () => select(widget.id),
  });

  const meta = TYPE_META[widget.type];
  const Icon = meta.icon;
  const sourceCount = widget.sourceIds.length;

  return (
    <motion.div
      data-node-id={widget.id}
      onPointerDown={onPointerDown}
      initial={{ opacity: 0, scale: 0.85, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "group absolute flex flex-col overflow-hidden rounded-2xl border bg-canvas-panel/95 backdrop-blur-md",
        "border-white/[0.08] shadow-card transition-shadow",
        dragging && "cursor-grabbing",
        selected && "shadow-card-active",
        traced && "border-accent-glow/40"
      )}
      style={{ left: widget.x, top: widget.y, width: widget.width, height: widget.height }}
    >
      {/* Header — also the drag handle */}
      <div className="flex cursor-grab items-center gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-accent/15 text-accent-glow">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium leading-tight text-zinc-100">
            {widget.title}
          </div>
        </div>

        {/* Source badge: hovering traces SVG connections to source documents. */}
        {sourceCount > 0 && (
          <button
            data-no-drag
            onPointerEnter={() => setTracedWidget(widget.id)}
            onPointerLeave={() => setTracedWidget(null)}
            onFocus={() => setTracedWidget(widget.id)}
            onBlur={() => setTracedWidget(null)}
            className={cn(
              "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
              "border-white/[0.08] text-zinc-400 hover:border-accent-glow/50 hover:text-accent-glow",
              traced && "border-accent-glow/60 text-accent-glow"
            )}
            title="Hover to trace data sources"
          >
            <Link2 className="h-3 w-3" />
            {sourceCount} source{sourceCount > 1 ? "s" : ""}
          </button>
        )}

        <button
          data-no-drag
          onClick={() => removeWidget(widget.id)}
          className="grid h-6 w-6 place-items-center rounded-md text-zinc-500 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-200 group-hover:opacity-100"
          title="Remove widget"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 p-3">
        <WidgetRenderer widget={widget} />
      </div>
    </motion.div>
  );
}
