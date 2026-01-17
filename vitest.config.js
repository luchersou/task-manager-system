import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    clearMocks: true,
    setupFiles: ["./vitest.setup.js"]
  }
});
