import {
  getIsDesigner,
  submitBugReport,
  BugReportUnavailableError,
} from '../bugReport.service';

// ---------------------------------------------------------------------------
// Follows the moderation.service.test.ts stub pattern: one shared chainable
// PostgREST builder whose terminals each test primes before calling the
// service. Storage gets its own upload/remove stubs. No network anywhere —
// even uriToBlob's fetch(uri) is stubbed with a fake Blob-shaped object.
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };

let mockNextInsert: Result;
let mockNextMaybeSingle: Result;
let mockNextUpload: { error: unknown };

const mockFrom = jest.fn((_table: string) => {
  const readChain: Record<string, unknown> = {};
  readChain.select = () => readChain;
  readChain.eq = () => readChain;
  readChain.maybeSingle = () => Promise.resolve(mockNextMaybeSingle);
  return {
    select: () => readChain,
    insert: () => ({
      then: (onFulfilled: (v: Result) => unknown) =>
        Promise.resolve(mockNextInsert).then(onFulfilled),
    }),
  };
});

const mockUpload = jest.fn(() => Promise.resolve(mockNextUpload));
const mockRemove = jest.fn(() => Promise.resolve({ error: null }));
const mockStorageFrom = jest.fn((_bucket: string) => ({
  upload: mockUpload,
  remove: mockRemove,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
    storage: { from: (bucket: string) => mockStorageFrom(bucket) },
  },
}));

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

// uriToBlob does `fetch(uri)` → `.blob()`. Return a Blob-shaped object that
// passes validateImageUpload (typed, under the 10 MB cap).
const mockBlob = { type: 'image/jpeg', size: 1234 };
global.fetch = jest.fn(() =>
  Promise.resolve({ blob: () => Promise.resolve(mockBlob) })
) as unknown as typeof fetch;

const MISSING_TABLE_42P01 = { code: '42P01', message: 'relation "bug_reports" does not exist' };
const MISSING_TABLE_PGRST205 = {
  code: 'PGRST205',
  message: "Could not find the table 'public.bug_reports' in the schema cache",
};
const MISSING_COLUMN_42703 = {
  code: '42703',
  message: 'column profiles.is_designer does not exist',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNextInsert = { error: null };
  mockNextMaybeSingle = { data: null, error: null };
  mockNextUpload = { error: null };
});

describe('getIsDesigner', () => {
  it('returns true when the profile is flagged', async () => {
    mockNextMaybeSingle = { data: { is_designer: true }, error: null };
    await expect(getIsDesigner('me')).resolves.toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('profiles');
  });

  it('returns false when the flag is false', async () => {
    mockNextMaybeSingle = { data: { is_designer: false }, error: null };
    await expect(getIsDesigner('me')).resolves.toBe(false);
  });

  it('returns false when there is no profile row', async () => {
    mockNextMaybeSingle = { data: null, error: null };
    await expect(getIsDesigner('me')).resolves.toBe(false);
  });

  it('fails closed when the column does not exist yet (42703)', async () => {
    mockNextMaybeSingle = { data: null, error: MISSING_COLUMN_42703 };
    await expect(getIsDesigner('me')).resolves.toBe(false);
  });

  it('fails closed on ANY error — the gate never surfaces failures', async () => {
    mockNextMaybeSingle = { data: null, error: { code: '42501', message: 'permission denied' } };
    await expect(getIsDesigner('me')).resolves.toBe(false);
  });
});

describe('submitBugReport', () => {
  it('inserts a row with the trimmed description and resolves', async () => {
    await expect(
      submitBugReport('me', { description: '  the map pins vanish  ' })
    ).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith('bug_reports');
    expect(mockStorageFrom).not.toHaveBeenCalled(); // no screenshot → no storage
  });

  it('rejects an empty description before touching the network', async () => {
    await expect(submitBugReport('me', { description: '   ' })).rejects.toThrow(
      'Please describe the bug'
    );
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it('uploads the screenshot to bug-screenshots before inserting', async () => {
    await expect(
      submitBugReport('me', {
        description: 'poster is stretched',
        screen: 'Mural',
        screenshotUri: 'file:///tmp/shot.png',
      })
    ).resolves.toBeUndefined();
    expect(mockStorageFrom).toHaveBeenCalledWith('bug-screenshots');
    expect(mockUpload).toHaveBeenCalledTimes(1);
    // Path scheme: <userId>/<timestamp>.<ext> inside the user's own folder.
    const uploadedPath = (mockUpload.mock.calls[0] as unknown[])[0] as string;
    expect(uploadedPath).toMatch(/^me\/\d+\.png$/);
    expect(mockFrom).toHaveBeenCalledWith('bug_reports');
  });

  it('removes the orphan screenshot when the row insert fails', async () => {
    mockNextInsert = { error: { code: '42501', message: 'permission denied' } };
    await expect(
      submitBugReport('me', { description: 'x', screenshotUri: 'file:///tmp/shot.jpg' })
    ).rejects.toMatchObject({ code: '42501' });
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('throws BugReportUnavailableError when the table is missing (42P01)', async () => {
    mockNextInsert = { error: MISSING_TABLE_42P01 };
    await expect(submitBugReport('me', { description: 'x' })).rejects.toBeInstanceOf(
      BugReportUnavailableError
    );
  });

  it('throws BugReportUnavailableError when the table is missing (PGRST205)', async () => {
    mockNextInsert = { error: MISSING_TABLE_PGRST205 };
    await expect(submitBugReport('me', { description: 'x' })).rejects.toBeInstanceOf(
      BugReportUnavailableError
    );
  });

  it('throws BugReportUnavailableError when the bucket is missing', async () => {
    mockNextUpload = { error: { message: 'Bucket not found' } };
    await expect(
      submitBugReport('me', { description: 'x', screenshotUri: 'file:///tmp/shot.jpg' })
    ).rejects.toBeInstanceOf(BugReportUnavailableError);
    expect(mockFrom).not.toHaveBeenCalled(); // upload failed → no insert attempted
  });

  it('rethrows an unrelated insert error untouched', async () => {
    const boom = { code: '23514', message: 'check constraint violation' };
    mockNextInsert = { error: boom };
    await expect(submitBugReport('me', { description: 'x' })).rejects.toBe(boom);
  });
});
