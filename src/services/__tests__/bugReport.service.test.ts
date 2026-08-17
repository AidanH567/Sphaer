import {
  getIsDesigner,
  submitBugReport,
  listTriageReports,
  setReportStatus,
  saveTriageNote,
  getScreenshotUrl,
  BugReportUnavailableError,
  TriageNotPermittedError,
} from '../bugReport.service';
import type { BugReportRow } from '@/types/bug-reports';

// ---------------------------------------------------------------------------
// Follows the moderation.service.test.ts stub pattern: one shared chainable
// PostgREST builder whose terminals each test primes before calling the
// service. Storage gets its own upload/remove/sign stubs. No network anywhere
// — even uriToBlob's fetch(uri) is stubbed with a fake Blob-shaped object.
//
// The builder is THENABLE and every chaining method returns itself, so any
// order of .select/.eq/.in/.order/.limit resolves to the result primed for
// that table + operation. Results are keyed by table because one triage list
// call hits bug_reports AND profiles.
// ---------------------------------------------------------------------------

type Result = { data?: unknown; error: unknown };
type Op = 'select' | 'insert' | 'update';

let mockResults: Record<string, Partial<Record<Op, Result>>>;
let mockNextMaybeSingle: Result;
let mockNextUpload: { error: unknown };
let mockNextSignedUrl: { data: { signedUrl: string } | null; error: unknown };

const DEFAULT_RESULT: Result = { data: [], error: null };

function makeBuilder(table: string, op: Op) {
  const resolve = () => mockResults[table]?.[op] ?? DEFAULT_RESULT;
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = self;
  builder.eq = self;
  builder.in = self;
  builder.order = self;
  builder.limit = self;
  builder.maybeSingle = () => Promise.resolve(mockNextMaybeSingle);
  builder.then = (onFulfilled: (value: Result) => unknown, onRejected?: () => unknown) =>
    Promise.resolve(resolve()).then(onFulfilled, onRejected);
  return builder;
}

const mockFrom = jest.fn((table: string) => ({
  select: () => makeBuilder(table, 'select'),
  insert: () => makeBuilder(table, 'insert'),
  update: () => makeBuilder(table, 'update'),
}));

const mockInsertPayload = jest.fn();
const mockUpdatePayload = jest.fn();
const mockUpload = jest.fn(() => Promise.resolve(mockNextUpload));
const mockRemove = jest.fn(() => Promise.resolve({ error: null }));
const mockCreateSignedUrl = jest.fn(() => Promise.resolve(mockNextSignedUrl));
const mockStorageFrom = jest.fn((_bucket: string) => ({
  upload: mockUpload,
  remove: mockRemove,
  createSignedUrl: mockCreateSignedUrl,
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builders = mockFrom(table);
      return {
        select: builders.select,
        insert: (payload: unknown) => {
          mockInsertPayload(payload);
          return builders.insert();
        },
        update: (payload: unknown) => {
          mockUpdatePayload(payload);
          return builders.update();
        },
      };
    },
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

function row(overrides: Partial<BugReportRow> = {}): BugReportRow {
  return {
    id: 'report-1',
    reporter: 'user-1',
    description: 'the map pins vanish',
    kind: 'bug',
    severity: 'blocker',
    details: { expected: 'pins stay put' },
    screen: 'Map',
    app_version: '1.0.0',
    status: 'new',
    status_reason: null,
    triage_note: null,
    fix_prompt: null,
    screenshot_path: null,
    created_at: '2026-08-17T10:00:00Z',
    updated_at: '2026-08-17T10:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockResults = {};
  mockNextMaybeSingle = { data: null, error: null };
  mockNextUpload = { error: null };
  mockNextSignedUrl = { data: { signedUrl: 'https://signed/shot.png' }, error: null };
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

  it('defaults to kind "bug" when the caller omits it', async () => {
    await submitBugReport('me', { description: 'x' });
    expect(mockInsertPayload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'bug', details: {} })
    );
  });

  it('carries kind, severity and the structured details through', async () => {
    await submitBugReport('me', {
      description: 'the map opened blank',
      kind: 'bug',
      severity: 'blocker',
      details: { expected: 'the card slides up', steps: '1. tap a pin' },
      screen: 'Map',
    });
    expect(mockInsertPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'bug',
        severity: 'blocker',
        screen: 'Map',
        details: { expected: 'the card slides up', steps: '1. tap a pin' },
      })
    );
  });

  it('strips severity and screen from a non-bug — they are bug-only fields', async () => {
    // A kind switch can leave stale severity/screen in the form's state. The
    // service is the last place to catch it; triage would otherwise show a
    // feature request rated "blocker" on "Map" and believe it.
    await submitBugReport('me', {
      description: 'a filter for my circles',
      kind: 'feature',
      severity: 'blocker',
      screen: 'Map',
      details: { solution: 'a chip on the feed' },
    });
    expect(mockInsertPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'feature',
        severity: null,
        screen: null,
        details: { solution: 'a chip on the feed' },
      })
    );
  });

  it('rejects an empty primary answer before touching the network', async () => {
    await expect(submitBugReport('me', { description: '   ' })).rejects.toThrow(
      'Please fill in the first question'
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

  it('keeps the screenshot on a feature request — attachments are not bug-only', async () => {
    await submitBugReport('me', {
      description: 'a filter for my circles',
      kind: 'feature',
      screenshotUri: 'file:///tmp/mockup.png',
    });
    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockInsertPayload).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'feature', screenshot_path: expect.any(String) })
    );
  });

  it('removes the orphan screenshot when the row insert fails', async () => {
    mockResults = { bug_reports: { insert: { error: { code: '42501', message: 'denied' } } } };
    await expect(
      submitBugReport('me', { description: 'x', screenshotUri: 'file:///tmp/shot.jpg' })
    ).rejects.toMatchObject({ code: '42501' });
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it('throws BugReportUnavailableError when the table is missing (42P01)', async () => {
    mockResults = { bug_reports: { insert: { error: MISSING_TABLE_42P01 } } };
    await expect(submitBugReport('me', { description: 'x' })).rejects.toBeInstanceOf(
      BugReportUnavailableError
    );
  });

  it('throws BugReportUnavailableError when the table is missing (PGRST205)', async () => {
    mockResults = { bug_reports: { insert: { error: MISSING_TABLE_PGRST205 } } };
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
    mockResults = { bug_reports: { insert: { error: boom } } };
    await expect(submitBugReport('me', { description: 'x' })).rejects.toBe(boom);
  });
});

