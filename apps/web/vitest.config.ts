import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@packages/design-tokens": path.resolve(
        __dirname,
        "../../packages/design-tokens/index.ts"
      ),
      "@packages/contracts": path.resolve(
        __dirname,
        "../../packages/contracts/index.ts"
      ),
    },
  },
});