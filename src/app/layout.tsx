import type { Metadata, Viewport } from "next";
import { Hanken_Grotesk, IBM_Plex_Mono, Unbounded } from "next/font/google";
import "./globals.css";

const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const display = Unbounded({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Journal: changelog et nouveautés pour ton produit", template: "%s | Journal" },
  description:
    "Un changelog public, un flux RSS et un widget « Nouveautés » à coller sur ton site. Simple, rapide, en français.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