describe('listTriageReports', () => {
  it('joins each report to its reporter name', async () => {
    mockResults = {
      bug_reports: { select: { data: [row()], error: null } },
      profiles: {
        select: { data: [{ id: 'user-1', username: 'lara', display_name: 'Lara' }], error: null },
      },
    };
    const reports = await listTriageReports();
    expect(reports).toHaveLength(1);
    expect(reports[0].reporterName).toBe('lara');
  });

  it('labels a service-role row (no reporter) as Tina', async () => {
    // reporter is NULL for inlet 1 — Tina filing from Telegram, where there
    // is no app user. Triage must not render that as "Unknown account".
    mockResults = { bug_reports: { select: { data: [row({ reporter: null })], error: null } } };
    const reports = await listTriageReports();
    expect(reports[0].reporterName).toBe('Tina (Telegram)');
  });

  it('normalizes a kind it does not recognise back to bug', async () => {
    mockResults = {
      bug_reports: {
        select: {
          data: [row({ kind: 'wishlist' as never, severity: 'urgent' as never })],
          error: null,
        },
      },
      profiles: { select: { data: [], error: null } },
    };
    const reports = await listTriageReports();
    expect(reports[0].kind).toBe('bug');
    expect(reports[0].severity).toBeNull();
  });

  it('returns an empty queue rather than throwing when the schema is missing', async () => {
    mockResults = { bug_reports: { select: { data: null, error: MISSING_TABLE_42P01 } } };
    await expect(listTriageReports()).resolves.toEqual([]);
  });

  it('rethrows a real error — an empty queue must not hide a failure', async () => {
    const boom = { code: '42501', message: 'permission denied' };
    mockResults = { bug_reports: { select: { data: null, error: boom } } };
    await expect(listTriageReports()).rejects.toBe(boom);
  });
});

describe('triage writes — the permission logic', () => {
  it('approves a report and clears any stale rejection reason', async () => {
    mockResults = { bug_reports: { update: { data: [{ id: 'report-1' }], error: null } } };
    await expect(setReportStatus('report-1', 'approved')).resolves.toBeUndefined();
    expect(mockUpdatePayload).toHaveBeenCalledWith({ status: 'approved', status_reason: null });
  });

  it('refuses to reject without a reason, before any write', async () => {
    await expect(setReportStatus('report-1', 'rejected', '  ')).rejects.toThrow('Give a reason');
    expect(mockUpdatePayload).not.toHaveBeenCalled();
  });

  it('stores the trimmed rejection reason', async () => {
    mockResults = { bug_reports: { update: { data: [{ id: 'report-1' }], error: null } } };
    await setReportStatus('report-1', 'rejected', '  working as designed  ');
    expect(mockUpdatePayload).toHaveBeenCalledWith({
      status: 'rejected',
      status_reason: 'working as designed',
    });
  });

  it('throws TriageNotPermittedError when RLS silently matched no rows', async () => {
    // THE test for this feature. A non-designer's UPDATE is not an error
    // under RLS — it is a success that changed nothing. Without this check
    // the screen would say "Approved" and the queue would never move.
    mockResults = { bug_reports: { update: { data: [], error: null } } };
    await expect(setReportStatus('report-1', 'approved')).rejects.toBeInstanceOf(
      TriageNotPermittedError
    );
  });

  it('applies the same zero-rows check to notes', async () => {
    mockResults = { bug_reports: { update: { data: [], error: null } } };
    await expect(saveTriageNote('report-1', 'dupe')).rejects.toBeInstanceOf(
      TriageNotPermittedError
    );
  });

  it('clears the note when saved empty', async () => {
    mockResults = { bug_reports: { update: { data: [{ id: 'report-1' }], error: null } } };
    await saveTriageNote('report-1', '   ');
    expect(mockUpdatePayload).toHaveBeenCalledWith({ triage_note: null });
  });
});

describe('getScreenshotUrl', () => {
  it('returns the signed URL for a readable object', async () => {
    await expect(getScreenshotUrl('user-1/1.png')).resolves.toBe('https://signed/shot.png');
    expect(mockStorageFrom).toHaveBeenCalledWith('bug-screenshots');
  });

  it('returns null when signing is refused — a dead thumbnail, not a dead screen', async () => {
    mockNextSignedUrl = { data: null, error: { message: 'Object not found' } };
    await expect(getScreenshotUrl('someone-else/1.png')).resolves.toBeNull();
  });
});
