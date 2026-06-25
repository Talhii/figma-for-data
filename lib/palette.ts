// Shared chart palette so the AI router and the chart widget agree on colors.
export const PALETTE = [
  "#818cf8", // indigo
  "#22d3ee", // cyan
  "#34d399", // emerald
  "#fbbf24", // amber
  "#fb7185", // rose
  "#a78bfa", // violet
  "#f472b6", // pink
  "#4ade80", // green
];

export const colorAt = (i: number): string => PALETTE[i % PALETTE.length];
