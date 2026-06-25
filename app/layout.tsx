import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Figma for Data — Interactive AI Canvas",
  description:
    "An infinite, dark-mode BI canvas. Upload documents, ask questions, and spawn interactive charts, spreadsheets, and insights powered by RAG.",
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-canvas-deep text-zinc-200 antialiased">
        {children}
      </body>
    </html>
  );
}
