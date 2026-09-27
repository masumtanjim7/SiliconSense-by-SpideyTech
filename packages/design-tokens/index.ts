/**
 * SiliconSense by SpideyTech — Core Hardware Laboratory Design Tokens
 * Source of truth: Product Blueprint Section 03
 */
export const designTokens = {
  colors: {
    canvas: {
      deep: "#070B16",
      elevated: "#0A1020",
    },
    surface: {
      solid: "#10182B",
      glass: "rgba(18, 27, 48, 0.62)",
      glassBorder: "rgba(255, 255, 255, 0.12)",
    },
    brand: {
      primary: "#6D7CFF",
      cyan: "#31D8C2",   // Healthy / balanced / positive performance
      amber: "#F5B84B",  // Moderate bottleneck / caution
      rose: "#FF6484",   // Major bottleneck / destructive state
    },
    text: {
      strong: "#F5F7FF",
      muted: "#94A3C3",
    },
  },
  radius: {
    control: "16px",
    card: "20px",
    hero: "28px",
  },
  blur: {
    standard: "16px",
    elevated: "24px",
  },
} as const;