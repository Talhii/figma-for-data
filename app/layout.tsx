import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  // Absolute-URL base so metadata/OG resolve correctly on Vercel previews + prod.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000")
  ),
  title: "Figma for Data",
  description: "Interactive AI Spreadsheet and BI Canvas",
  applicationName: "Figma for Data",
  // Icons are wired automatically by the App Router file convention:
  //   app/icon.svg · app/favicon.ico · app/apple-icon.png
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
