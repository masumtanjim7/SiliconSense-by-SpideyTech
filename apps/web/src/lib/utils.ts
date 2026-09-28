import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BalanceStatus, ConfidenceLevel, PerformanceTier } from "@packages/contracts";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function getTierColorClasses(tier: PerformanceTier | string): {
  text: string;
  stroke: string;
  bg: string;
  border: string;
} {
  switch (tier) {
    case "High-end":
    case "Strong":
      return {
        text: "text-brand-cyan",
        stroke: "#31D8C2",
        bg: "bg-brand-cyan/10",
        border: "border-brand-cyan/30",
      };
    case "Mid-range":
      return {
        text: "text-brand-primary",
        stroke: "#6D7CFF",
        bg: "bg-brand-primary/10",
        border: "border-brand-primary/30",
      };
    case "Basic":
      return {
        text: "text-brand-amber",
        stroke: "#F5B84B",
        bg: "bg-brand-amber/10",
        border: "border-brand-amber/30",
      };
    default:
      return {
        text: "text-brand-rose",
        stroke: "#FF6484",
        bg: "bg-brand-rose/10",
        border: "border-brand-rose/30",
      };
  }
}

export function getBalanceColorClasses(status: BalanceStatus | string): {
  text: string;
  bg: string;
  border: string;
  bar: string;
} {
  switch (status) {
    case "Balanced":
      return {
        text: "text-brand-cyan",
        bg: "bg-brand-cyan/10",
        border: "border-brand-cyan/30",
        bar: "bg-brand-cyan",
      };
    case "Mild bottleneck":
    case "Moderate bottleneck":
      return {
        text: "text-brand-amber",
        bg: "bg-brand-amber/10",
        border: "border-brand-amber/30",
        bar: "bg-brand-amber",
      };
    default:
      return {
        text: "text-brand-rose",
        bg: "bg-brand-rose/10",
        border: "border-brand-rose/30",
        bar: "bg-brand-rose",
      };
  }
}

export function getConfidenceBadgeClasses(level: ConfidenceLevel | string): {
  text: string;
  bg: string;
  border: string;
} {
  switch (level) {
    case "High":
      return {
        text: "text-brand-cyan",
        bg: "bg-brand-cyan/10",
        border: "border-brand-cyan/30",
      };
    case "Medium":
      return {
        text: "text-brand-amber",
        bg: "bg-brand-amber/10",
        border: "border-brand-amber/30",
      };
    default:
      return {
        text: "text-brand-rose",
        bg: "bg-brand-rose/10",
        border: "border-brand-rose/30",
      };
  }
}