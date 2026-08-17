/**
 * The upload path for generated posters.
 *
 * The guard in poster-guard.ts is only worth having if it sits BETWEEN the
 * renderer and Storage. These tests hold that: a bad render must never reach
 * `storage.upload`, and the bytes that do reach it must be the exact PNG.
 *
 * Kept out of events.service.test.ts because that file stubs only the one
 * PostgREST chain it needs; this one needs the Storage client instead, and two
 * incompatible `jest.mock('@/lib/supabase')` factories cannot share a file.
 */

import { uploadGeneratedEventPoster } from '../events.service';
import { PosterGenerationError } from '@/utils/poster-guard';
import { POSTER_HEIGHT, POSTER_WIDTH } from '@/utils/poster-template';

const mockUpload = jest.fn();
const mockGetPublicUrl = jest.fn(() => ({
  data: { publicUrl: 'https://cdn.example/event-posters/u1/e1-poster.png' },
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

describe('uploadGeneratedEventPoster', () => {
  it('uploads a good poster as PNG under the owner folder', async () => {
    const url = await uploadGeneratedEventPoster(
      'u1',
      'e1',
      makePngBase64(POSTER_WIDTH, POSTER_HEIGHT)
    );

    const [bucket, path, , options] = mockUpload.mock.calls[0] as [
      string,
      string,
      ArrayBuffer,
      { upsert: boolean; contentType: string },
    ];
    expect(bucket).toBe('event-posters');
    // The leading folder MUST be the user id — that is what the bucket's RLS
    // insert policy checks. A path without it fails at request time.
    expect(path).toBe('u1/e1-poster.png');
    expect(options).toMatchObject({ upsert: true, contentType: 'image/png' });
    // `-poster` so a generated poster and a later hand-picked one coexist
    // rather than one silently overwriting the other.
    expect(path).not.toBe('u1/e1.png');
    expect(url).toContain('e1-poster.png');
    // Cache-buster, so a regenerated poster is not served from the old CDN copy.
    expect(url).toMatch(/\?v=\d+$/);
  });

  it('sends the exact decoded bytes, with nothing appended', async () => {
    const b64 = makePngBase64(POSTER_WIDTH, POSTER_HEIGHT, 40001);
    await uploadGeneratedEventPoster('u1', 'e1', b64);

    const body = mockUpload.mock.calls[0][2] as ArrayBuffer;
    expect(Buffer.from(new Uint8Array(body)).equals(Buffer.from(b64, 'base64'))).toBe(true);
  });

  it('accepts an iOS device-scaled render', async () => {
    await expect(
      uploadGeneratedEventPoster('u1', 'e1', makePngBase64(POSTER_WIDTH * 3, POSTER_HEIGHT * 3))
    ).resolves.toContain('e1-poster.png');
  });

  it('never uploads a snapshot taken before the canvas laid out', async () => {
    // The single most important assertion in this file: the failure that put
    // eight blank tiles on the Mural must die here, not in Storage.
    await expect(uploadGeneratedEventPoster('u1', 'e1', makePngBase64(1, 1))).rejects.toBeInstanceOf(
      PosterGenerationError
    );
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads a correctly-sized but empty render', async () => {
    await expect(
      uploadGeneratedEventPoster('u1', 'e1', makePngBase64(POSTER_WIDTH, POSTER_HEIGHT, 1500))
    ).rejects.toThrow(/blank/i);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('never uploads bytes that are not a PNG', async () => {
    await expect(
      uploadGeneratedEventPoster('u1', 'e1', Buffer.alloc(40000).toString('base64'))
    ).rejects.toBeInstanceOf(PosterGenerationError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('surfaces a Storage failure rather than returning a dead URL', async () => {
    mockUpload.mockResolvedValue({ error: new Error('row-level security') });
    await expect(
      uploadGeneratedEventPoster('u1', 'e1', makePngBase64(POSTER_WIDTH, POSTER_HEIGHT))
    ).rejects.toThrow('row-level security');
    expect(mockGetPublicUrl).not.toHaveBeenCalled();
  });
});
