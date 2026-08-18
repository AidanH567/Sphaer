/**
 * Marker colours for screenshot annotation.
 *
 * Split out of `theme.ts` — and importing NOTHING — so the Node QA renderer
 * (`scripts/qa-annotate-screenshot.ts`) can use the exact same values. `theme.ts`
 * imports `Platform` from react-native, which esbuild cannot parse outside the
 * Metro pipeline, so a script that imported the theme could only hardcode a
 * copy of these hexes. A copy would drift, and the drift would be invisible:
 * the QA render would prove a colour the app does not actually draw with.
 *
 * `theme.ts` re-exports this as `colors.annotation`, so app code keeps reading
 * it from the one place it reads every other token from.
 *
 * ── Why three ────────────────────────────────────────────────────────────────
 * The thing most often worth circling is an error state, and Sphaer paints
 * those in `badge.red` — a red circle round a red error is invisible, which is
 * exactly the report that helps nobody. Three high-contrast hues mean there is
 * always one that separates from what it is drawn over.
 *
 * Deliberately NOT from the neutral palette: these are not part of the app's
 * visual language, they sit ON TOP of it, and they have to lose a fight with
 * no screenshot. Saturated primaries are the right answer.
 */
export const annotationColors = {
  red: '#FF1E1E',
  yellow: '#FFD400',
  cyan: '#00C2FF',
} as const;
