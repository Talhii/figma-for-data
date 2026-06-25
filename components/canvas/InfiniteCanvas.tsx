"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { useCanvasState, ZOOM_MAX, ZOOM_MIN } from "@/hooks/useCanvasState";
import { DocumentNode } from "@/components/widgets/DocumentNode";
import { DraggableWidget } from "./DraggableWidget";
import { SvgConnections } from "./SvgConnections";
import { cn, clamp } from "@/lib/utils";

const GRID_SIZE = 26;

export function InfiniteCanvas({ children }: { children?: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewport = useCanvasState((s) => s.viewport);
  const documents = useCanvasState((s) => s.documents);
  const widgets = useCanvasState((s) => s.widgets);
  const panBy = useCanvasState((s) => s.panBy);
  const zoomAt = useCanvasState((s) => s.zoomAt);
  const select = useCanvasState((s) => s.select);
  const setViewport = useCanvasState((s) => s.setViewport);

  const [panning, setPanning] = useState(false);

  // Fit all source documents into view on first mount, reserving space for the
  // top dock and the bottom AI bar. Without this the nodes sit around screen
  // (0,0) — the top-left corner — and most are off-screen until you pan.
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current) return;
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;

    const docs = useCanvasState.getState().documents;
    fitted.current = true;

    if (docs.length === 0) {
      setViewport({ x: rect.width / 2, y: rect.height / 2 });
      return;
    }

    // Approximate node footprint (matches DocumentNode w-56 card).
    const NODE_W = 224;
    const NODE_H = 116;
    const minX = Math.min(...docs.map((d) => d.x));
    const minY = Math.min(...docs.map((d) => d.y));
    const maxX = Math.max(...docs.map((d) => d.x + NODE_W));
    const maxY = Math.max(...docs.map((d) => d.y + NODE_H));
    const contentW = maxX - minX;
    const contentH = maxY - minY;

    // Chrome to keep clear: dock (top) and AI bar + chips (bottom).
    const padX = 100;
    const padTop = 96;
    const padBottom = 168;
    const availW = rect.width - padX * 2;
    const availH = rect.height - padTop - padBottom;

    const zoom = clamp(
      Math.min(availW / contentW, availH / contentH, 1),
      ZOOM_MIN,
      1
    );
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setViewport({
      zoom,
      x: rect.width / 2 - cx * zoom,
      y: padTop + availH / 2 - cy * zoom,
    });
  }, [setViewport]);

  // Background-only panning. Nodes stop propagation in their own handlers, but
  // the dock / AI bar render as children here — so we must NOT pan (and must
  // not capture the pointer) when the gesture starts on an interactive control,
  // or the element's click never resolves. We also rely on window listeners for
  // move/up, so setPointerCapture is unnecessary and actively harmful here.
  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (e.button !== 0) return;
      if (
        (e.target as HTMLElement).closest(
          "button, input, textarea, select, a, [data-node-id]"
        )
      )
        return;
      select(null);
      setPanning(true);
      const start = { px: e.clientX, py: e.clientY };

      const move = (ev: PointerEvent) => {
        panBy(ev.clientX - start.px, ev.clientY - start.py);
        start.px = ev.clientX;
        start.py = ev.clientY;
      };
      const up = () => {
        setPanning(false);
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    },
    [panBy, select]
  );

  // Non-passive wheel listener so we can preventDefault for zoom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const focus = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const factor = Math.exp(-e.deltaY * 0.0015);
      zoomAt(factor, focus);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  return (
    <div
      ref={containerRef}
      onPointerDown={onPointerDown}
      className={cn(
        "absolute inset-0 overflow-hidden bg-canvas-deep",
        panning ? "cursor-grabbing canvas-grabbing" : "cursor-grab"
      )}
    >
      {/* Dot-grid background — pans with the viewport, scales with zoom. */}
      <div
        className="pointer-events-none absolute inset-0 bg-dot-grid opacity-70"
        style={{
          backgroundSize: `${GRID_SIZE * viewport.zoom}px ${
            GRID_SIZE * viewport.zoom
          }px`,
          backgroundPosition: `${viewport.x}px ${viewport.y}px`,
        }}
      />
      {/* Ambient radial vignette for depth. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgba(0,0,0,0.55))]" />

      {/* Transformed world layer (shared coordinate space for nodes + links). */}
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
        }}
      >
        <SvgConnections />

        {documents.map((doc) => (
          <DocumentNode key={doc.id} doc={doc} />
        ))}

        <AnimatePresence>
          {widgets.map((widget) => (
            <DraggableWidget key={widget.id} widget={widget} />
          ))}
        </AnimatePresence>
      </div>

      {/* Fixed UI overlays (dock, AI bar, zoom indicator) render above world. */}
      {children}

      <ZoomIndicator zoom={viewport.zoom} />
    </div>
  );
}

function ZoomIndicator({ zoom }: { zoom: number }) {
  const reset = useCanvasState((s) => s.resetViewport);
  return (
    <button
      onClick={reset}
      className="absolute bottom-5 left-5 z-20 rounded-lg border border-white/[0.08] bg-canvas-panel/80 px-2.5 py-1 text-[11px] font-medium tabular-nums text-zinc-400 backdrop-blur transition hover:text-zinc-100"
      title="Reset view"
    >
      {Math.round((zoom / 1) * 100)}%
      <span className="ml-1 text-zinc-600">
        ({ZOOM_MIN * 100}–{ZOOM_MAX * 100}%)
      </span>
    </button>
  );
}
