/**
 * The blank-poster guard.
 *
 * Production already has the failure these tests defend against: eight of the
 * fifty seeded Mural posters are valid WebP files that download with HTTP 200,
 * decode without error, report sane dimensions, and paint nothing — their
 * alpha channel is entirely zero (`scripts/audit-posters.ts` measures them at
 * 0.0% visible pixels). No type, no status code, and no try/catch in the app
 * noticed. A generator without this guard would manufacture that bug at scale,
 * one poster per published activity.
 *
 * So the tests below are written adversarially: every case is a shape of
 * "looks fine, paints nothing" that could plausibly reach the upload call.
 */

import {
  assertLayoutIsPaintable,
  assertPngIsPlausible,
  base64ToBytes,
  isOpaqueColor,
  MAX_ASPECT_DRIFT,
  MIN_POSTER_BYTES,
  PosterGenerationError,
  readPngHeader,
} from '../poster-guard';
import { buildPosterLayout, POSTER_HEIGHT, POSTER_WIDTH } from '../poster-template';
import type { PosterLayout } from '../poster-template';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

/**
 * A byte-accurate PNG signature + IHDR, padded to `totalBytes` with filler.
 * Deliberately NOT a real image: the guard's whole point is that it reads the
 * header and the size, which is all a phone can afford to do.
 */
function makePng(width: number, height: number, totalBytes = 40000): Uint8Array {
  const bytes = new Uint8Array(Math.max(29, totalBytes));
  bytes.set(PNG_SIGNATURE, 0);
  writeUint32(bytes, 8, 13); // IHDR chunk length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  writeUint32(bytes, 16, width);
  writeUint32(bytes, 20, height);
  bytes[24] = 8; // bit depth
  bytes[25] = 6; // colour type: RGBA
  // Filler so the byte-count check sees a plausible payload rather than zeros
  // that a future compression heuristic might treat as suspicious.
  for (let i = 29; i < bytes.length; i++) bytes[i] = (i * 31) % 251;
  return bytes;
}

const goodLayout = (): PosterLayout =>
  buildPosterLayout({
    title: 'Nachtstrom',
    startsAt: new Date(2026, 8, 12, 22, 0).toISOString(),
    locationName: 'Sameheads',
  });

// ─── base64ToBytes ───────────────────────────────────────────────────────────

describe('base64ToBytes', () => {
  it('matches Buffer for arbitrary binary payloads', () => {
    // This decoder exists because React Native, Hermes and the browser
    // disagree about atob/Buffer on binary data, and it sits on the path that
    // produces the bytes we upload. A subtly wrong decode uploads a corrupt
    // PNG — the blank tile, again, by another route.
    for (const length of [0, 1, 2, 3, 4, 5, 17, 256, 1023]) {
      const source = Buffer.from(
        Array.from({ length }, (_, i) => (i * 97 + 13) % 256)
      );
      const decoded = base64ToBytes(source.toString('base64'));
      expect(Buffer.from(decoded).equals(source)).toBe(true);
    }
  });

  it('accepts a full data: URI as well as a bare base64 string', () => {
    const source = Buffer.from([1, 2, 3, 4, 5]);
    const b64 = source.toString('base64');
    expect(Buffer.from(base64ToBytes(`data:image/png;base64,${b64}`)).equals(source)).toBe(true);
    expect(Buffer.from(base64ToBytes(b64)).equals(source)).toBe(true);
  });

  it('tolerates the line breaks iOS puts in its base64', () => {
    // RNSVGSvgView encodes with NSDataBase64EncodingEndLineWithLineFeed, so
    // every capture from an iPhone arrives with newlines in it.
    const source = Buffer.from(Array.from({ length: 200 }, (_, i) => i % 256));
    const wrapped = (source.toString('base64').match(/.{1,64}/g) ?? []).join('\n');
    expect(Buffer.from(base64ToBytes(wrapped)).equals(source)).toBe(true);
  });

  it('returns an exact-length buffer, so .buffer can be uploaded directly', () => {
    // A subarray's `.buffer` is the whole over-allocated block; uploading it
    // would append trailing zeros and corrupt the PNG.
    for (const length of [1, 2, 3, 4, 5, 100, 101, 102]) {
      const bytes = base64ToBytes(
        Buffer.from(new Uint8Array(length).fill(7)).toString('base64')
      );
      expect(bytes.byteLength).toBe(length);
      expect(bytes.buffer.byteLength).toBe(length);
    }
  });

  it('rejects characters outside the base64 alphabet', () => {
    expect(() => base64ToBytes('not valid base64!!')).toThrow(PosterGenerationError);
  });
});

