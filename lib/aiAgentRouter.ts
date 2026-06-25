import type {
  AiWidgetType,
  ChartData,
  ChartKind,
  DataRow,
  GeneratedWidgetSchema,
  SheetData,
  TextInsightData,
  WidgetData,
} from "@/lib/types";
import { colorAt } from "@/lib/palette";
import {
  retrieve,
  singularize,
  tokenize,
  type RetrievedChunk,
} from "@/lib/vectorStore";
import { getChunks, getTable } from "@/lib/ragStore";

// ─────────────────────────────────────────────────────────────────────────────
// Mock AI agent router (Phase 2).
//
// Emulates an OpenAI structured-output / function-call: given a prompt + the
// RAG-retrieved chunks, it picks a widget type and returns a normalized,
// ready-to-render data array (`GeneratedWidgetSchema`). The contract matches
// what a live LLM call would return, so `app/api/generate-widget` can switch to
// real inference without touching the client.
// ─────────────────────────────────────────────────────────────────────────────

type Topic =
  | "revenue-quarter"
  | "revenue-region"
  | "margin"
  | "feature-adoption"
  | "roadmap"
  | "market-share"
  | "churn-drivers"
  | "nps"
  | "retention-cohort"
  | "engagement";

/** Maps a retrieved chunk to the analytical topic it can power. */
const CHUNK_TOPIC: Record<string, Topic> = {
  "chunk-fin-1": "revenue-quarter",
  "chunk-fin-2": "revenue-region",
  "chunk-fin-3": "margin",
  "chunk-prod-1": "feature-adoption",
  "chunk-prod-2": "roadmap",
  "chunk-mkt-1": "market-share",
  "chunk-mkt-2": "churn-drivers",
  "chunk-mkt-3": "nps",
  "chunk-usr-1": "retention-cohort",
  "chunk-usr-2": "engagement",
};

interface TopicConfig {
  title: string;
  xKey: string;
  /** Numeric series available for chart/sheet rendering. */
  series: { key: string; label: string }[];
  rows: DataRow[];
  /** The chart shape that best fits this topic when the user is unspecific. */
  naturalKind: ChartKind;
  insight: TextInsightData;
}

