// ESLint flat config — https://docs.expo.dev/guides/using-eslint/
// Base: eslint-config-expo@55 (SDK-55 line, matches expo's
// bundledNativeModules.json). Run via `npm run lint`; CI runs it as a
// blocking step, so rule severities below are tuned so that pre-existing
// issues outside the lint-introduction change surface as warnings (visible
// in CI logs, non-blocking) while anything new that is error-level fails
// the build.
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  {
    ignores: [
      'dist/*',
      // Gitignored scratch space — script caches (import-figma-posters) and
      // throwaway `expo export` output for QA live here. Same reasoning as
      // dist/*: linting bundler output is noise.
      '.tmp/*',
      '.expo/*',
      // Claude Code's scratch worktrees. Abandoned copies of the app live here,
      // and linting them produced 26 problems in code nobody ships — which read
      // as "the repo fails lint" and hid the fact that app/ and src/ are clean.
      '.claude/*',
      'android/*',
      'ios/*',
      'coverage/*',
      'supabase/*',
      // Auto-generated from the Supabase schema — never hand-edited.
      'src/types/supabase.ts',
    ],
  },
  expoConfig,
  {
    // app/(tabs)/feed/map.web.tsx carries an
    // `eslint-disable @next/next/no-img-element` comment (deliberate plain
    // <img> on web). The Next.js plugin isn't — and shouldn't be —
    // installed in an Expo app, so ESLint 9 reports the unknown rule as an
    // error. Register a no-op stub so the directive resolves, and silence
    // the resulting "unused directive" report for web-only files.
    files: ['**/*.web.{js,jsx,ts,tsx}'],
    plugins: {
      '@next/next': {
        rules: {
          'no-img-element': { create: () => ({}) },
        },
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off',
    },
  },
]);
