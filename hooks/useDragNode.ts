"use client";

import { useCallback, useRef, useState } from "react";
import { useCanvasState } from "./useCanvasState";

interface DragArgs {
  x: number;
  y: number;
  onMove: (x: number, y: number) => void;
  onStart?: () => void;
}

/**
 * Pointer-based dragging in canvas (world) space. Screen deltas are divided by
 * the live zoom factor so a node tracks the cursor 1:1 regardless of zoom.
 * Returns the pointer-down handler and a `dragging` flag for styling.
 */
export function useDragNode({ x, y, onMove, onStart }: DragArgs) {
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ px: 0, py: 0, x, y });

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ignore secondary buttons and interactive children opting out via data attr.
      if (e.button !== 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return;

      e.stopPropagation();
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      origin.current = { px: e.clientX, py: e.clientY, x, y };
      setDragging(true);
      onStart?.();

      const zoom = useCanvasState.getState().viewport.zoom;

      const handleMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - origin.current.px) / zoom;
        const dy = (ev.clientY - origin.current.py) / zoom;
        onMove(origin.current.x + dx, origin.current.y + dy);
      };

      const handleUp = () => {
        setDragging(false);
        window.removeEventListener("pointermove", handleMove);
        window.removeEventListener("pointerup", handleUp);
      };

      window.addEventListener("pointermove", handleMove);
      window.addEventListener("pointerup", handleUp);
    },
    [x, y, onMove, onStart]
  );

  return { onPointerDown, dragging };
}
