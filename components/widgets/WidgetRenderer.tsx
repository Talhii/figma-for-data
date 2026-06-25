"use client";

import type {
  ChartData,
  ErrorData,
  SheetData,
  TextInsightData,
  Widget,
} from "@/lib/types";
import { ChartWidget } from "./ChartWidget";
import { SpreadsheetWidget } from "./SpreadsheetWidget";
import { InsightsWidget } from "./InsightsWidget";
import { ErrorCardWidget } from "./ErrorCardWidget";
import { WidgetErrorBoundary } from "./WidgetErrorBoundary";

/**
 * Dispatches a widget to its concrete renderer based on `type`, wrapped in an
 * error boundary so malformed AI payloads fail in isolation.
 */
export function WidgetRenderer({ widget }: { widget: Widget }) {
  return (
    <WidgetErrorBoundary title={widget.title}>
      {widget.type === "chart" && (
        <ChartWidget data={widget.data as ChartData} />
      )}
      {widget.type === "sheet" && (
        <SpreadsheetWidget widgetId={widget.id} data={widget.data as SheetData} />
      )}
      {widget.type === "text" && (
        <InsightsWidget data={widget.data as TextInsightData} />
      )}
      {widget.type === "error" && (
        <ErrorCardWidget data={widget.data as ErrorData} />
      )}
    </WidgetErrorBoundary>
  );
}
