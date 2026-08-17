/**
 * Layout maths for the generated poster.
 *
 * The thing worth testing here is NOT that the poster looks nice — no test can
 * tell you that, and `scripts/qa-generate-poster.ts` renders real PNGs for
 * exactly that reason. What is testable, and what will silently break, is the
 * fitting: SVG has no text layout engine, so every wrap, shrink and truncation
 * decision is arithmetic this module does by hand against an estimated
 * character advance. Get it wrong and text runs off the canvas with no error
 * anywhere.
 *
 * So these tests hold the two structural invariants the blank-poster guard
 * depends on, and then hammer the fitting with the inputs that actually break
 * it: a 60-character English title, a 45-character German compound noun, an
 * empty title, and a title made of one unbroken word.
 */

import {
  buildPosterLayout,
  estimateTextWidth,
  fitTitle,
  formatPosterDateLine,
  formatPosterVenueLine,
  hashSeed,
  maxCharsForWidth,
  MAX_TITLE_LINES,
  paletteForSeed,
  posterLayoutToSvgString,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  truncateToWidth,
  wrapText,
} from '../poster-template';
import { posterPalette } from '@/constants/poster-palette';

const COLUMN = POSTER_WIDTH - 72 * 2;

describe('wrapText', () => {
  it('keeps whole words together within the budget', () => {
    expect(wrapText('one two three four', 9)).toEqual(['one two', 'three', 'four']);
  });

  it('returns nothing for an empty or whitespace-only string', () => {
    expect(wrapText('', 20)).toEqual([]);
    expect(wrapText('   \n\t ', 20)).toEqual([]);
  });

  it('hard-splits a word longer than the whole line rather than overhanging', () => {
    // A real German event title. Without the hard split this single word would
    // render as one line running clean off the right edge of the poster.
    const lines = wrapText('Donaudampfschifffahrtsgesellschaft', 12);
    expect(lines.every((l) => l.length <= 12)).toBe(true);
    expect(lines.join('')).toBe('Donaudampfschifffahrtsgesellschaft');
  });

  it('flushes the pending line before hard-splitting an oversized word', () => {
    const lines = wrapText('an abcdefghijklmnop', 8);
    expect(lines[0]).toBe('an');
    expect(lines.every((l) => l.length <= 8)).toBe(true);
  });

  it('never emits a line over the budget, for any input', () => {
    const titles = [
      'Nachtstrom',
      'An Evening of Improvised Electroacoustic Music and Expanded Cinema',
      'Donaudampfschifffahrtsgesellschaftskapitänsabend',
      'a b c d e f g h i j k l m n o p q r s t u v w x y z',
      '🎧🎧🎧 Techno 🎧🎧🎧',
    ];
    for (const title of titles) {
      for (const budget of [4, 9, 17, 30, 64]) {
        for (const line of wrapText(title, budget)) {
          expect(line.length).toBeLessThanOrEqual(budget);
        }
      }
    }
  });
});

describe('maxCharsForWidth / estimateTextWidth', () => {
  it('never returns a budget below one character', () => {
    expect(maxCharsForWidth(1, 104, 'display')).toBe(1);
    expect(maxCharsForWidth(0, 104, 'display')).toBe(1);
  });

  it('estimates a full-budget line as no wider than the column', () => {
    // The round-trip that matters: whatever budget we hand wrapText, a line of
    // exactly that many characters must still be estimated to fit.
    for (const size of [104, 88, 76, 64, 54]) {
      const budget = maxCharsForWidth(COLUMN, size, 'display');
      expect(estimateTextWidth('x'.repeat(budget), size, 'display')).toBeLessThanOrEqual(COLUMN);
    }
  });

  it('rates the bold UI face wider than the regular one at the same size', () => {
    expect(estimateTextWidth('SAT 30 MAY', 40, 'uiBold')).toBeGreaterThan(
      estimateTextWidth('SAT 30 MAY', 40, 'ui')
    );
  });
});

describe('truncateToWidth', () => {
  it('leaves text that already fits completely alone', () => {
    expect(truncateToWidth('Badehaus', 34, 'ui', COLUMN)).toBe('Badehaus');
  });

  it('ellipsises text that does not fit, without exceeding the budget', () => {
    const long = 'Sonnenallee 123, 12059 Berlin, Neukölln, Germany, Planet Earth, Milky Way';
    const out = truncateToWidth(long, 34, 'ui', COLUMN);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(maxCharsForWidth(COLUMN, 34, 'ui'));
  });

  it('degrades to a bare ellipsis when there is room for nothing else', () => {
    expect(truncateToWidth('Badehaus', 34, 'ui', 1)).toBe('…');
  });

  it('returns empty for blank input rather than a lone ellipsis', () => {
    expect(truncateToWidth('   ', 34, 'ui', COLUMN)).toBe('');
  });
});

