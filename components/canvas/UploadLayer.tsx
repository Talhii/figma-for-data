"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useCanvasState } from "@/hooks/useCanvasState";
import { ingestFile, isSupportedFile, ACCEPTED_EXTENSIONS } from "@/lib/ingest";
import type { IngestResponse } from "@/lib/types";
import { cn, uid } from "@/lib/utils";

type ToastKind = "loading" | "success" | "error";
interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
}

/**
 * Module A upload layer: drag-and-drop (anywhere on the canvas) + a trigger
 * button. Files are parsed/chunked client-side, dropped onto the canvas as
 * document nodes, and indexed via `/api/ingest`. Indexing status surfaces as
 * toasts that confirm the "N vectors, 1536-dim" insert (AC 1.1).
 */
export function UploadLayer() {
  const addSourceDocument = useCanvasState((s) => s.addSourceDocument);
  const [isDragging, setIsDragging] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);

  const pushToast = useCallback((kind: ToastKind, message: string) => {
    const id = uid("toast");
    setToasts((t) => [...t, { id, kind, message }]);
    return id;
  }, []);

  const updateToast = useCallback(
    (id: string, kind: ToastKind, message: string) => {
      setToasts((t) => t.map((x) => (x.id === id ? { ...x, kind, message } : x)));
      window.setTimeout(
        () => setToasts((t) => t.filter((x) => x.id !== id)),
        4000
      );
    },
    []
  );

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      const supported = files.filter(isSupportedFile);
      if (supported.length === 0) {
        const id = pushToast("error", "Unsupported file — use CSV, Markdown or TXT.");
        updateToast(id, "error", "Unsupported file — use CSV, Markdown or TXT.");
        return;
      }

      for (const file of supported) {
        const toastId = pushToast("loading", `Indexing ${file.name}…`);
        try {
          const { document, chunks, table } = await ingestFile(file);

          // Place the new node near the viewport center, cascaded so multiple
          // uploads don't stack.
          const { viewportCenter, documents } = useCanvasState.getState();
          const center = viewportCenter(window.innerWidth, window.innerHeight);
          const offset = documents.length * 30;
          document.x = center.x - 112 + offset;
          document.y = center.y - 58 + offset;
          addSourceDocument(document);

          const res = await fetch("/api/ingest", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              documentId: document.id,
              name: document.name,
              type: document.type,
              chunks,
              table,
            }),
          });
          if (!res.ok) throw new Error(`ingest failed (${res.status})`);
          const data: IngestResponse = await res.json();
          updateToast(
            toastId,
            "success",
            `Indexed ${file.name} · ${data.inserted} vectors (${data.dimensions}-dim · ${data.mode})`
          );
        } catch {
          updateToast(toastId, "error", `Couldn’t index ${file.name}`);
        }
      }
    },
    [addSourceDocument, pushToast, updateToast]
  );

  // Window-level drag listeners so the drop zone is the entire canvas without
  // an overlay that would block normal pointer interactions.
  useEffect(() => {
    const hasFiles = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files");

    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragging(true);
    };
    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onLeave = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current -= 1;
      if (dragDepth.current <= 0) setIsDragging(false);
    };
    const onDrop = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      dragDepth.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
    };

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, [handleFiles]);

  return (
    <>
      {/* Trigger button — sits just under the brand badge. */}
      <button
        onClick={() => inputRef.current?.click()}
        className="absolute left-5 top-[72px] z-30 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-canvas-panel/80 px-3 py-2 text-[12px] font-medium text-zinc-300 backdrop-blur-xl transition hover:border-accent-glow/40 hover:text-zinc-100"
      >
        <UploadCloud className="h-4 w-4 text-accent-glow" />
        Upload data
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_EXTENSIONS.join(",")}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Drag overlay */}
      <AnimatePresence>
        {isDragging && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-canvas-deep/70 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-accent-glow/50 bg-canvas-panel/80 px-12 py-10 shadow-glow">
              <UploadCloud className="h-8 w-8 text-accent-glow" />
              <p className="text-sm font-medium text-zinc-100">
                Drop to ingest into your canvas
              </p>
              <p className="text-xs text-zinc-500">CSV · Markdown · TXT</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="absolute bottom-5 right-5 z-40 flex w-[320px] flex-col gap-2">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              className={cn(
                "flex items-center gap-2.5 rounded-xl border bg-canvas-panel/90 px-3 py-2.5 text-xs backdrop-blur-xl",
                t.kind === "error"
                  ? "border-accent-rose/30 text-accent-rose"
                  : t.kind === "success"
                  ? "border-accent-emerald/30 text-zinc-200"
                  : "border-white/[0.08] text-zinc-300"
              )}
            >
              {t.kind === "loading" && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-glow" />
              )}
              {t.kind === "success" && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-accent-emerald" />
              )}
              {t.kind === "error" && (
                <XCircle className="h-4 w-4 shrink-0 text-accent-rose" />
              )}
              <span className="leading-snug">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
