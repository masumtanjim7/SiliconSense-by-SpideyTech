/**
 * SiliconSense by SpideyTech — Shared API Contracts
 * Matches FastAPI Pydantic models and Product Blueprint Section 10
 */
export type PerformanceTier = "Weak" | "Basic" | "Mid-range" | "Strong" | "High-end";

export type BalanceStatus =
  | "Balanced"
  | "Mild bottleneck"
  | "Moderate bottleneck"
  | "Major bottleneck";

export type ConfidenceLevel = "High" | "Medium" | "Limited";

export interface HealthResponse {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  environment: string;
  database: "connected" | "unreachable";
}