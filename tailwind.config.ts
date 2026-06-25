import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          // Deep, near-black backgrounds used across the canvas surface.
          base: "#09090b",
          deep: "#0b0b0f",
          panel: "#0e0e12",
          elevated: "#141419",
        },
        accent: {
          DEFAULT: "#6366f1",
          glow: "#818cf8",
          cyan: "#22d3ee",
          emerald: "#34d399",
          amber: "#fbbf24",
          rose: "#fb7185",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(99,102,241,0.25), 0 8px 40px -8px rgba(99,102,241,0.45)",
        card: "0 12px 50px -12px rgba(0,0,0,0.8)",
        "card-active":
          "0 0 0 1px rgba(129,140,248,0.4), 0 16px 60px -12px rgba(99,102,241,0.5)",
      },
      backgroundImage: {
        "dot-grid":
          "radial-gradient(circle at center, rgba(255,255,255,0.08) 1px, transparent 1px)",
        "accent-sheen":
          "linear-gradient(135deg, rgba(99,102,241,0.18), rgba(34,211,238,0.08))",
      },
      keyframes: {
        "dash-flow": {
          to: { strokeDashoffset: "-24" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "dash-flow": "dash-flow 1s linear infinite",
        "pulse-glow": "pulse-glow 2.4s ease-in-out infinite",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
