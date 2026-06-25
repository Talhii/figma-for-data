import type { DataRow, DocumentChunk, SheetData, SourceDocument } from "@/lib/types";
import { uid } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Client-side ingestion pipeline (Module A).
//
// Parses an uploaded CSV / Markdown / TXT file, chunks it logically, and derives
// lightweight keyword "embeddings" for the mock vector store. CSV uploads also
// yield a structured `table` so the router can build real charts and grids.
//
// The output mirrors what a server embedding job would produce; `/api/ingest`
// then "indexes" it (mock: in-memory; live: OpenAI embeddings → Supabase).
// ─────────────────────────────────────────────────────────────────────────────

export interface IngestedFile {
  document: SourceDocument;
  chunks: DocumentChunk[];
  table?: SheetData;
}

const STOPWORDS = new Set([
  "the", "a", "an", "of", "for", "by", "to", "in", "on", "and", "or", "is",
  "are", "was", "were", "be", "this", "that", "with", "as", "at", "it", "its",
  "from", "we", "our", "you", "your", "they", "their", "has", "have", "had",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

function topKeywords(text: string, n = 8): string[] {
  const freq = new Map<string, number>();
  for (const t of tokenize(text)) freq.set(t, (freq.get(t) ?? 0) + 1);
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}

function slug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "col"
  );
}

function detectType(name: string): SourceDocument["type"] {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "csv") return "csv";
  if (ext === "md" || ext === "markdown") return "markdown";
  return "text";
}

// ── CSV parsing ──────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function coerce(raw: string): string | number {
  const v = raw.trim();
  if (v === "") return "";
  // Numeric if it parses cleanly once currency/percent/thousands are stripped.
  if (/^[-+]?[$]?[\d,]*\.?\d+%?$/.test(v)) {
    const n = Number(v.replace(/[$,%]/g, ""));
    if (!Number.isNaN(n)) return n;
  }
  return v;
}

function parseCsv(text: string): SheetData {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };

  const header = splitCsvLine(lines[0]);
  const columns = header.map((h, i) => ({
    key: slug(h) + (header.slice(0, i).filter((x) => slug(x) === slug(h)).length || ""),
    label: h.trim() || `Column ${i + 1}`,
  }));

  const rows: DataRow[] = lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row: DataRow = {};
    columns.forEach((c, i) => {
      row[c.key] = coerce(cells[i] ?? "");
    });
    return row;
  });

  return { columns, rows };
}

function ingestCsv(
  documentId: string,
  name: string,
  text: string,
  uploadedAt: number
): IngestedFile {
  const table = parseCsv(text);
  const colLabels = table.columns.map((c) => c.label);
  const fileKeywords = tokenize(name.replace(/\.[^.]+$/, ""));
  const colKeywords = colLabels.flatMap((l) => tokenize(l));

  // If the table has a numeric measure (a non-id number column), tag it with
  // measure synonyms so "revenue / sales / spend" style questions retrieve THIS
  // document instead of the built-in financial demo data.
  const hasMeasure = table.columns.some((c) => {
    if (/\b(id|index)\b/i.test(c.label)) return false;
    const nums = table.rows.filter((r) => typeof r[c.key] === "number").length;
    return nums > 0 && nums >= Math.ceil(table.rows.length / 2);
  });
  const measureSynonyms = hasMeasure
    ? ["revenue", "sales", "amount", "price", "value", "spend", "cost", "sum", "average", "mean", "measure"]
    : [];

  const chunks: DocumentChunk[] = [];
  // Overview chunk so "what's in <file>" / "summarize" / "patterns" style
  // exploratory queries reliably retrieve this document.
  chunks.push({
    id: uid("chunk"),
    documentId,
    content: `${name}: a table with ${table.rows.length} rows and columns ${colLabels.join(", ")}.`,
    keywords: Array.from(
      new Set([
        ...fileKeywords,
        ...colKeywords,
        ...measureSynonyms,
        "table", "data", "dataset", "records", "rows", "columns",
        "count", "total", "summary", "overview", "insight", "pattern",
        "distribution", "trend", "analysis", "statistics",
      ])
    ),
  });

  // Row-group chunks carry category values as keywords.
  const groupSize = 8;
  const catKey = table.columns.find((c) =>
    table.rows.some((r) => typeof r[c.key] === "string")
  )?.key;
  for (let i = 0; i < table.rows.length; i += groupSize) {
    const group = table.rows.slice(i, i + groupSize);
    const cats = catKey
      ? group.map((r) => String(r[catKey])).filter(Boolean)
      : [];
    const content = group
      .map((r) => colLabels.map((l, ci) => `${l}: ${r[table.columns[ci].key]}`).join(", "))
      .join(" | ");
    chunks.push({
      id: uid("chunk"),
      documentId,
      content: truncate(content, 480),
      keywords: Array.from(
        new Set([...colKeywords, ...cats.flatMap((c) => tokenize(c))])
      ),
    });
  }

  return {
    document: {
      id: documentId,
      name,
      type: "csv",
      x: 0,
      y: 0,
      summary: `CSV · ${table.rows.length} rows × ${table.columns.length} cols`,
      chunkCount: chunks.length,
      uploadedAt,
    },
    chunks,
    table,
  };
}

// ── Text / Markdown chunking ─────────────────────────────────────────────────

function ingestText(
  documentId: string,
  name: string,
  type: SourceDocument["type"],
  text: string,
  uploadedAt: number
): IngestedFile {
  const fileKeywords = tokenize(name.replace(/\.[^.]+$/, ""));
  // Split on blank lines, then pack into ~400-char chunks.
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const chunks: DocumentChunk[] = [];
  let buffer = "";
  const flush = () => {
    const content = buffer.trim();
    if (!content) return;
    chunks.push({
      id: uid("chunk"),
      documentId,
      content,
      keywords: Array.from(new Set([...fileKeywords, ...topKeywords(content, 10)])),
    });
    buffer = "";
  };
  for (const p of paragraphs) {
    if ((buffer + " " + p).length > 400) flush();
    buffer = buffer ? `${buffer} ${p}` : p;
  }
  flush();
  if (chunks.length === 0) {
    chunks.push({
      id: uid("chunk"),
      documentId,
      content: text.slice(0, 400) || name,
      keywords: fileKeywords,
    });
  }

  const summary = truncate(paragraphs[0] ?? `${type} document`, 64);
  return {
    document: {
      id: documentId,
      name,
      type,
      x: 0,
      y: 0,
      summary,
      chunkCount: chunks.length,
      uploadedAt,
    },
    chunks,
  };
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s;
}

/** Parse + chunk a single uploaded file. */
export async function ingestFile(file: File): Promise<IngestedFile> {
  const text = await file.text();
  const type = detectType(file.name);
  const documentId = uid("doc");
  const uploadedAt = Date.now();
  return type === "csv"
    ? ingestCsv(documentId, file.name, text, uploadedAt)
    : ingestText(documentId, file.name, type, text, uploadedAt);
}

export const ACCEPTED_EXTENSIONS = [".csv", ".md", ".markdown", ".txt"];

export function isSupportedFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}
