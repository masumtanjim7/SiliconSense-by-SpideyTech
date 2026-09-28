import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  HardDrive,
  Info,
  MemoryStick,
  Monitor,
  ShieldAlert,
} from "lucide-react";
import {
  cn,
  getBalanceColorClasses,
  getConfidenceBadgeClasses,
  getTierColorClasses,
} from "@/lib/utils";

export interface GlassPanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "glass" | "solid";
  interactive?: boolean;
  selected?: boolean;
}

export function GlassPanel({
  variant = "glass",
  interactive = false,
  selected = false,
  className,
  children,
  ...props
}: GlassPanelProps) {
  return (
    <div
      className={cn(
        "rounded-card transition-all duration-200",
        variant === "glass"
          ? "glass-panel shadow-xl"
          : "bg-surface-solid border border-white/10",
        interactive &&
          "hover:-translate-y-0.5 hover:border-brand-primary/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary",
        selected && "border-brand-primary ring-1 ring-brand-primary/50 bg-brand-primary/5",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  rightElement,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  rightElement?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
      <div>
        {eyebrow && (
          <div className="text-xs font-semibold uppercase tracking-wider text-brand-primary mb-1.5">
            {eyebrow}
          </div>
        )}
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-strong">
          {title}
        </h2>
        {description && (
          <p className="text-sm md:text-base text-text-muted mt-1.5 max-w-2xl">
            {description}
          </p>
        )}
      </div>
      {rightElement && <div className="shrink-0">{rightElement}</div>}
    </div>
  );
}

export function StatusBadge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "positive" | "warning" | "danger" | "primary" | "neutral";
}) {
  const styles = {
    positive: "bg-brand-cyan/10 text-brand-cyan border-brand-cyan/30",
    warning: "bg-brand-amber/10 text-brand-amber border-brand-amber/30",
    danger: "bg-brand-rose/10 text-brand-rose border-brand-rose/30",
    primary: "bg-brand-primary/15 text-brand-primary border-brand-primary/30",
    neutral: "bg-surface-solid text-text-muted border-white/10",
  }[tone];

  const Icon = {
    positive: CheckCircle2,
    warning: AlertTriangle,
    danger: ShieldAlert,
    primary: Info,
    neutral: Info,
  }[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
        styles
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

export function HardwareChip({
  slotType,
  brand,
  modelName,
  badgeText,
}: {
  slotType: "CPU" | "GPU" | "RAM" | "STORAGE" | string;
  brand: string;
  modelName: string;
  badgeText?: string;
}) {
  const Icon =
    slotType === "CPU"
      ? Cpu
      : slotType === "GPU"
        ? Monitor
        : slotType === "RAM"
          ? MemoryStick
          : HardDrive;

  return (
    <div className="inline-flex items-center gap-2.5 px-3 py-2 rounded-control bg-surface-solid border border-white/10 text-xs md:text-sm">
      <Icon className="h-4 w-4 text-brand-primary shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-1.5">
        <span className="text-text-muted font-medium">{brand}</span>
        <span className="text-text-strong font-semibold">{modelName}</span>
      </div>
      {badgeText && (
        <span className="ml-1 px-1.5 py-0.5 rounded bg-white/5 text-[11px] font-mono text-brand-cyan">
          {badgeText}
        </span>
      )}
    </div>
  );
}

export function ScoreRing({
  score,
  label,
  tier,
  confidenceLevel,
  size = 168,
}: {
  score: number;
  label: string;
  tier: string;
  confidenceLevel?: string;
  size?: number;
}) {
  const clamped = Math.max(0, Math.min(100, score));
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (clamped / 100) * circumference;
  const tierColors = getTierColorClasses(tier);
  const confColors = confidenceLevel ? getConfidenceBadgeClasses(confidenceLevel) : null;

  return (
    <div
      className="flex flex-col items-center"
      role="region"
      aria-label={`${label}: ${clamped.toFixed(1)} out of 100 (${tier})`}
    >
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="w-full h-full -rotate-90" viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={tierColors.stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-700 ease-out motion-reduce:transition-none"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs uppercase tracking-wider text-text-muted font-medium">
            {label}
          </span>
          <span className="text-4xl font-bold tabular-nums text-text-strong mt-0.5">
            {Math.round(clamped)}
          </span>
          <span
            className={cn(
              "mt-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
              tierColors.bg,
              tierColors.text,
              tierColors.border
            )}
          >
            {tier}
          </span>
        </div>
      </div>
      {confidenceLevel && confColors && (
        <div
          className={cn(
            "mt-3 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs border",
            confColors.bg,
            confColors.text,
            confColors.border
          )}
        >
          <span>{confidenceLevel} Confidence</span>
        </div>
      )}
    </div>
  );
}

export function BalanceGauge({
  balanceScore,
  balanceStatus,
  spreadPoints,
  explanation,
}: {
  balanceScore: number;
  balanceStatus: string;
  spreadPoints: number;
  explanation: string;
}) {
  const colors = getBalanceColorClasses(balanceStatus);
  const clamped = Math.max(0, Math.min(100, balanceScore));

  return (
    <div className="space-y-3" role="region" aria-label={`System Balance: ${balanceStatus}`}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-text-muted font-medium">
            System Balance & Synergy
          </div>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-3xl font-bold tabular-nums text-text-strong">
              {Math.round(clamped)}
            </span>
            <span className="text-xs text-text-muted">/ 100</span>
          </div>
        </div>
        <span
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold border",
            colors.bg,
            colors.text,
            colors.border
          )}
        >
          {balanceStatus} ({spreadPoints.toFixed(1)} pt spread)
        </span>
      </div>

      <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500 motion-reduce:transition-none",
            colors.bar
          )}
          style={{ width: `${clamped}%` }}
        />
      </div>

      <p className="text-xs md:text-sm text-text-muted leading-relaxed">{explanation}</p>
    </div>
  );
}

export function MetricBar({
  label,
  subsystem,
  score,
  percentile,
  weight,
  isMissing = false,
}: {
  label: string;
  subsystem: string;
  score: number | null;
  percentile?: number | null;
  weight?: number;
  isMissing?: boolean;
}) {
  const safeScore = score !== null ? Math.max(0, Math.min(100, score)) : 0;

  return (
    <div className="p-3.5 rounded-control bg-surface-solid border border-white/5 space-y-2">
      <div className="flex items-center justify-between text-xs md:text-sm">
        <div className="flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded bg-white/5 text-[11px] font-mono text-brand-primary">
            {subsystem}
          </span>
          <span className="font-medium text-text-strong">{label}</span>
        </div>
        <div className="flex items-center gap-3 tabular-nums">
          {weight !== undefined && (
            <span className="text-xs text-text-muted">
              Weight: {Math.round(weight * 100)}%
            </span>
          )}
          {isMissing || score === null ? (
            <span className="text-xs text-brand-amber font-medium">No Evidence</span>
          ) : (
            <span className="font-semibold text-text-strong">
              {safeScore.toFixed(1)}{" "}
              {percentile !== undefined && percentile !== null && (
                <span className="text-xs text-text-muted font-normal">
                  (P{Math.round(percentile)})
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
        {!isMissing && score !== null && (
          <div
            className="h-full rounded-full bg-gradient-to-r from-brand-primary to-brand-cyan transition-all duration-500 motion-reduce:transition-none"
            style={{ width: `${safeScore}%` }}
          />
        )}
      </div>
    </div>
  );
}