/**
 * When "Read more" is offered.
 *
 * Report 410169cc: "the read more button and the read less button on the
 * activity detail page does nothing". It was rendered unconditionally, and
 * most descriptions are shorter than the collapsed budget — so on most events
 * it toggled a clamp that was hiding nothing, and looked broken.
 *
 * The property under test is the one the reporter cares about: the control
 * appears when, and only when, pressing it would change what is on screen.
 */

import {
  ABOUT_LINE_HEIGHT,
  aboutClampFor,
  isAboutTruncated,
} from '../about-clamp';

/** Natural height of a paragraph that renders `lines` lines. */
function h(lines: number): number {
  return lines * ABOUT_LINE_HEIGHT;
}

describe('aboutClampFor', () => {
  it('gives the opening paragraph more room than the rest', () => {
    expect(aboutClampFor(0)).toBe(6);
    expect(aboutClampFor(1)).toBe(4);
    expect(aboutClampFor(7)).toBe(4);
  });
});

describe('isAboutTruncated', () => {
  it('is false when every paragraph fits — the case that shipped broken', () => {
    // The exact shape of the screenshot on the report: a 5-line opener and a
    // 3-line second paragraph, both inside the clamp, and a Read more that
    // did nothing at all.
    expect(isAboutTruncated([h(5), h(3)])).toBe(false);
  });

  it('is false at exactly the budget', () => {
    // Six lines clamped to six lines hides nothing. Off-by-one here is the
    // difference between a working control and the bug.
    expect(isAboutTruncated([h(6)])).toBe(false);
    expect(isAboutTruncated([h(6), h(4)])).toBe(false);
  });

  it('is true one line past the budget', () => {
    expect(isAboutTruncated([h(7)])).toBe(true);
    expect(isAboutTruncated([h(6), h(5)])).toBe(true);
  });

  it('spots a later paragraph overflowing even when the opener fits', () => {
    // Each paragraph is clamped separately, so any one of them can be the
    // reason there is more to read.
    expect(isAboutTruncated([h(2), h(9)])).toBe(true);
  });

  it('ignores paragraphs that have not been measured yet', () => {
    // No layout has run: nothing is known, so nothing is claimed. The toggle
    // stays hidden until a measurement justifies it.
    expect(isAboutTruncated([])).toBe(false);
    expect(isAboutTruncated([0, 0])).toBe(false);
  });

  it('treats a measured paragraph as measured even if a sibling is not', () => {
    expect(isAboutTruncated([0, h(9)])).toBe(true);
  });

  it('rounds to the nearest line rather than truncating', () => {
    // Real layout heights arrive fractional (sub-pixel line boxes). A 6-line
    // paragraph measuring 132.4px must not read as 7 lines and resurrect a
    // dead button.
    expect(isAboutTruncated([h(6) + 0.4])).toBe(false);
    expect(isAboutTruncated([h(7) - 0.4])).toBe(true);
  });

  it('refuses to divide by a nonsense line height', () => {
    // Guards against a styling change that drops lineHeight: the honest
    // answer to "how many lines is this" then is "unknown", not Infinity.
    expect(isAboutTruncated([h(20)], 0)).toBe(false);
    expect(isAboutTruncated([h(20)], -22)).toBe(false);
  });
});