describe('fitTitle', () => {
  it('sets a short title at the largest size on the ladder', () => {
    const fitted = fitTitle('Nachtstrom');
    expect(fitted.fontSize).toBe(104);
    expect(fitted.lines).toEqual(['Nachtstrom']);
    expect(fitted.truncated).toBe(false);
  });

  it('steps down the ladder rather than overflowing a long title', () => {
    const short = fitTitle('Nachtstrom');
    const long = fitTitle('An Evening of Improvised Electroacoustic Music and Expanded Cinema');
    expect(long.fontSize).toBeLessThan(short.fontSize);
    expect(long.truncated).toBe(false);
  });

  it('never returns more lines than the template can hold, at any length', () => {
    for (const n of [1, 5, 20, 60, 200, 600]) {
      const fitted = fitTitle('Berliner Nacht '.repeat(n).trim());
      expect(fitted.lines.length).toBeLessThanOrEqual(MAX_TITLE_LINES);
      expect(fitted.lines.length).toBeGreaterThan(0);
    }
  });

  it('marks a clipped title as truncated and ellipsises the last line', () => {
    const fitted = fitTitle('Berliner Nacht '.repeat(40).trim());
    expect(fitted.truncated).toBe(true);
    expect(fitted.lines[fitted.lines.length - 1].endsWith('…')).toBe(true);
  });

  it('falls back to "Untitled" instead of an empty title block', () => {
    // Two text runs are required by assertLayoutIsPaintable; an empty title
    // that produced zero lines would leave only the wordmark and fail it.
    expect(fitTitle('   ').lines).toEqual(['Untitled']);
  });

  it('keeps every line within the estimated column width', () => {
    const fitted = fitTitle('Donaudampfschifffahrtsgesellschaftskapitänsabend');
    for (const line of fitted.lines) {
      expect(estimateTextWidth(line, fitted.fontSize, 'display')).toBeLessThanOrEqual(COLUMN);
    }
  });

  it('keeps the whole title block inside its vertical box', () => {
    const boxHeight = 260;
    const fitted = fitTitle('An Evening of Improvised Music', 936, boxHeight);
    expect(fitted.lines.length * fitted.lineHeight).toBeLessThanOrEqual(boxHeight);
  });
});

describe('paletteForSeed', () => {
  it('is deterministic — the same event always gets the same colours', () => {
    const seed = 'Nachtstrom|2026-09-12T22:00:00.000Z';
    expect(paletteForSeed(seed)).toBe(paletteForSeed(seed));
  });

  it('only ever returns a palette from the token list', () => {
    for (let i = 0; i < 200; i++) {
      expect(posterPalette).toContain(paletteForSeed(`event-${i}`));
    }
  });

  it('spreads across the palette rather than collapsing onto one entry', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(paletteForSeed(`Berlin Night ${i}`).bg);
    expect(seen.size).toBeGreaterThan(posterPalette.length / 2);
  });

  it('hashes inside the unsigned 32-bit range', () => {
    for (const s of ['', 'a', 'Nachtstrom', '🎧', 'x'.repeat(500)]) {
      const h = hashSeed(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThanOrEqual(0xffffffff);
    }
  });
});

describe('formatPosterDateLine', () => {
  it('renders weekday, day, uppercase month and time', () => {
    const line = formatPosterDateLine(new Date(2026, 8, 12, 22, 0).toISOString());
    expect(line).toMatch(/^[A-Z]{3} 12 SEPT? · 22:00$/);
  });

  it('appends an end time as a range when one is given', () => {
    const line = formatPosterDateLine(
      new Date(2026, 8, 12, 22, 0).toISOString(),
      new Date(2026, 8, 13, 6, 0).toISOString()
    );
    expect(line).toContain('22:00–06:00');
  });

  it('ignores an unparseable end time instead of poisoning the line', () => {
    const line = formatPosterDateLine(new Date(2026, 8, 12, 22, 0).toISOString(), 'not-a-date');
    expect(line).toContain('22:00');
    expect(line).not.toContain('Invalid');
  });

  it('returns empty for an unparseable start, so the run is dropped', () => {
    expect(formatPosterDateLine('not-a-date')).toBe('');
  });
});

describe('formatPosterVenueLine', () => {
  it('prefers the venue name', () => {
    expect(formatPosterVenueLine('Badehaus', 'Revaler Str. 99')).toBe('Badehaus');
  });

  it('falls back to the address, then to Berlin', () => {
    expect(formatPosterVenueLine(null, 'Revaler Str. 99')).toBe('Revaler Str. 99');
    expect(formatPosterVenueLine('  ', '  ')).toBe('Berlin');
    expect(formatPosterVenueLine()).toBe('Berlin');
  });
});

