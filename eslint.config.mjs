import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    ignores: [".next/**", "node_modules/**", "src/generated/**", "coverage/**", "next-env.d.ts"],
  },
  {
    rules: {
      // Never ship stray debugging output; use src/lib/log.ts instead.
      "no-console": ["error", { allow: ["warn", "error"] }],
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // CLI scripts talk to a human through the terminal.
    files: ["scripts/**"],
    rules: { "no-console": "off" },
  },
];

export default config;