const TOPICS: Record<Topic, TopicConfig> = {
  "revenue-quarter": {
    title: "Revenue & Profit by Quarter",
    xKey: "quarter",
    series: [
      { key: "revenue", label: "Revenue ($M)" },
      { key: "profit", label: "Profit ($M)" },
    ],
    rows: [
      { quarter: "Q1", revenue: 2.1, profit: 0.6 },
      { quarter: "Q2", revenue: 2.8, profit: 0.9 },
      { quarter: "Q3", revenue: 3.2, profit: 1.1 },
      { quarter: "Q4", revenue: 3.8, profit: 1.4 },
    ],
    naturalKind: "line",
    insight: {
      summary:
        "Revenue climbed 81% across the fiscal year, from $2.1M in Q1 to $3.8M in Q4, with profit expanding faster than top-line.",
      bullets: [
        "Q4 was the strongest quarter at $3.8M revenue / $1.4M profit.",
        "Profit margin widened from 29% (Q1) to 37% (Q4).",
        "Enterprise expansion was the primary growth driver.",
      ],
      metrics: [
        { label: "FY Revenue", value: "$11.9M", delta: "+81%" },
        { label: "Q4 Margin", value: "37%", delta: "+8pt" },
      ],
    },
  },
  "revenue-region": {
    title: "Revenue by Region",
    xKey: "region",
    series: [{ key: "revenue", label: "Revenue ($M)" }],
    rows: [
      { region: "North America", revenue: 5.4 },
      { region: "EMEA", revenue: 3.1 },
      { region: "APAC", revenue: 2.0 },
      { region: "LATAM", revenue: 0.9 },
    ],
    naturalKind: "bar",
    insight: {
      summary:
        "North America accounts for 47% of revenue; LATAM remains the largest untapped opportunity.",
      bullets: [
        "North America led at $5.4M (47% of total).",
        "EMEA contributed $3.1M with the fastest QoQ acceleration.",
        "LATAM trails at $0.9M — a whitespace for 2025.",
      ],
      metrics: [{ label: "Top Region", value: "North America", delta: "47%" }],
    },
  },
  margin: {
    title: "Gross Margin Trend",
    xKey: "quarter",
    series: [{ key: "margin", label: "Gross Margin (%)" }],
    rows: [
      { quarter: "Q1", margin: 65 },
      { quarter: "Q2", margin: 67 },
      { quarter: "Q3", margin: 69 },
      { quarter: "Q4", margin: 71 },
    ],
    naturalKind: "line",
    insight: {
      summary:
        "Gross margin improved 6 points to 71% by Q4 as operating expenses held at 62% of revenue.",
      bullets: [
        "Margin expanded every quarter — a healthy efficiency signal.",
        "Opex discipline held spend flat against rising revenue.",
      ],
      metrics: [{ label: "Q4 Gross Margin", value: "71%", delta: "+6pt" }],
    },
  },
  "feature-adoption": {
    title: "Feature Adoption",
    xKey: "feature",
    series: [{ key: "adoption", label: "Adoption (%)" }],
    rows: [
      { feature: "Dashboards", adoption: 82 },
      { feature: "Automations", adoption: 64 },
      { feature: "Collaboration", adoption: 58 },
      { feature: "AI Insights", adoption: 41 },
      { feature: "Mobile", adoption: 33 },
    ],
    naturalKind: "bar",
    insight: {
      summary:
        "Dashboards are near-universal (82%), while AI Insights and Mobile are the biggest activation opportunities.",
      bullets: [
        "Dashboards lead adoption at 82%.",
        "AI Insights (41%) and Mobile (33%) lag — onboarding focus areas.",
      ],
      metrics: [{ label: "Top Feature", value: "Dashboards", delta: "82%" }],
    },
  },
  roadmap: {
    title: "Roadmap Priorities",
    xKey: "item",
    series: [{ key: "rank", label: "Priority" }],
    rows: [
      { item: "Real-time sync", rank: 1 },
      { item: "Granular permissions", rank: 2 },
      { item: "Embeddable SDK", rank: 3 },
    ],
    naturalKind: "bar",
    insight: {
      summary:
        "The next two quarters focus on real-time sync, granular permissions, and an embeddable SDK.",
      bullets: [
        "Real-time sync is the top commitment.",
        "Granular permissions unblock enterprise deals.",
        "An embeddable SDK opens a new distribution channel.",
      ],
    },
  },
  "market-share": {
    title: "Market Share",
    xKey: "vendor",
    series: [{ key: "share", label: "Share (%)" }],
    rows: [
      { vendor: "Our Product", share: 28 },
      { vendor: "Competitor A", share: 34 },
      { vendor: "Competitor B", share: 21 },
      { vendor: "Others", share: 17 },
    ],
    naturalKind: "pie",
    insight: {
      summary:
        "We hold 28% share, trailing Competitor A by 6 points but leading Competitor B.",
      bullets: [
        "Competitor A leads at 34%.",
        "We sit second at 28% and are gaining.",
        "The long tail ('Others') is 17% — consolidation upside.",
      ],
      metrics: [{ label: "Our Share", value: "28%", delta: "+3pt YoY" }],
    },
  },
  "churn-drivers": {
    title: "Churn Drivers",
    xKey: "driver",
    series: [{ key: "weight", label: "Share of churn (%)" }],
    rows: [
      { driver: "Onboarding friction", weight: 38 },
      { driver: "Missing integrations", weight: 27 },
      { driver: "Pricing", weight: 22 },
      { driver: "Support latency", weight: 13 },
    ],
    naturalKind: "bar",
    insight: {
      summary:
        "Onboarding friction drives 38% of churn — the single highest-leverage retention fix.",
      bullets: [
        "Onboarding friction (38%) dominates churn.",
        "Missing integrations (27%) is the second driver.",
        "Pricing and support latency are smaller, addressable factors.",
      ],
      metrics: [{ label: "Top Driver", value: "Onboarding", delta: "38%" }],
    },
  },
  nps: {
    title: "Net Promoter Score",
    xKey: "period",
    series: [{ key: "nps", label: "NPS" }],
    rows: [
      { period: "Last Year", nps: 31 },
      { period: "This Year", nps: 48 },
    ],
    naturalKind: "bar",
    insight: {
      summary:
        "NPS jumped from 31 to 48 year-over-year, with enterprise outpacing SMB by 14 points.",
      bullets: [
        "+17 point NPS gain YoY.",
        "Enterprise NPS leads SMB by 14 points.",
      ],
      metrics: [{ label: "NPS", value: "48", delta: "+17" }],
    },
  },
  "retention-cohort": {
    title: "Monthly Retention by Cohort",
    xKey: "month",
    series: [{ key: "retention", label: "Retention (%)" }],
    rows: [
      { month: "M1", retention: 88 },
      { month: "M2", retention: 79 },
      { month: "M3", retention: 73 },
      { month: "M4", retention: 69 },
      { month: "M5", retention: 66 },
      { month: "M6", retention: 64 },
    ],
    naturalKind: "line",
    insight: {
      summary:
        "Retention stabilizes around 64% by month six after the steepest drop between M1 and M2.",
      bullets: [
        "Biggest fall is M1→M2 (88%→79%).",
        "The curve flattens after M4, signaling a sticky core.",
      ],
      metrics: [{ label: "M6 Retention", value: "64%" }],
    },
  },
  engagement: {
    title: "Daily Active Users",
    xKey: "week",
    series: [{ key: "dau", label: "DAU" }],
    rows: [
      { week: "W1", dau: 14200 },
      { week: "W2", dau: 15500 },
      { week: "W3", dau: 16900 },
      { week: "W4", dau: 18400 },
    ],
    naturalKind: "line",
    insight: {
      summary:
        "DAU grew 30% over the month to 18,400, lifting the DAU/MAU ratio to 0.42.",
      bullets: [
        "DAU reached 18,400 (+30% MoM).",
        "DAU/MAU of 0.42 indicates strong daily stickiness.",
      ],
      metrics: [
        { label: "DAU", value: "18.4K", delta: "+30%" },
        { label: "DAU/MAU", value: "0.42" },
      ],
    },
  },
};