describe('buildPosterLayout', () => {
  const base = {
    title: 'Nachtstrom',
    startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
    locationName: 'Sameheads',
  };

  it('paints an opaque background over the entire canvas', () => {
    // The invariant the blank-poster guard rests on. If this ever stops being
    // true, a generated poster can be transparent — the exact production bug
    // that put eight holes in the Mural.
    const { background } = buildPosterLayout(base);
    expect(background).toMatchObject({ x: 0, y: 0, width: POSTER_WIDTH, height: POSTER_HEIGHT });
    expect(background.fill).toMatch(/^#[0-9a-fA-F]{6}$/);
  });

  it('always carries at least a title and the wordmark', () => {
    const layout = buildPosterLayout(base);
    const visible = layout.texts.filter((t) => t.text.trim() && t.opacity > 0.05);
    expect(visible.length).toBeGreaterThanOrEqual(2);
    expect(layout.texts.some((t) => t.text === 'SPHAER')).toBe(true);
  });

  it('holds those two invariants even for the most degenerate input', () => {
    const layout = buildPosterLayout({ title: '   ', startsAt: 'not-a-date' });
    expect(layout.background.width).toBe(POSTER_WIDTH);
    expect(layout.texts.filter((t) => t.text.trim() && t.opacity > 0.05).length).toBeGreaterThanOrEqual(2);
  });

  it('keeps every text run inside the canvas', () => {
    const layout = buildPosterLayout({
      ...base,
      title: 'Donaudampfschifffahrtsgesellschaftskapitänsabend',
      address: 'Sonnenallee 123, 12059 Berlin, Neukölln, Germany, Planet Earth',
    });
    for (const t of layout.texts) {
      expect(t.x).toBeGreaterThanOrEqual(0);
      expect(t.y).toBeGreaterThan(0);
      expect(t.y).toBeLessThanOrEqual(POSTER_HEIGHT);
      expect(t.x + estimateTextWidth(t.text, t.fontSize, t.role)).toBeLessThanOrEqual(POSTER_WIDTH);
    }
  });

  it('keeps every shape inside the canvas', () => {
    const layout = buildPosterLayout(base);
    for (const r of [layout.background, layout.band, ...layout.accents]) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(POSTER_WIDTH);
      expect(r.y + r.height).toBeLessThanOrEqual(POSTER_HEIGHT);
    }
  });

  it('draws the accent staircase only when there is no photo', () => {
    const withoutPhoto = buildPosterLayout(base);
    const withPhoto = buildPosterLayout({ ...base, photoDataUri: 'data:image/png;base64,AAAA' });
    expect(withoutPhoto.accents.length).toBeGreaterThan(withPhoto.accents.length);
    expect(withPhoto.photo).not.toBeNull();
    expect(withoutPhoto.photo).toBeNull();
  });

  it('never lets the accent marks collide with the type band', () => {
    const layout = buildPosterLayout(base);
    for (const a of layout.accents) {
      // The rule above the title lives inside the band by design; the marks in
      // the upper field must stay clear of it.
      if (a.y < layout.band.y) expect(a.y + a.height).toBeLessThanOrEqual(layout.band.y);
    }
  });

  it('reports a truncated title so the UI can tell the user', () => {
    expect(buildPosterLayout(base).titleTruncated).toBe(false);
    expect(
      buildPosterLayout({ ...base, title: 'Berliner Nacht '.repeat(40).trim() }).titleTruncated
    ).toBe(true);
  });

  it('drops the date run entirely when the start time is unparseable', () => {
    const layout = buildPosterLayout({ ...base, startsAt: 'not-a-date' });
    expect(layout.texts.some((t) => t.text === '')).toBe(false);
  });
});

describe('posterLayoutToSvgString', () => {
  const layout = buildPosterLayout({
    title: 'Nachtstrom',
    startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
    locationName: 'Sameheads',
  });

  it('emits a well-formed document at the layout dimensions', () => {
    const svg = posterLayoutToSvgString(layout);
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain(`viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}"`);
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true);
  });

  it('draws the opaque background before anything else', () => {
    const svg = posterLayoutToSvgString(layout);
    const firstRect = svg.indexOf('<rect');
    expect(svg.slice(firstRect, firstRect + 200)).toContain(`width="${POSTER_WIDTH}"`);
    expect(svg.indexOf('<text')).toBeGreaterThan(firstRect);
  });

  it('escapes markup in a title instead of emitting broken XML', () => {
    const hostile = buildPosterLayout({
      title: '<script>&"bad"</script>',
      startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
    });
    const svg = posterLayoutToSvgString(hostile);
    expect(svg).not.toContain('<script>');
    expect(svg).toContain('&lt;script&gt;');
    expect(svg).toContain('&amp;');
  });

  it('inlines a photo as an image element when one is present', () => {
    const withPhoto = buildPosterLayout({
      title: 'Nachtstrom',
      startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
      photoDataUri: 'data:image/png;base64,AAAA',
    });
    const svg = posterLayoutToSvgString(withPhoto);
    expect(svg).toContain('<image');
    expect(svg).toContain('preserveAspectRatio="xMidYMid slice"');
  });
});
