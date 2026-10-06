import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

/**
 * eslint-config-next 16 ships flat configs, so no FlatCompat shim is needed.
 */
const eslintConfig = [
  ...nextVitals,
  ...nextTypeScript,
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "public/**",
      "next-env.d.ts",
      "coverage/**",
      "e2e/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "warn",
      // The editor drives canvas pixels through imperative stores; the React
      // Compiler cannot memoise those components and says so. That is expected
      // (the compiler is not enabled in next.config.ts), so keep it advisory.
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
];

export default eslintConfig;