type Format = "chart-bar" | "chart-line" | "chart-pie" | "sheet" | "text";

/** Decide the output format from explicit prompt cues, else a natural default. */
function resolveFormat(prompt: string, naturalKind: ChartKind): Format {
  const p = prompt.toLowerCase();

  // Note: stems use \w* (not a trailing \b) so "summarize"/"insights"/"trends"
  // all match — `summar\b` would fail on "summarize" (no boundary mid-word).
  if (/\b(table|grid|spreadsheet|sheet|rows|tabular)\b|raw data/.test(p))
    return "sheet";
  if (
    /\b(summar\w*|insight\w*|explain\w*|overview|takeaway\w*|highlight\w*|tldr|brief\w*|why)\b|tell me/.test(
      p
    )
  )
    return "text";
  if (/\b(pie|share|split|distribution|proportion|breakdown|composition)\b/.test(p))
    return "chart-pie";
  if (/\b(line|trend\w*|trajectory|growth|momentum|history)\b|over time/.test(p))
    return "chart-line";
  if (/\b(bar|compare|comparison|ranking|by)\b/.test(p)) return "chart-bar";

  // No explicit cue → fall back to the natural shape for this data.
  if (naturalKind === "line") return "chart-line";
  if (naturalKind === "pie") return "chart-pie";
  return "chart-bar";
}

function buildChart(cfg: TopicConfig, kind: ChartKind): ChartData {
  return {
    kind,
    xKey: cfg.xKey,
    series: cfg.series.map((s, i) => ({ ...s, color: colorAt(i) })),
    rows: cfg.rows,
  };
}

