"use client";

import { useCanvasState } from "@/hooks/useCanvasState";

// Approximate footprint of a DocumentNode (w-56 card). Used to anchor the
// connection at the node's center without measuring the DOM each frame.
const DOC_W = 224;
const DOC_H = 96;

interface Endpoint {
  x: number;
  y: number;
}

/** Smooth horizontal S-curve between two world-space points. */
function curve(a: Endpoint, b: Endpoint): string {
  const cx = (b.x - a.x) / 2;
  return `M ${a.x} ${a.y} C ${a.x + cx} ${a.y}, ${b.x - cx} ${b.y}, ${b.x} ${b.y}`;
}

/**
 * Renders glowing gradient links from the currently-traced widget to each of
 * its source document nodes. Mounts inside the transformed world layer so it
 * inherits the canvas pan/zoom coordinate system — endpoints are pure world
 * coordinates pulled from the store.
 */
export function SvgConnections() {
  const tracedId = useCanvasState((s) => s.tracedWidgetId);
  const selectedId = useCanvasState((s) => s.selectedId);
  const widgets = useCanvasState((s) => s.widgets);
  const documents = useCanvasState((s) => s.documents);

  // Trace the hovered widget, or the selected one (so links stay visible and
  // recompute live while a card is dragged). Subscribing to `widgets` +
  // `documents` means any position change re-renders and re-derives the curve.
  const activeId = tracedId ?? selectedId;
  const widget = widgets.find((w) => w.id === activeId);
  if (!widget || widget.sourceIds.length === 0) return null;

  const widgetCenter: Endpoint = {
    x: widget.x + widget.width / 2,
    y: widget.y + widget.height / 2,
  };

  const links = widget.sourceIds
    .map((id) => documents.find((d) => d.id === id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map((doc) => ({
      id: doc.id,
      from: { x: doc.x + DOC_W / 2, y: doc.y + DOC_H / 2 },
      to: widgetCenter,
    }));

  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
      width={0}
      height={0}
      aria-hidden
    >
      <defs>
        <linearGradient id="link-gradient" gradientUnits="userSpaceOnUse"
          x1={0} y1={0} x2={1} y2={0}>
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="link-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {links.map((link) => {
        const d = curve(link.from, link.to);
        return (
          <g key={link.id} filter="url(#link-glow)">
            {/* Soft underlay glow */}
            <path
              d={d}
              fill="none"
              stroke="url(#link-gradient)"
              strokeWidth={6}
              strokeOpacity={0.18}
              strokeLinecap="round"
            />
            {/* Crisp animated core */}
            <path
              d={d}
              fill="none"
              stroke="url(#link-gradient)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeDasharray="6 8"
              className="animate-dash-flow"
            />
            {/* Anchor pucks */}
            <circle cx={link.from.x} cy={link.from.y} r={4} fill="#22d3ee" />
            <circle cx={link.to.x} cy={link.to.y} r={4} fill="#818cf8" />
          </g>
        );
      })}
    </svg>
  );
}
