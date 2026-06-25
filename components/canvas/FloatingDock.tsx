"use client";

import { motion } from "framer-motion";
import { Boxes, Plus, Minus, Frame, Trash2 } from "lucide-react";
import { useCanvasState } from "@/hooks/useCanvasState";

export function FloatingDock() {
  const widgets = useCanvasState((s) => s.widgets);
  const documents = useCanvasState((s) => s.documents);
  const zoomAt = useCanvasState((s) => s.zoomAt);
  const resetViewport = useCanvasState((s) => s.resetViewport);
  const removeWidget = useCanvasState((s) => s.removeWidget);

  const center = () => ({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });

  return (
    <>
      {/* Brand badge — top left */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute left-5 top-5 z-30 flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-canvas-panel/80 px-3 py-2 backdrop-blur-xl"
      >
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-accent-sheen text-accent-glow">
          <Boxes className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-semibold text-zinc-100">
            Figma for Data
          </div>
          <div className="text-[10px] text-zinc-500">
            {documents.length} sources · {widgets.length} widgets
          </div>
        </div>
      </motion.div>

      {/* Tool dock — top right */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="absolute right-5 top-5 z-30 flex items-center gap-1 rounded-xl border border-white/[0.08] bg-canvas-panel/80 p-1 backdrop-blur-xl"
      >
        <DockButton label="Zoom in" onClick={() => zoomAt(1.2, center())}>
          <Plus className="h-4 w-4" />
        </DockButton>
        <DockButton label="Zoom out" onClick={() => zoomAt(1 / 1.2, center())}>
          <Minus className="h-4 w-4" />
        </DockButton>
        <DockButton label="Reset view" onClick={resetViewport}>
          <Frame className="h-4 w-4" />
        </DockButton>
        <div className="mx-0.5 h-5 w-px bg-white/[0.08]" />
        <DockButton
          label="Clear widgets"
          disabled={widgets.length === 0}
          onClick={() => widgets.forEach((w) => removeWidget(w.id))}
        >
          <Trash2 className="h-4 w-4" />
        </DockButton>
      </motion.div>
    </>
  );
}

function DockButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.06] hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-30"
    >
      {children}
    </button>
  );
}
