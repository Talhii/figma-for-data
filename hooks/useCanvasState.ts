import { create } from "zustand";
import type {
  GeneratedWidgetSchema,
  Point,
  SourceDocument,
  Widget,
  WidgetData,
  WidgetType,
} from "@/lib/types";
import { MOCK_DOCUMENTS } from "@/lib/mockData";
import { clamp, uid } from "@/lib/utils";

/** Pan offset + zoom describing the canvas viewport transform. */
export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export const ZOOM_MIN = 0.35;
export const ZOOM_MAX = 2.5;

/** Default footprint for a freshly spawned widget. */
const WIDGET_SIZE: Record<WidgetType, { width: number; height: number }> = {
  chart: { width: 420, height: 320 },
  sheet: { width: 460, height: 320 },
  text: { width: 380, height: 300 },
  error: { width: 360, height: 200 },
};

function aiTypeToWidgetType(
  t: GeneratedWidgetSchema["widgetType"]
): WidgetType {
  if (t === "spreadsheet-grid") return "sheet";
  if (t === "text-insight") return "text";
  if (t === "error-card") return "error";
  return "chart";
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** True if two rects intersect once expanded by `gap` on every side. */
function overlaps(a: Rect, b: Rect, gap: number): boolean {
  return !(
    a.x + a.width + gap <= b.x ||
    b.x + b.width + gap <= a.x ||
    a.y + a.height + gap <= b.y ||
    b.y + b.height + gap <= a.y
  );
}

/**
 * Find a spot for a new widget that doesn't overlap any existing one. Searches
 * outward in rings from the desired anchor on a grid sized to the widget, so the
 * first free slot found is both close to the anchor and collision-free.
 */
function findFreeSlot(
  widgets: Widget[],
  desired: Point,
  size: { width: number; height: number }
): Point {
  const gap = 24;
  const stepX = size.width + gap;
  const stepY = size.height + gap;

  const fits = (x: number, y: number) =>
    !widgets.some((w) =>
      overlaps({ x, y, width: size.width, height: size.height }, w, gap)
    );

  if (fits(desired.x, desired.y)) return desired;

  for (let ring = 1; ring <= 8; ring++) {
    for (let dx = -ring; dx <= ring; dx++) {
      for (let dy = -ring; dy <= ring; dy++) {
        // Only walk the current ring's perimeter (closest slots first).
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const x = desired.x + dx * stepX;
        const y = desired.y + dy * stepY;
        if (fits(x, y)) return { x, y };
      }
    }
  }

  // Dense canvas fallback: a small cascade so it's still reachable.
  return { x: desired.x + widgets.length * 28, y: desired.y + widgets.length * 28 };
}

interface CanvasState {
  viewport: Viewport;
  documents: SourceDocument[];
  widgets: Widget[];

  /** Currently selected node id (widget or document). */
  selectedId: string | null;
  /** Widget whose source-trace connections should render (on hover/focus). */
  tracedWidgetId: string | null;

  // ── viewport ──────────────────────────────────────────────────────────
  setViewport: (v: Partial<Viewport>) => void;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (factor: number, focus: Point) => void;
  resetViewport: () => void;

  // ── selection / hover ────────────────────────────────────────────────
  select: (id: string | null) => void;
  setTracedWidget: (id: string | null) => void;

  // ── documents ────────────────────────────────────────────────────────
  moveDocument: (id: string, x: number, y: number) => void;
  addDocument: (doc: Omit<SourceDocument, "id">) => string;
  /** Add an already-built document node (id assigned by ingestion). */
  addSourceDocument: (doc: SourceDocument) => void;
  /** Remove a document and cascade-clean its widget links (AC 1.2). */
  removeDocument: (id: string) => void;

  // ── widgets ──────────────────────────────────────────────────────────
  moveWidget: (id: string, x: number, y: number) => void;
  removeWidget: (id: string) => void;
  /** Replace a widget's data payload (e.g. live spreadsheet edits). */
  updateWidgetData: (id: string, data: WidgetData) => void;
  /** Spawn a widget from an AI-generated schema at a canvas-space point. */
  spawnWidgetFromSchema: (schema: GeneratedWidgetSchema, at: Point) => string;

  /** Convenience: world-space center of the current viewport. */
  viewportCenter: (vw: number, vh: number) => Point;
}

export const useCanvasState = create<CanvasState>((set, get) => ({
  viewport: { x: 0, y: 0, zoom: 1 },
  documents: MOCK_DOCUMENTS,
  widgets: [],
  selectedId: null,
  tracedWidgetId: null,

  setViewport: (v) =>
    set((s) => ({ viewport: { ...s.viewport, ...v } })),

  panBy: (dx, dy) =>
    set((s) => ({
      viewport: { ...s.viewport, x: s.viewport.x + dx, y: s.viewport.y + dy },
    })),

  zoomAt: (factor, focus) =>
    set((s) => {
      const { x, y, zoom } = s.viewport;
      const next = clamp(zoom * factor, ZOOM_MIN, ZOOM_MAX);
      // Keep the world point under the cursor anchored while zooming.
      const worldX = (focus.x - x) / zoom;
      const worldY = (focus.y - y) / zoom;
      return {
        viewport: {
          zoom: next,
          x: focus.x - worldX * next,
          y: focus.y - worldY * next,
        },
      };
    }),

  resetViewport: () => set({ viewport: { x: 0, y: 0, zoom: 1 } }),

  select: (id) => set({ selectedId: id }),
  setTracedWidget: (id) => set({ tracedWidgetId: id }),

  moveDocument: (id, x, y) =>
    set((s) => ({
      documents: s.documents.map((d) => (d.id === id ? { ...d, x, y } : d)),
    })),

  addDocument: (doc) => {
    const id = uid("doc");
    set((s) => ({ documents: [...s.documents, { ...doc, id }] }));
    return id;
  },

  addSourceDocument: (doc) =>
    set((s) => ({ documents: [...s.documents, doc], selectedId: doc.id })),

  removeDocument: (id) =>
    set((s) => {
      const documents = s.documents.filter((d) => d.id !== id);
      // Cascade: strip the doc from every widget's links; drop widgets that
      // were sourced solely from it (their data no longer has a provenance).
      const widgets: Widget[] = [];
      for (const w of s.widgets) {
        if (!w.sourceIds.includes(id)) {
          widgets.push(w);
          continue;
        }
        const sourceIds = w.sourceIds.filter((x) => x !== id);
        if (sourceIds.length === 0) continue; // orphaned → remove
        widgets.push({ ...w, sourceIds });
      }
      return {
        documents,
        widgets,
        selectedId: s.selectedId === id ? null : s.selectedId,
        tracedWidgetId: null,
      };
    }),

  moveWidget: (id, x, y) =>
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, x, y } : w)),
    })),

  updateWidgetData: (id, data) =>
    set((s) => ({
      widgets: s.widgets.map((w) => (w.id === id ? { ...w, data } : w)),
    })),

  removeWidget: (id) =>
    set((s) => ({
      widgets: s.widgets.filter((w) => w.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
      tracedWidgetId: s.tracedWidgetId === id ? null : s.tracedWidgetId,
    })),

  spawnWidgetFromSchema: (schema, at) => {
    const id = uid("w");
    const type = aiTypeToWidgetType(schema.widgetType);
    const size = WIDGET_SIZE[type];
    // Place near the requested anchor but never overlapping an existing widget.
    const slot = findFreeSlot(get().widgets, at, size);
    const widget: Widget = {
      id,
      type,
      x: slot.x,
      y: slot.y,
      width: size.width,
      height: size.height,
      title: schema.title,
      data: schema.cleanData,
      sourceIds: schema.sourceIds,
      sourceChunkIds: schema.sourceChunkIds,
      createdAt: Date.now(),
    };
    set((s) => ({ widgets: [...s.widgets, widget], selectedId: id }));
    return id;
  },

  viewportCenter: (vw, vh) => {
    const { x, y, zoom } = get().viewport;
    return { x: (vw / 2 - x) / zoom, y: (vh / 2 - y) / zoom };
  },
}));
