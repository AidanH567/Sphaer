/**
 * The upload path for generated circle covers.
 *
 * The landscape twin of `generated-poster-upload.test.ts`, and it exists for
 * the same reason: the guard in poster-guard.ts is only worth having if it sits
 * BETWEEN the renderer and Storage. A bad render must never reach
 * `storage.upload`, and the bytes that do reach it must be the exact PNG.
 *
 * ── The assertion this file exists for ───────────────────────────────────────
 * `assertPngIsPlausible` takes the expected dimensions as ARGUMENTS, which is
 * the whole reason a second aspect ratio needed no change to the guard. But an
 * argument that is passed wrongly is worse than a constant: a cover uploader
 * that accidentally checked against POSTER_WIDTH/POSTER_HEIGHT would reject
 * every real cover, and one that checked nothing would accept a portrait
 * poster into the circle banner slot. So the load-bearing test here is
 * "rejects a poster-shaped render" — it fails if the dimensions are ever
 * crossed over, and nothing else in the suite would notice.
 *
 * Kept out of a shared services test file because that would need two
 * incompatible `jest.mock('@/lib/supabase')` factories.
 */

import { uploadGeneratedCircleCover } from '../circles.service';
import { PosterGenerationError } from '@/utils/poster-guard';
import { COVER_HEIGHT, COVER_WIDTH } from '@/utils/cover-template';
import { POSTER_HEIGHT, POSTER_WIDTH } from '@/utils/poster-template';

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn(() => ({
  data: { publicUrl: 'https://cdn.example/circle-images/u1/c1-cover.png' },
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: (...args: unknown[]) => ({
        upload: (...u: unknown[]) => mockUpload(...args, ...u),
        getPublicUrl: (...g: unknown[]) => mockGetPublicUrl(...(g as [])),
      }),
    },
  },
}));

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function writeUint32(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

function makePngBase64(width: number, height: number, totalBytes = 40000): string {
  const bytes = new Uint8Array(Math.max(29, totalBytes));
  bytes.set(PNG_SIGNATURE, 0);
  writeUint32(bytes, 8, 13);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  writeUint32(bytes, 16, width);
  writeUint32(bytes, 20, height);
  bytes[24] = 8;
  bytes[25] = 6;
  for (let i = 29; i < bytes.length; i++) bytes[i] = (i * 31) % 251;
  return Buffer.from(bytes).toString('base64');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockResolvedValue({ error: null });
});

describe('uploadGeneratedCircleCover', () => {
  it('uploads a good cover as PNG under the owner folder', async () => {
    const url = await uploadGeneratedCircleCover(
      'u1',
      'c1',
      makePngBase64(COVER_WIDTH, COVER_HEIGHT)
    );

    const [bucket, path, , options] = mockUpload.mock.calls[0] as [
      string,
      string,
      ArrayBuffer,
      { upsert: boolean; contentType: string },
    ];
    // Circle images live in their own bucket, not with event posters.
    expect(bucket).toBe('circle-images');
    // The leading folder MUST be the user id — that is what the bucket's RLS
    // insert policy checks. A path without it fails at request time.
    expect(path).toBe('u1/c1-cover.png');
    expect(options).toMatchObject({ upsert: true, contentType: 'image/png' });
    expect(url).toContain('c1-cover.png');
    // Cache-buster, so a regenerated cover is not served from the old CDN copy.
    expect(url).toMatch(/\?v=\d+$/);
  });

  it('lands on the same path a picked cover uses, because a circle has one cover', async () => {
    await uploadGeneratedCircleCover('u1', 'c1', makePngBase64(COVER_WIDTH, COVER_HEIGHT));
    // `uploadCircleImage` writes `<userId>/<circleId>-cover.<ext>`. Generated
    // covers keep the `-cover` name deliberately: a second file nobody reads
    // is not a feature.
    expect(mockUpload.mock.calls[0][1]).toMatch(/^u1\/c1-cover\./);
  });

  it('sends the exact decoded bytes, with nothing appended', async () => {
    const b64 = makePngBase64(COVER_WIDTH, COVER_HEIGHT, 40001);
    await uploadGeneratedCircleCover('u1', 'c1', b64);

    const body = mockUpload.mock.calls[0][2] as ArrayBuffer;
    expect(Buffer.from(new Uint8Array(body)).equals(Buffer.from(b64, 'base64'))).toBe(true);
  });

  it('accepts an iOS device-scaled render', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(COVER_WIDTH * 3, COVER_HEIGHT * 3))
    ).resolves.toContain('c1-cover.png');
  });

  /**
   * The load-bearing one. A portrait poster is a perfectly valid PNG of a
   * perfectly plausible size — the ONLY thing separating it from a cover is
   * its aspect, and the only thing checking that is the pair of dimensions
   * this function passes to the guard.
   */
  it('rejects a poster-shaped render, so the two canvases cannot be crossed', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(POSTER_WIDTH, POSTER_HEIGHT))
    ).rejects.toBeInstanceOf(PosterGenerationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('rejects a square render, which is the avatar aspect and not this one', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(1080, 1080))
    ).rejects.toBeInstanceOf(PosterGenerationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads a snapshot taken before the canvas laid out', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(1, 1))
    ).rejects.toBeInstanceOf(PosterGenerationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads a correctly-sized but empty render', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(COVER_WIDTH, COVER_HEIGHT, 1500))
    ).rejects.toThrow(/blank/i);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads bytes that are not a PNG', async () => {
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', Buffer.alloc(40000).toString('base64'))
    ).rejects.toBeInstanceOf(PosterGenerationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('surfaces a Storage failure rather than returning a dead URL', async () => {
    mockUpload.mockResolvedValue({ error: new Error('row-level security') });
    await expect(
      uploadGeneratedCircleCover('u1', 'c1', makePngBase64(COVER_WIDTH, COVER_HEIGHT))
    ).rejects.toThrow('row-level security');
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });
});
