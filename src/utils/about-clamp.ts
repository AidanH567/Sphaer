/**
 * When is "Read more" worth offering?
 *
 * ── The bug ──────────────────────────────────────────────────────────────────
 * Report 410169cc: "the read more button and the read less button on the
 * activity detail page does nothing". It rendered unconditionally. Most event
 * descriptions are shorter than the collapsed budget, so pressing it flipped
 * `numberOfLines` between the clamp and `undefined` with nothing hidden in
 * between — a control that visibly did nothing, on almost every event.
 *
 * ── Why heights and not characters ───────────────────────────────────────────
 * "Is this text longer than N lines?" cannot be answered from the string. It
 * depends on the font, the width, and where the words break. Guessing from
 * character counts is how you get a Read more that is wrong in both
 * directions: absent on a description that IS clipped, present on one that is
 * not.
 *
 * So the screen measures instead — it renders an unclamped, invisible copy of
 * each paragraph and reports the natural heights here. Because the About text
 * has an explicit `lineHeight`, height ÷ lineHeight is an exact line count,
 * not an estimate.
 *
 * Pure, so the rule can be tested without laying anything out.
 */

/**
 * `styles.aboutText.lineHeight` on the event detail screen. Hoisted so the
 * truncation maths and the text itself cannot drift apart — if they disagree,
 * "Read more" starts lying again in whichever direction the numbers differ.
 */
export const ABOUT_LINE_HEIGHT = 22;

/**
 * Collapsed line budget per About paragraph: the opener gets more room than
 * the paragraphs after it.
 *
 * Used by BOTH the visible copy (as `numberOfLines`) and the truncation check,
 * so "what the reader sees" and "is anything hidden" are answers to the same
 * question rather than two rules that happen to agree today.
 */
export function aboutClampFor(index: number): number {
  return index === 0 ? 6 : 4;
}

/**
 * Does any paragraph run past its collapsed budget?
 *
 * `naturalHeights` are the UNCLAMPED heights, in px, in paragraph order.
 * Entries that are missing or zero are "not measured yet" and are ignored —
 * which is why the toggle is absent on the first paint and appears only once
 * there is a measurement to justify it. Erring towards hiding is deliberate:
 * a briefly missing affordance is a smaller failure than a permanently dead
 * one, and the dead one is the bug being fixed.
 */
export function isAboutTruncated(
  naturalHeights: readonly number[],
  lineHeight: number = ABOUT_LINE_HEIGHT
): boolean {
  if (lineHeight <= 0) return false;
  return naturalHeights.some(
    (height, index) =>
      typeof height === 'number' &&
      height > 0 &&
      Math.round(height / lineHeight) > aboutClampFor(index)
  );
}