// ─── readPngHeader ───────────────────────────────────────────────────────────

describe('readPngHeader', () => {
  it('reads dimensions out of a well-formed header', () => {
    expect(readPngHeader(makePng(1080, 1528))).toMatchObject({
      width: 1080,
      height: 1528,
      bitDepth: 8,
      colorType: 6,
    });
  });

  it('reads dimensions above 32767 without sign-extending them', () => {
    // A naive `<< 24` on the high byte goes negative. iOS at @3x is nowhere
    // near this, but the arithmetic should be right regardless.
    expect(readPngHeader(makePng(100000, 100000))?.width).toBe(100000);
  });

  it('rejects anything that is not a PNG', () => {
    expect(readPngHeader(new Uint8Array(0))).toBeNull();
    expect(readPngHeader(new Uint8Array(28))).toBeNull();
    // A JPEG — right shape of thing, wrong format.
    const jpeg = new Uint8Array(64);
    jpeg.set([0xff, 0xd8, 0xff, 0xe0], 0);
    expect(readPngHeader(jpeg)).toBeNull();
  });

  it('rejects a PNG signature whose first chunk is not a valid IHDR', () => {
    const wrongLength = makePng(1080, 1528);
    writeUint32(wrongLength, 8, 12);
    expect(readPngHeader(wrongLength)).toBeNull();

    const wrongType = makePng(1080, 1528);
    wrongType.set([0x49, 0x44, 0x41, 0x54], 12); // "IDAT" where IHDR must be
    expect(readPngHeader(wrongType)).toBeNull();
  });
});

// ─── isOpaqueColor ───────────────────────────────────────────────────────────

describe('isOpaqueColor', () => {
  it('accepts only hex forms that carry no alpha channel', () => {
    expect(isOpaqueColor('#0A0A0A')).toBe(true);
    expect(isOpaqueColor('#abc')).toBe(true);
    expect(isOpaqueColor('  #F5D547  ')).toBe(true);
  });

  it('rejects every form that can be see-through', () => {
    // #RRGGBBAA, rgba(), named colours and the empty string all could resolve
    // to something transparent — which is the failure, not an edge case.
    for (const fill of [
      '#0A0A0A00',
      '#0A0A0AFF',
      'rgba(0,0,0,0)',
      'transparent',
      'black',
      '',
      'none',
    ]) {
      expect(isOpaqueColor(fill)).toBe(false);
    }
  });
});

// ─── assertLayoutIsPaintable ─────────────────────────────────────────────────

