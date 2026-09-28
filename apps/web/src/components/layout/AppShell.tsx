import React from "react";
import Link from "next/link";
import { Activity, Cpu, GitCompare, Layers, ShieldCheck } from "lucide-react";

const NAV_ITEMS = [
  { href: "/analyze", label: "PC Analyzer", icon: Activity },
  { href: "/compare", label: "Compare Builds", icon: GitCompare },
  { href: "/hardware", label: "Hardware Explorer", icon: Cpu },
  { href: "/methodology", label: "Methodology", icon: ShieldCheck },
  { href: "/account/builds", label: "Saved Builds", icon: Layers },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-canvas text-text-strong relative overflow-x-hidden">
      {/* Single restrained background spectral glow per Blueprint Section 03 */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 w-[720px] h-[340px] bg-brand-primary/10 blur-[130px] rounded-full -z-10"
      />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-canvas/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-lg"
          >
            <div className="h-8 w-8 rounded-lg bg-brand-primary/20 border border-brand-primary/40 flex items-center justify-center text-brand-primary font-bold">
              S
            </div>
            <div>
              <span className="font-bold tracking-tight text-text-strong">
                SiliconSense
              </span>{" "}
              <span className="text-xs font-medium text-brand-primary">
                by SpideyTech
              </span>
            </div>
          </Link>

          <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs lg:text-sm font-medium text-text-muted hover:text-text-strong hover:bg-white/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                >
                  <Icon className="h-4 w-4 text-brand-primary/80" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/analyze"
              className="px-4 py-2 rounded-control bg-brand-primary hover:bg-brand-primary/90 text-xs sm:text-sm font-semibold text-text-strong shadow-lg shadow-brand-primary/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-cyan"
            >
              Analyze My PC
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
        {children}
      </main>

      <footer className="border-t border-white/10 bg-surface-solid/60 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-text-muted">
          <div>
            <span className="font-semibold text-text-strong">
              SiliconSense by SpideyTech
            </span>{" "}
            — Benchmark-driven PC strength, balance & bottleneck laboratory.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/methodology" className="hover:text-text-strong">
              Methodology & Provenance
            </Link>
            <Link href="/hardware" className="hover:text-text-strong">
              Hardware Catalog
            </Link>
            <Link href="/design-system" className="hover:text-text-strong">
              Design System
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}