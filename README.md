# Figma for Data — Interactive AI Spreadsheet & BI Canvas

A premium, high-fidelity, dark-mode infinite canvas workspace where unorganized business intelligence meets interactive RAG (Retrieval-Augmented Generation). Users can ingest data files, query an AI engine, and watch the platform dynamically spawn responsive visualization widgets, complete with glowing SVG citation lines mapping directly back to the source data nodes.

![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)
![React Flow Free Canvas](https://img.shields.io/badge/Canvas-Custom_Pan%2FZoom-6366f1?style=for-the-badge)
![License: MIT](https://img.shields.io/badge/License-MIT-34d399?style=for-the-badge)

---

## 💡 Key Features

- **Infinite Canvas Workspace:** Draggable, pannable, and zoomable dark-themed node grid canvas built for complex data visualization.
- **Structured LLM Routing Engine:** Structured JSON output routing that evaluates user intent and automatically chooses the best visual schema (`chart`, `spreadsheet`, or `text`).
- **Live Interactive Spreadsheet Widget:** Fully editable data grids featuring real-time footer aggregates and live math recalculations.
- **Visual Citation Mapping:** Renders dynamic, glowing SVG Bezier curves from the generated insight card back to the exact source documentation nodes upon hovering.
- **Guardrail Protection:** Robust context routing that triggers an elegant fallback state if queries bypass the system’s knowledge boundaries.

---

## 🛠️ Architectural Choice: Local-First & Cost-Isolated Simulation

To allow for public web deployment and remove token cost barriers and API-key exploitation risks, this architecture utilizes an **Enterprise Adapter Pattern**.

By default, the application runs on a high-fidelity local vector store and embedding simulation layer. However, the architecture is fully cloud-native: simply adding your credentials to `.env.local` instantly bridges the application to live OpenAI `text-embedding-3-small` pipelines and Supabase `pgvector` relational tables without altering a single line of frontend code.

### The contract every engine satisfies

Both the in-memory simulation and the (stubbed) cloud engine implement one interface. Callers — the ingestion route and the AI router — depend on the **interface**, never the implementation, so promotion to production is a configuration change, not a rewrite.

```ts
// lib/ragStore.ts
export interface RagEngine {
  readonly mode: "mock" | "live";
  getChunks(documentIds?: string[]): DocumentChunk[];
  getTable(documentId: string): SheetData | undefined;
  addDocument(id: string, chunks: DocumentChunk[], table?: SheetData): number;
  removeDocument(id: string): number;
}

// Selected once at startup from the environment — never branched per call site.
const mode = getEngineMode(); // "live" iff OPENAI_API_KEY && NEXT_PUBLIC_SUPABASE_URL
export const ragEngine: RagEngine =
  mode === "live" ? createLiveEngine() : createMockEngine();
```

When no credentials are present, the engine self-announces and runs the mock pipeline:

```text
[Figma for Data] Running in Cost-Isolated Local Simulation Mode —
no OPENAI_API_KEY / NEXT_PUBLIC_SUPABASE_URL detected; using the
high-fidelity mock pipeline.
```

### Engine modes

| Mode | Trigger | Retrieval | Embeddings | Cost |
| :--- | :--- | :--- | :--- | :--- |
| **Local Simulation** _(default)_ | No credentials | Deterministic keyword-overlap retriever (a `pgvector` stand-in) | Simulated · reports `1536-dim` | $0 — zero tokens |
| **Live (Cloud-Native)** | `OPENAI_API_KEY` + `NEXT_PUBLIC_SUPABASE_URL` | Supabase `pgvector` similarity search | OpenAI `text-embedding-3-small` (1536-dim) | Metered |

> The frontend, Zustand store, API contracts, and component tree are **identical** across modes. Flipping to live touches only `lib/ragStore.ts` and `app/api/ingest/route.ts`.

---

## 📦 Project Structure

```text
├── app/                       # Next.js App Router & API Route Handlers
│   ├── api/
│   │   ├── generate-widget/    # RAG → structured widget schema
│   │   └── ingest/             # Parse → embed → index (mock | Supabase)
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/                # UI & Canvas-specific React components
│   ├── canvas/                # InfiniteCanvas, AiActionBar, SvgConnections,
│   │                          #   DraggableWidget, FloatingDock, UploadLayer
│   └── widgets/               # ChartWidget, SpreadsheetWidget, InsightsWidget,
│                              #   ErrorCardWidget, DocumentNode, WidgetRenderer
├── hooks/                     # useCanvasState coordinate and connection tracker,
│                              #   useDragNode (zoom-aware pointer dragging)
└── lib/                       # Ingestion layers, RAG store adapters, and mock data
    ├── ingest.ts              # Client parse/chunk pipeline (CSV · MD · TXT)
    ├── ragStore.ts            # RagEngine adapter (mock + live) — the contract
    ├── vectorStore.ts         # Keyword-overlap retriever (pgvector stand-in)
    ├── aiAgentRouter.ts       # Intent → structured GeneratedWidgetSchema
    ├── supabaseClient.ts      # Cloud config + go-live notes
    ├── mockData.ts            # Seed corpus + embedded chunks
    └── types.ts               # Single source of truth for the domain + contracts
```

---

## 🧰 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 14 (App Router), React 18 |
| **Language** | TypeScript (`strict`) |
| **Styling** | Tailwind CSS, custom dark design system |
| **State** | Zustand (viewport, nodes, widgets, citation trace) |
| **Charts** | Recharts (bar · line · pie) |
| **Motion** | Framer Motion (materialization, fades, layout transitions) |
| **Icons** | lucide-react |
| **Backend (live path)** | Supabase `pgvector` · OpenAI `text-embedding-3-small` |

---

## 🚀 Getting Started

No API keys required — it runs instantly in Local Simulation Mode.

```bash
# 1. Install
npm install

# 2. Run the dev server → http://localhost:3000
npm run dev

# 3. Quality gates
npm run typecheck     # tsc --noEmit (strict)
npm run lint          # next lint
npm run build         # production build
```

### (Optional) Go live

```bash
cp .env.local.example .env.local
# Set OPENAI_API_KEY and NEXT_PUBLIC_SUPABASE_URL / ANON_KEY.
# The ingest response then reports  mode: "live"  automatically.
```

---

## 🧪 Try It

Type into the AI command bar (or click a suggestion chip):

| Prompt | Produces |
| :--- | :--- |
| `revenue trend by quarter` | Line chart |
| `market share as a pie chart` | Pie chart |
| `revenue by region as a table` | Editable spreadsheet w/ live totals |
| `summarize the churn drivers` | Text insight card |
| `what's the weather tomorrow` | **Guardrail** “no relevant data” card |

Then **drag a `.csv` / `.md` / `.txt` onto the canvas** to ingest your own data, **hover a widget's “sources” badge** to trace its citation lines, and **edit a spreadsheet cell** to watch the footer aggregates recalculate live.

---

## 🔄 How It Works

```text
Upload  ─▶  lib/ingest.ts         parse · chunk · keyword-embed (client)
        ─▶  POST /api/ingest      index into RagEngine  (mock | pgvector)

Query   ─▶  POST /api/generate-widget
        ─▶  vectorStore.retrieve  score chunks against the prompt
        ─▶  aiAgentRouter         intent → GeneratedWidgetSchema (JSON)
        ─▶  useCanvasState        spawn widget near viewport (no overlap)
        ─▶  SvgConnections        glowing Bézier citation lines to sources
```

---

## 📄 License

Released under the **MIT License** — free to use, modify, and learn from.
