export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-gradient-to-b from-canvas to-canvas-elevated">
      <div className="glass-panel rounded-hero max-w-2xl w-full p-8 md:p-12 shadow-2xl">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-solid border border-white/10 text-xs font-medium text-brand-cyan mb-6">
          <span className="h-2 w-2 rounded-full bg-brand-cyan" />
          HARDWARE TELEMETRY LAB • FOUNDATION READY
        </div>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-text-strong mb-4">
          SiliconSense{" "}
          <span className="text-brand-primary">by SpideyTech</span>
        </h1>
        <p className="text-text-muted text-base md:text-lg leading-relaxed mb-8">
          Detect the bottleneck before you build. Understand how strong your PC
          really is, where it is unbalanced, and what to upgrade first — based
          on measurable benchmark data and your actual workload.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-white/10 text-sm">
          <div className="bg-surface-solid p-4 rounded-control border border-white/5">
            <div className="text-text-muted text-xs uppercase">Engine</div>
            <div className="font-semibold text-text-strong mt-1">
              Deterministic v1.0
            </div>
          </div>
          <div className="bg-surface-solid p-4 rounded-control border border-white/5">
            <div className="text-text-muted text-xs uppercase">Provenance</div>
            <div className="font-semibold text-brand-cyan mt-1">
              Versioned Datasets
            </div>
          </div>
          <div className="bg-surface-solid p-4 rounded-control border border-white/5">
            <div className="text-text-muted text-xs uppercase">Workloads</div>
            <div className="font-semibold text-brand-primary mt-1">
              5 Core Profiles
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}