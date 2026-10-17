import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      // Demo entry point: checked by running `npm run demo`, not by unit tests.
      exclude: ["src/cli.ts"],
      reporter: ["text", "html"],
    },
  },
});
