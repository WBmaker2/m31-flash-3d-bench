import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["**/*.test.js"],
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
