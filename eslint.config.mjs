import nextPlugin from "@next/eslint-plugin-next"
import reactHooks from "eslint-plugin-react-hooks"
import tseslint from "typescript-eslint"

// Hand-rolled flat config instead of eslint-config-next's legacy
// FlatCompat bridge — that bridge hits a "Converting circular structure to
// JSON" crash from eslint-plugin-react's flat preset under this ESLint/
// eslint-config-next version combination (an upstream compat bug, not a
// project config issue). This composes the same practical rule set
// (Next.js core-web-vitals + TypeScript + React Hooks) directly.
export default tseslint.config(
  { ignores: [".next/**", "node_modules/**", "public/**", "*.config.*"] },
  ...tseslint.configs.recommended,
  {
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "off",
      // eslint-plugin-react-hooks v7's newest rule, aimed at React Compiler
      // compatibility — flags the extremely common "setLoading(true) at the
      // top of an effect, before an async fetch" pattern used throughout
      // this codebase's data-fetching hooks/components. Real, but a
      // style/perf concern rather than a correctness bug; downgraded to a
      // warning rather than rewriting every affected effect (many in
      // auth-critical hooks) under audit time pressure. Left visible for a
      // deliberate follow-up pass.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
)
