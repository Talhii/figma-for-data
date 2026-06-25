"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  hasError: boolean;
  message?: string;
}

/**
 * Per-widget error boundary so a single malformed AI payload can't crash the
 * entire canvas — the widget degrades to an inline error card instead.
 */
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Render error",
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-accent-rose" />
          <p className="text-sm font-medium text-zinc-300">
            Couldn’t render this widget
          </p>
          <p className="max-w-[260px] text-xs text-zinc-500">
            {this.state.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
