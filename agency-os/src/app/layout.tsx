import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Agency OS",
  description: "Workforce management platform",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", inter.variable)}>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/N4.png" />
        <meta name="theme-color" content="#080810" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className="min-h-screen bg-background font-sans antialiased"
        style={{ fontFeatureSettings: '"cv02", "cv03", "cv04", "cv11"' }}
      >
        {/* TaskFlow ambient orbs */}
        <div className="ambient-orb-1" aria-hidden="true" />
        <div className="ambient-orb-2" aria-hidden="true" />
        <div id="app-content" className="relative z-10">
          {children}
        </div>
      </body>
    </html>
  );
}