describe('assertLayoutIsPaintable', () => {
  it('passes a real layout', () => {
    expect(() => assertLayoutIsPaintable(goodLayout())).not.toThrow();
  });

  it('rejects a background that does not cover the whole canvas', () => {
    const layout = goodLayout();
    layout.background = { ...layout.background, width: POSTER_WIDTH - 1 };
    expect(() => assertLayoutIsPaintable(layout)).toThrow(PosterGenerationError);

    const offset = goodLayout();
    offset.background = { ...offset.background, y: 1 };
    expect(() => assertLayoutIsPaintable(offset)).toThrow(PosterGenerationError);
  });

  it('rejects a background that could be transparent', () => {
    // This is the exact production failure, expressed as a layout: an image
    // whose every pixel is see-through. It must never get as far as a render.
    const layout = goodLayout();
    layout.background = { ...layout.background, fill: 'rgba(0,0,0,0)' };
    expect(() => assertLayoutIsPaintable(layout)).toThrow(PosterGenerationError);

    const eightDigit = goodLayout();
    eightDigit.background = { ...eightDigit.background, fill: '#0A0A0A00' };
    expect(() => assertLayoutIsPaintable(eightDigit)).toThrow(PosterGenerationError);
  });

  it('rejects a poster with no readable text on it', () => {
    const layout = goodLayout();
    layout.texts = [];
    expect(() => assertLayoutIsPaintable(layout)).toThrow(
      /not enough information on this activity/i
    );
  });

  it('does not count blank or near-invisible runs as text', () => {
    const layout = goodLayout();
    layout.texts = layout.texts.map((t) => ({ ...t, opacity: 0.01 }));
    expect(() => assertLayoutIsPaintable(layout)).toThrow(PosterGenerationError);

    const whitespace = goodLayout();
    whitespace.texts = whitespace.texts.map((t) => ({ ...t, text: '   ' }));
    expect(() => assertLayoutIsPaintable(whitespace)).toThrow(PosterGenerationError);
  });

  it('gives a message a user can act on, not a stack trace', () => {
    const layout = goodLayout();
    layout.texts = [];
    try {
      assertLayoutIsPaintable(layout);
      throw new Error('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PosterGenerationError);
      expect((e as Error).message).toMatch(/Add a title/);
    }
  });
});

// ─── assertPngIsPlausible ────────────────────────────────────────────────────

describe('assertPngIsPlausible', () => {
  it('accepts an exact-size render (Android, web)', () => {
    const header = assertPngIsPlausible(
      makePng(POSTER_WIDTH, POSTER_HEIGHT),
      POSTER_WIDTH,
      POSTER_HEIGHT
    );
    expect(header.width).toBe(POSTER_WIDTH);
  });

  it('accepts a device-scaled render (iOS @2x and @3x)', () => {
    // iOS renders through UIGraphicsImageRenderer at screen scale, so the very
    // same request comes back 2× or 3× larger. Those are correct, higher-
    // resolution posters and rejecting them would break every iPhone.
    for (const scale of [2, 3]) {
      expect(() =>
        assertPngIsPlausible(
          makePng(POSTER_WIDTH * scale, POSTER_HEIGHT * scale),
          POSTER_WIDTH,
          POSTER_HEIGHT
        )
      ).not.toThrow();
    }
  });

  it('rejects the snapshot-before-layout failures', () => {
    // toDataURL firing before the offscreen SVG has laid out returns a
    // perfectly valid PNG that happens to be empty.
    for (const [w, h] of [
      [0, 0],
      [1, 1],
      [2, 3],
    ]) {
      expect(() => assertPngIsPlausible(makePng(w, h), POSTER_WIDTH, POSTER_HEIGHT)).toThrow(
        PosterGenerationError
      );
    }
  });

  it('rejects a render smaller than the layout asked for', () => {
    expect(() =>
      assertPngIsPlausible(
        makePng(POSTER_WIDTH - 1, POSTER_HEIGHT - 1),
        POSTER_WIDTH,
        POSTER_HEIGHT
      )
    ).toThrow(/smaller than/i);
  });

  it('rejects a render of the wrong shape even when it is large enough', () => {
    // A square snapshot at poster resolution means the viewBox was not applied
    // — the poster would be stretched or cropped on the wall.
    expect(() =>
      assertPngIsPlausible(makePng(2000, 2000), POSTER_WIDTH, POSTER_HEIGHT)
    ).toThrow(/wrong shape/i);
  });

  it('tolerates one pixel of rounding but not real distortion', () => {
    expect(() =>
      assertPngIsPlausible(makePng(POSTER_WIDTH + 1, POSTER_HEIGHT + 1), POSTER_WIDTH, POSTER_HEIGHT)
    ).not.toThrow();
    const distorted = Math.round(POSTER_WIDTH * (1 + MAX_ASPECT_DRIFT * 4));
    expect(() =>
      assertPngIsPlausible(makePng(distorted, POSTER_HEIGHT), POSTER_WIDTH, POSTER_HEIGHT)
    ).toThrow(/wrong shape/i);
  });

  it('rejects a correctly-sized PNG that is far too small to hold a poster', () => {
    // The other half of the production failure: the eight broken Mural posters
    // are ~1.5 KB files that report perfectly sane dimensions.
    expect(() =>
      assertPngIsPlausible(
        makePng(POSTER_WIDTH, POSTER_HEIGHT, MIN_POSTER_BYTES - 1),
        POSTER_WIDTH,
        POSTER_HEIGHT
      )
    ).toThrow(/blank/i);
  });

  it('rejects bytes that are not a PNG at all', () => {
    expect(() =>
      assertPngIsPlausible(new Uint8Array(40000), POSTER_WIDTH, POSTER_HEIGHT)
    ).toThrow(/didn't render properly/i);
  });

  it('names the actual dimensions in its message, so a bug report is useful', () => {
    try {
      assertPngIsPlausible(makePng(1, 1), POSTER_WIDTH, POSTER_HEIGHT);
      throw new Error('should have thrown');
    } catch (e) {
      expect((e as Error).message).toContain('1×1');
    }
  });
});
