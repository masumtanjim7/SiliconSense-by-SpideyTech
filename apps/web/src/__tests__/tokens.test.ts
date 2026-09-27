import { describe, expect, it } from "vitest";
import { designTokens } from "@packages/design-tokens";

describe("SiliconSense Hardware Lab Design Tokens", () => {
  it("exposes the canonical dark canvas and semantic status colors", () => {
    expect(designTokens.colors.canvas.deep).toBe("#070B16");
    expect(designTokens.colors.surface.solid).toBe("#10182B");
    expect(designTokens.colors.brand.primary).toBe("#6D7CFF");
    expect(designTokens.colors.brand.cyan).toBe("#31D8C2");
    expect(designTokens.colors.brand.amber).toBe("#F5B84B");
    expect(designTokens.colors.brand.rose).toBe("#FF6484");
  });
});