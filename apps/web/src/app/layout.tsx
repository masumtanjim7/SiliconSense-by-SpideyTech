import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "SiliconSense by SpideyTech | PC Strength & Balance Analyzer",
  description:
    "Detect hidden PC bottlenecks before you build or upgrade. Explainable, workload-aware benchmark scoring in a dark glassmorphic hardware lab UI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-canvas text-text-strong antialiased`}>
        {children}
      </body>
    </html>
  );
}