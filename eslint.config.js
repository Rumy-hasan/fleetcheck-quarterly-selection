import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

const noDefaultExport = {
  selector: "ExportDefaultDeclaration",
  message: "Use named exports (CLAUDE.md coding rules).",
};

// Domain and application must stay deterministic: time and randomness are injected.
const noTimeOrRandomness = [
  { selector: "NewExpression[callee.name='Date']", message: "Inject a Clock instead." },
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "Inject a Clock instead.",
  },
  {
    selector: "CallExpression[callee.object.name='Math'][callee.property.name='random']",
    message: "Use the seeded algorithm or an injected SeedGenerator.",
  },
];

export default defineConfig(
  { ignores: ["dist", "coverage"] },
  tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: { "no-restricted-syntax": ["error", noDefaultExport] },
  },
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", noDefaultExport, ...noTimeOrRandomness],
      "no-restricted-imports": [
        "error",
        { patterns: ["**/application/**", "**/infrastructure/**", "**/cli*"] },
      ],
    },
  },
  {
    files: ["src/application/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", noDefaultExport, ...noTimeOrRandomness],
      "no-restricted-imports": ["error", { patterns: ["**/infrastructure/**", "**/cli*"] }],
    },
  },
  {
    // Tool config files require default exports and are not type-checked.
    files: ["*.config.js", "*.config.ts"],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { "no-restricted-syntax": "off" },
  },
);