function buildSheet(cfg: TopicConfig): SheetData {
  return {
    columns: [
      { key: cfg.xKey, label: titleCase(cfg.xKey) },
      ...cfg.series.map((s) => ({ key: s.key, label: s.label })),
    ],
    rows: cfg.rows,
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function chartDataFor(cfg: TopicConfig, format: Format): WidgetData {
  if (format === "chart-pie") return buildChart(cfg, "pie");
  if (format === "chart-line") return buildChart(cfg, "line");
  return buildChart(cfg, "bar");
}

function aiTypeForFormat(format: Format): AiWidgetType {
  switch (format) {
    case "sheet":
      return "spreadsheet-grid";
    case "text":
      return "text-insight";
    case "chart-pie":
      return "pie-chart";
    case "chart-line":
      return "line-chart";
    default:
      return "bar-chart";
  }
}

/** Columns whose values are numeric in the majority of rows. */
function numericColumns(table: SheetData): { key: string; label: string }[] {
  return table.columns.filter((col) => {
    const numeric = table.rows.filter(
      (r) => typeof r[col.key] === "number"
    ).length;
    return numeric >= Math.ceil(table.rows.length / 2) && numeric > 0;
  });
}

/** Build a widget from an uploaded CSV's real tabular data. */
function buildFromTable(
  table: SheetData,
  prompt: string,
  title: string
): { widgetType: AiWidgetType; cleanData: WidgetData } {
  const numeric = numericColumns(table);
  const numericKeys = new Set(numeric.map((c) => c.key));
  // X axis = first non-numeric column, else the first column.
  const xCol =
    table.columns.find((c) => !numericKeys.has(c.key)) ?? table.columns[0];

  // No numeric columns to plot → present the grid.
  if (numeric.length === 0) {
    return { widgetType: "spreadsheet-grid", cleanData: table };
  }

  const format = resolveFormat(prompt, "bar");

  if (format === "sheet") {
    return { widgetType: "spreadsheet-grid", cleanData: table };
  }

  if (format === "text") {
    const col = numeric[0];
    const values = table.rows
      .map((r) => r[col.key])
      .filter((v): v is number => typeof v === "number");
    const total = values.reduce((a, b) => a + b, 0);
    const avg = values.length ? total / values.length : 0;
    return {
      widgetType: "text-insight",
      cleanData: {
        summary: `“${title}” has ${table.rows.length} rows across ${table.columns.length} columns. ${col.label} totals ${round(total)} (avg ${round(avg)}).`,
        bullets: [
          `Highest ${col.label}: ${round(Math.max(...values))}.`,
          `Lowest ${col.label}: ${round(Math.min(...values))}.`,
          `Category column: ${xCol.label}.`,
        ],
        metrics: [
          { label: `Total ${col.label}`, value: round(total).toString() },
          { label: "Rows", value: table.rows.length.toString() },
        ],
      },
    };
  }

  const kind: ChartKind =
    format === "chart-pie" ? "pie" : format === "chart-line" ? "line" : "bar";
  // Pie shows a single series; bar/line can show all numeric series.
  const series = (kind === "pie" ? numeric.slice(0, 1) : numeric).map(
    (c, i) => ({ key: c.key, label: c.label, color: colorAt(i) })
  );
  return {
    widgetType: aiTypeForFormat(format),
    cleanData: { kind, xKey: xCol.key, series, rows: table.rows },
  };
}

function round(n: number): number {
  // Defensive: never let a NaN/Infinity reach the chart schema.
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Build a text-insight from the raw retrieved chunks of an uploaded doc. */
function buildTextFromChunks(
  retrieved: RetrievedChunk[],
  title: string
): TextInsightData {
  const top = retrieved[0].chunk.content;
  const bullets = retrieved
    .slice(1, 4)
    .map((r) => truncate(r.chunk.content, 160));
  return {
    summary: truncate(top, 320),
    bullets: bullets.length ? bullets : [`From “${title}”.`],
    metrics: [{ label: "Cited passages", value: retrieved.length.toString() }],
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

function titleFromPrompt(prompt: string): string {
  const t = prompt.trim().replace(/[?.!]+$/, "");
  return t.charAt(0).toUpperCase() + t.slice(1, 64);
}

// ── Analytical aggregation engine (over real uploaded tables) ─────────────────

interface Analysis {
  widgetType: AiWidgetType;
  title: string;
  cleanData: WidgetData;
}

/** Columns that are identifiers / free-text and make poor group-by dimensions. */
const NON_DIMENSION = /\b(id|email|e-mail|phone|website|url|link|name|date|index)\b/i;

function numericKeySet(table: SheetData): Set<string> {
  return new Set(numericColumns(table).map((c) => c.key));
}

function labelTokens(label: string): string[] {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map(singularize);
}

/** Safe numeric coercion — strings, currency, blanks never yield NaN. */
function num(v: unknown): number {
  const n = parseFloat(String(v ?? "").replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Column-synonym map: prompt vocabulary the user might use → a regex matching
 * the closest structural column header. Lets "area"/"zone" resolve to Region,
 * "earnings" to Revenue/Amount, etc.
 */
const COLUMN_SYNONYMS: { triggers: string[]; match: RegExp }[] = [
  { triggers: ["area", "zone", "location", "place", "territory", "geography", "market"], match: /region|area|zone|location|territory|market|district/i },
  { triggers: ["country", "nation"], match: /countr|nation/i },
  { triggers: ["city", "town"], match: /city|town|municipal/i },
  { triggers: ["earnings", "revenue", "sales", "income", "turnover", "takings", "money"], match: /amount|revenue|sales|income|earning|turnover|price|value|total|gross|net/i },
  { triggers: ["cost", "expense", "spend", "spending"], match: /cost|expense|spend|outlay/i },
  { triggers: ["category", "type", "kind", "segment", "class", "group"], match: /categor|type|kind|segment|class|group/i },
  { triggers: ["product", "item", "sku", "goods", "merchandise"], match: /product|item|sku|goods|merchand/i },
  { triggers: ["status", "stage", "phase", "state"], match: /status|stage|phase|state/i },
  { triggers: ["customer", "client", "account", "buyer"], match: /customer|client|account|buyer/i },
  { triggers: ["quantity", "qty", "units", "volume"], match: /quantity|qty|unit|volume|count/i },
];

const isMeasureLike = (label: string) =>
  /amount|price|revenue|sales|income|cost|value|spend|profit|margin|salary|pay|fee|balance|earning|turnover|gross|net/i.test(
    label
  );

/**
 * Resolve a prompt to a column by synonym. `wantNumeric` constrains the result
 * to numeric (measure) or categorical (dimension) columns.
 */
function columnBySynonym(
  table: SheetData,
  promptTokens: Set<string>,
  wantNumeric: boolean
): { key: string; label: string } | null {
  const numeric = numericKeySet(table);
  const candidates = table.columns.filter((c) =>
    wantNumeric
      ? numeric.has(c.key) && !/\b(id|index)\b/i.test(c.label)
      : !numeric.has(c.key) && !NON_DIMENSION.test(c.label) && !NON_DIMENSION.test(c.key)
  );
  for (const group of COLUMN_SYNONYMS) {
    if (!group.triggers.some((t) => promptTokens.has(singularize(t)))) continue;
    const hit = candidates.find((c) => group.match.test(c.label));
    if (hit) return hit;
  }
  return null;
}

/** Categorical column matching the prompt by exact header token, else synonym. */
function findDimensionColumn(
  table: SheetData,
  promptTokens: Set<string>
): { key: string; label: string } | null {
  const numeric = numericKeySet(table);
  for (const col of table.columns) {
    if (numeric.has(col.key)) continue;
    if (NON_DIMENSION.test(col.label) || NON_DIMENSION.test(col.key)) continue;
    if (labelTokens(col.label).some((t) => promptTokens.has(t))) return col;
  }
  return columnBySynonym(table, promptTokens, false);
}

const DATE_RE = /^\d{4}[-/]\d{1,2}([-/]\d{1,2})?/;

function findDateColumn(
  table: SheetData
): { key: string; label: string } | null {
  // Prefer an explicit "date" header, else a column whose values look like dates.
  const byLabel = table.columns.find((c) => /date/i.test(c.label));
  if (byLabel) return byLabel;
  return (
    table.columns.find((c) =>
      table.rows.some((r) => DATE_RE.test(String(r[c.key] ?? "")))
    ) ?? null
  );
}

type AggFunc = "sum" | "avg" | "count";

interface Agg {
  sum: number;
  count: number;
}

function aggValue(a: Agg, func: AggFunc, hasMeasure: boolean): number {
  if (!hasMeasure || func === "count") return a.count;
  if (func === "avg") return a.count ? a.sum / a.count : 0;
  return a.sum;
}

/** Series/metric label for the chosen function + measure. */
function aggLabel(func: AggFunc, measure?: string): string {
  if (func === "count" || !measure) return "Count";
  if (func === "avg") return `Avg ${measure}`;
  return `Total ${measure}`;
}

/** Numeric columns usable as measures (excludes identifier columns). */
function measureColumns(table: SheetData): { key: string; label: string }[] {
  return numericColumns(table).filter(
    (c) => !/\b(id|index)\b/i.test(c.label) && !/\b(id|index)\b/i.test(c.key)
  );
}

const MEASURE_WORD =
  /\b(amount|price|revenue|sales|cost|value|spend|spending|quantity|qty|profit|margin|salary|pay|fee|turnover|sum|gross|net)\b/;

/** Resolve the numeric measure the prompt is asking about (named, synonym, else primary). */
function detectMeasure(
  table: SheetData,
  promptTokens: Set<string>,
  p: string
): { key: string; label: string } | null {
  // 1) Explicitly named — any numeric column, including Index, if the user
  //    actually names it ("sum of index").
  for (const c of numericColumns(table)) {
    if (labelTokens(c.label).some((t) => promptTokens.has(t))) return c;
  }
  const measures = measureColumns(table);
  if (measures.length === 0) return null;
  // 2) Synonym ("earnings" → Amount/Revenue).
  const syn = columnBySynonym(table, promptTokens, true);
  if (syn) return syn;
  // 3) A money/measure word with no exact column → the primary money column.
  if (MEASURE_WORD.test(p)) {
    return measures.find((c) => isMeasureLike(c.label)) ?? measures[0];
  }
  return null;
}

/**
 * Group `rows` by `dimKey`, aggregating `measureKey` with `func` (or counting),
 * sorted descending, Top-N with an "Other" rollup. The aggregated value is
 * emitted under the `value` key so the chart schema stays uniform.
 */
function aggregateBy(
  rows: DataRow[],
  dimKey: string,
  measureKey: string | null,
  func: AggFunc,
  limit: number
): DataRow[] {
  const groups = new Map<string, Agg>();
  for (const r of rows) {
    const v = r[dimKey];
    const k = v === "" || v == null ? "(blank)" : String(v);
    const g = groups.get(k) ?? { sum: 0, count: 0 };
    g.count += 1;
    if (measureKey) g.sum += num(r[measureKey]);
    groups.set(k, g);
  }
  const hasMeasure = Boolean(measureKey);
  const entries = [...groups.entries()]
    .map(([k, g]) => ({ k, g, value: aggValue(g, func, hasMeasure) }))
    .sort((a, b) => b.value - a.value);

  const out: DataRow[] = entries
    .slice(0, limit)
    .map((e) => ({ [dimKey]: e.k, value: round(e.value) }));
  const rest = entries.slice(limit);
  if (rest.length) {
    const acc = rest.reduce<Agg>(
      (s, e) => ({ sum: s.sum + e.g.sum, count: s.count + e.g.count }),
      { sum: 0, count: 0 }
    );
    out.push({
      [dimKey]: `Other (${rest.length})`,
      value: round(aggValue(acc, func, hasMeasure)),
    });
  }
  return out;
}

/** Bucket rows by YYYY-MM, aggregating a measure (or counting), chronological. */
function bucketByMonth(
  rows: DataRow[],
  dateKey: string,
  measureKey: string | null,
  func: AggFunc
): DataRow[] {
  const buckets = new Map<string, Agg>();
  for (const r of rows) {
    const m = String(r[dateKey] ?? "").match(/^(\d{4})[-/](\d{1,2})/);
    if (!m) continue;
    const period = `${m[1]}-${m[2].padStart(2, "0")}`;
    const g = buckets.get(period) ?? { sum: 0, count: 0 };
    g.count += 1;
    if (measureKey) g.sum += num(r[measureKey]);
    buckets.set(period, g);
  }
  const hasMeasure = Boolean(measureKey);
  return [...buckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([period, g]) => ({ period, value: round(aggValue(g, func, hasMeasure)) }));
}

/** Aggregate a single measure across all given rows (sum / avg). */
function aggregateAll(rows: DataRow[], measureKey: string, func: AggFunc): number {
  let sum = 0;
  for (const r of rows) sum += num(r[measureKey]);
  return aggValue({ sum, count: rows.length }, func, true);
}

function titleCasePhrase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Words that look like filter values but are really meta-references. */
const META_VALUE = /^(dataset|data|table|file|spreadsheet|grid|chart|record|records|row|rows|here|it|them)$/;

/**
 * Detect a "find/where" filter ("customers from the United States", "in Canada",
 * "where country is X") and return the matching rows. Only fires when the
 * extracted phrase actually matches values in a categorical column — so generic
 * phrasing ("in the dataset") harmlessly falls through.
 */
function detectFilter(
  table: SheetData,
  prompt: string
): { col: { key: string; label: string }; phrase: string; rows: DataRow[] } | null {
  const p = prompt.toLowerCase().trim();
  const promptSet = new Set(p.split(/[^a-z0-9]+/).filter(Boolean));
  const numeric = numericKeySet(table);
  const filterable = (col: { key: string; label: string }) =>
    !numeric.has(col.key) &&
    !/\b(id|email|phone|website|url|index)\b/i.test(col.label);

  // (A) Explicit phrase after "from / in / where … is" — handles a query phrase
  // that is a *partial* of a longer value ("united states" ⊂ "United States of
  // America"). The value must contain the whole phrase or every phrase word.
  let candidate: string | null = null;
  const whereMatch = p.match(
    /where\s+[a-z0-9 ]+?\s+(?:is|are|=|equals|equal to)\s+(.+)$/
  );
  const fromMatch = p.match(/\b(?:from|in|located in|based in)\s+(.+)$/);
  if (whereMatch) candidate = whereMatch[1];
  else if (fromMatch) candidate = fromMatch[1];
  if (candidate) {
    candidate = candidate
      .replace(/[.?!,;:]+$/g, "")
      .replace(/^(the|a|an|this|that|these|those)\s+/g, "")
      .trim();
    const candTokens = candidate.split(/[^a-z0-9]+/).filter(Boolean);
    if (candidate.length >= 2 && !META_VALUE.test(candidate) && candTokens.length) {
      for (const col of table.columns) {
        if (!filterable(col)) continue;
        const rows = table.rows.filter((r) => {
          const v = String(r[col.key] ?? "").toLowerCase();
          if (!v) return false;
          if (v.includes(candidate!)) return true;
          const vTokens = v.split(/[^a-z0-9]+/).filter(Boolean);
          return candTokens.every((t) => vTokens.includes(t));
        });
        if (rows.length) return { col, phrase: candidate, rows };
      }
    }
  }

  // (B) A categorical value named directly anywhere in the prompt ("how many
  // are Shipped", "orders in the East region"). Scan distinct values; a value
  // matches when each of its significant tokens appears in the prompt. The most
  // specific (longest) value wins. Exact equality is used for the row match.
  let best: {
    col: { key: string; label: string };
    value: string;
    rows: DataRow[];
  } | null = null;
  for (const col of table.columns) {
    if (!filterable(col)) continue;
    const distinct = new Set(
      table.rows.map((r) => String(r[col.key] ?? "")).filter(Boolean)
    );
    for (const value of distinct) {
      const vLower = value.toLowerCase();
      const vTokens = vLower.split(/[^a-z0-9]+/).filter((t) => t.length >= 3);
      if (vTokens.length === 0) continue;
      if (!vTokens.every((t) => promptSet.has(t))) continue;
      if (!best || vLower.length > best.value.toLowerCase().length) {
        const rows = table.rows.filter(
          (r) => String(r[col.key] ?? "").toLowerCase() === vLower
        );
        best = { col, value, rows };
      }
    }
  }
  if (best && best.rows.length) {
    return { col: best.col, phrase: best.value, rows: best.rows };
  }

  return null;
}

type CmpOp = ">" | ">=" | "<" | "<=" | "=";

function cmpFromWords(op: string): CmpOp {
  const o = op.trim();
  if (o === ">=" || /at least|greater than or equal|no less than|minimum/.test(o)) return ">=";
  if (o === "<=" || /at most|less than or equal|no more than|maximum/.test(o)) return "<=";
  if (o === ">" || /greater than|more than|over|above|exceed|bigger/.test(o)) return ">";
  if (o === "<" || /less than|fewer than|under|below|smaller/.test(o)) return "<";
  return "=";
}

function applyCmp(v: number, op: CmpOp, n: number): boolean {
  switch (op) {
    case ">": return v > n;
    case ">=": return v >= n;
    case "<": return v < n;
    case "<=": return v <= n;
    case "=": return v === n;
  }
}

interface NumFilter {
  col: { key: string; label: string };
  test: (v: number) => boolean;
  label: string;
}

/**
 * Detect a numeric comparison filter — "amount greater than 500", "qty >= 10",
 * "price between 100 and 200" — and resolve the column (by header or synonym).
 */
function detectNumericFilter(
  table: SheetData,
  prompt: string
): NumFilter | null {
  const p = prompt.toLowerCase();
  const numericCols = numericColumns(table);
  const resolve = (word: string) => {
    const t = singularize(word);
    return (
      numericCols.find((c) => labelTokens(c.label).includes(t)) ??
      columnBySynonym(table, new Set([t]), true)
    );
  };

  // between A and B
  let m = p.match(/\b([a-z]+)\s+(?:is\s+)?between\s+([\d,.]+)\s+and\s+([\d,.]+)/);
  if (m) {
    const col = resolve(m[1]);
    if (col) {
      const a = num(m[2]);
      const b = num(m[3]);
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      return { col, test: (v) => v >= lo && v <= hi, label: `${col.label} between ${a} and ${b}` };
    }
  }
  // word operator: "amount greater than 500"
  m = p.match(
    /\b([a-z]+)\s+(?:is\s+)?(greater than or equal to|less than or equal to|no less than|no more than|at least|at most|greater than|less than|more than|fewer than|over|above|under|below|exceeding|equal to|equals)\s+([\d,.]+)/
  );
  if (!m) {
    // symbol operator: "amount > 500", "qty>=10"
    m = p.match(/\b([a-z]+)\s*(>=|<=|>|<|=)\s*([\d,.]+)/);
  }
  if (m) {
    const col = resolve(m[1]);
    if (col) {
      const op = cmpFromWords(m[2]);
      const n = num(m[3]);
      return { col, test: (v) => applyCmp(v, op, n), label: `${col.label} ${op} ${n}` };
    }
  }
  return null;
}

/**
 * Extract a grouped/aggregated widget from a real table based on prompt intent:
 * numeric/value filters, count totals, SUM/AVG group-by Top-N (bar/pie), or
 * date-bucketed trends (line). Returns null when no analytical intent is
 * detected (caller falls back to raw shaping).
 */
function analyzeTable(table: SheetData, prompt: string): Analysis | null {
  if (table.rows.length === 0) return null;
  const p = prompt.toLowerCase();
  const promptTokens = new Set(tokenize(prompt));

  const wantsTrend = /\btrend|\bover time\b|\btimeline\b|by month|by year|monthly|yearly/.test(p);
  const wantsPie = /\bpie\b|distribution|breakdown|proportion|composition|\bsplit\b|\bshare\b/.test(p);
  const explicitCount = /\bhow many\b|\bnumber of\b|\bcount\b|\btally\b/.test(p);
  const avgWord = /\b(average|avg|mean)\b/.test(p);
  const sumWord = /\b(sum|total|combined|aggregate|revenue|sales|turnover|spend|spending|gross|net)\b/.test(p);

  const measureCol = detectMeasure(table, promptTokens, p);
  const dateCol = findDateColumn(table);
  const dimCol = findDimensionColumn(table, promptTokens);

  // Function: an explicit word wins; else a measure in play defaults to SUM
  // (for grouping/trends), otherwise COUNT. A standalone metric only renders
  // when a function word is explicit — so a bare filter shows rows, not a sum.
  const explicitFunc: AggFunc | null = explicitCount
    ? "count"
    : avgWord
    ? "avg"
    : sumWord
    ? "sum"
    : null;
  const func: AggFunc = explicitFunc ?? (measureCol ? "sum" : "count");

  // Filters (numeric comparison + categorical value) compose into active rows.
  const numF = detectNumericFilter(table, prompt);
  const valF = detectFilter(table, prompt);
  let activeRows = table.rows;
  if (numF) activeRows = activeRows.filter((r) => numF.test(num(r[numF.col.key])));
  if (valF) {
    const set = new Set(valF.rows);
    activeRows = activeRows.filter((r) => set.has(r));
  }
  const hasFilter = Boolean(numF || valF);
  const filterDescs: string[] = [];
  if (numF) filterDescs.push(numF.label);
  if (valF) filterDescs.push(`${valF.col.label} = “${titleCasePhrase(valF.phrase)}”`);
  const filterNote = filterDescs.length ? ` (where ${filterDescs.join(" and ")})` : "";

  const seriesLabel = aggLabel(func, measureCol?.label);
  const measureKey = measureCol?.key ?? null;

  // 1) Trend over time → line of the measure (or count) per month.
  if (wantsTrend && dateCol) {
    const rows = bucketByMonth(activeRows, dateCol.key, measureKey, func);
    if (rows.length) {
      return {
        widgetType: "line-chart",
        title: `${measureCol ? seriesLabel : "Records"} over time${filterNote}`,
        cleanData: {
          kind: "line",
          xKey: "period",
          series: [
            { key: "value", label: measureCol ? seriesLabel : "Records", color: colorAt(1) },
          ],
          rows,
        },
      };
    }
  }

  // 2) Group-by aggregation → Top-N bar/pie. Never group by the filtered column.
  if (dimCol && (!valF || dimCol.key !== valF.col.key)) {
    const rows = aggregateBy(activeRows, dimCol.key, measureKey, func, wantsPie ? 8 : 12);
    const kind: ChartKind = wantsPie ? "pie" : "bar";
    const verb = measureCol ? seriesLabel : "Records";
    return {
      widgetType: kind === "pie" ? "pie-chart" : "bar-chart",
      title: `${verb} by ${dimCol.label}${filterNote}`,
      cleanData: {
        kind,
        xKey: dimCol.key,
        series: [
          { key: "value", label: measureCol ? seriesLabel : "Count", color: colorAt(0) },
        ],
        rows,
      },
    };
  }

  // 3) Single aggregate metric — only on an explicit SUM/AVG of a measure, so a
  //    bare filter ("amount > 500") shows rows rather than silently summing.
  if (measureCol && (explicitFunc === "sum" || explicitFunc === "avg")) {
    const value = aggregateAll(activeRows, measureCol.key, explicitFunc);
    return {
      widgetType: "text-insight",
      title: seriesLabel,
      cleanData: {
        summary: `${seriesLabel} across ${activeRows.length} record${
          activeRows.length === 1 ? "" : "s"
        }${filterNote}: ${round(value).toLocaleString()}.`,
        bullets: [],
        metrics: [
          { label: seriesLabel, value: round(value).toLocaleString() },
          { label: "Records", value: activeRows.length.toLocaleString() },
        ],
      },
    };
  }

  // 4) Filter without aggregation → the matching rows (or their count).
  if (hasFilter) {
    const desc = filterDescs.join(" and ");
    if (explicitCount) {
      return {
        widgetType: "text-insight",
        title: "Matching records",
        cleanData: {
          summary: `${activeRows.length} record${
            activeRows.length === 1 ? "" : "s"
          } where ${desc}.`,
          bullets: [],
          metrics: [{ label: "Matches", value: activeRows.length.toString() }],
        },
      };
    }
    return {
      widgetType: "spreadsheet-grid",
      title: `${desc} · ${activeRows.length} found`,
      cleanData: { columns: table.columns, rows: activeRows },
    };
  }

  // 5) Plain count → headline metric card.
  if (explicitCount) {
    return {
      widgetType: "text-insight",
      title: "Total Records",
      cleanData: {
        summary: `This dataset contains ${table.rows.length} records across ${table.columns.length} fields.`,
        bullets: [`Fields: ${table.columns.map((c) => c.label).join(", ")}.`],
        metrics: [
          { label: "Total records", value: table.rows.length.toLocaleString() },
          { label: "Fields", value: table.columns.length.toString() },
        ],
      },
    };
  }

  return null;
}

/** Guardrail (AC 3.3): nothing relevant retrieved → an explicit error card. */
function errorSchema(prompt: string): GeneratedWidgetSchema {
  return {
    widgetType: "error-card",
    title: "No relevant data found",
    cleanData: {
      message: `I couldn't find anything in your documents related to “${truncate(
        prompt,
        80
      )}”.`,
      hint: "Try a question about your uploaded files, or upload a document that covers this topic.",
    },
    sourceChunkIds: [],
    sourceIds: [],
  };
}

/**
 * The router entry point. Retrieves over the live RAG registry, then either
 * serves a curated demo analysis (seed docs), derives a widget from real
 * uploaded data, or returns a guardrail error card when nothing is relevant.
 */
export function routeWidget(
  prompt: string,
  documentIds?: string[]
): { schema: GeneratedWidgetSchema; retrieval: RetrievedChunk[] } {
  const chunks = getChunks(documentIds);
  const retrieved = retrieve(prompt, chunks, 4);

  // ── Guardrail: no relevant context ──────────────────────────────────────
  if (retrieved.length === 0) {
    return { schema: errorSchema(prompt), retrieval: [] };
  }

  // ── Uploaded-doc priority + primary-document isolation (AC 3.3) ──────────
  // Uploaded files take precedence over the built-in demo corpus: if any
  // uploaded (non-seed) chunk matched at all, the seed data steps aside so it
  // can never hijack a query about the user's own data. Seed chunks are used
  // only as a fallback when nothing uploaded matched. The top chunk of the
  // chosen set defines the context document; data + citations scope to it.
  const uploadedHits = retrieved.filter((r) => !CHUNK_TOPIC[r.chunk.id]);
  const effective = uploadedHits.length ? uploadedHits : retrieved;

  const primaryDocId = effective[0].chunk.documentId;
  const scoped = effective.filter((r) => r.chunk.documentId === primaryDocId);
  const sourceChunkIds = Array.from(
    new Set(scoped.slice(0, 3).map((r) => r.chunk.id))
  );
  const sourceIds = [primaryDocId];

  let widgetType: AiWidgetType;
  let cleanData: WidgetData;
  let title: string;

  // Seed path only when the chosen context is itself a curated demo chunk.
  const seedTopic = CHUNK_TOPIC[effective[0].chunk.id] ?? null;

  if (seedTopic) {
    // ── Curated demo analysis (seed corpus) ───────────────────────────────
    const cfg = TOPICS[seedTopic];
    const format = resolveFormat(prompt, cfg.naturalKind);
    title = cfg.title;
    widgetType = aiTypeForFormat(format);
    cleanData =
      format === "sheet"
        ? buildSheet(cfg)
        : format === "text"
        ? cfg.insight
        : chartDataFor(cfg, format);
  } else {
    // ── Real uploaded data ────────────────────────────────────────────────
    const table = getTable(primaryDocId);
    title = titleFromPrompt(prompt);
    if (table) {
      // Aggregation engine first (count / group-by / trend); raw shaping else.
      const analysis = analyzeTable(table, prompt);
      if (analysis) {
        widgetType = analysis.widgetType;
        title = analysis.title;
        cleanData = analysis.cleanData;
      } else {
        const built = buildFromTable(table, prompt, title);
        widgetType = built.widgetType;
        cleanData = built.cleanData;
      }
    } else {
      widgetType = "text-insight";
      cleanData = buildTextFromChunks(scoped, title);
    }
  }

  return {
    schema: { widgetType, title, cleanData, sourceChunkIds, sourceIds },
    retrieval: retrieved,
  };
}
