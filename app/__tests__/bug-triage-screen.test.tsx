import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import {
  getIsDesigner,
  listTriageReports,
  setReportStatus,
  saveTriageNote,
} from '@/services/bugReport.service';
import type { TriageReport } from '@/types/bug-reports';
import BugTriageScreen from '../bug-triage';

// ---------------------------------------------------------------------------
// The ADMIN surface. Two things matter here: that it is invisible without
// `profiles.is_designer`, and that a rejection cannot be committed without a
// reason. Both are enforced server-side too (RLS + the service) — these tests
// cover the layer a person actually touches.
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/services/bugReport.service', () => ({
  getIsDesigner: jest.fn(() => Promise.resolve(false)),
  listTriageReports: jest.fn(() => Promise.resolve([])),
  setReportStatus: jest.fn(() => Promise.resolve()),
  saveTriageNote: jest.fn(() => Promise.resolve()),
  getScreenshotUrl: jest.fn(() => Promise.resolve(null)),
  BugReportUnavailableError: class BugReportUnavailableError extends Error {},
  TriageNotPermittedError: class TriageNotPermittedError extends Error {},
}));

jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SafeAreaView: View,
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

function report(overrides: Partial<TriageReport> = {}): TriageReport {
  return {
    id: 'report-1',
    reporter: 'user-2',
    reporterName: 'lara',
    description: 'the map opened blank',
    kind: 'bug',
    severity: 'blocker',
    details: { expected: 'the card slides up' },
    screen: 'Map',
    app_version: '1.0.0',
    status: 'new',
    status_reason: null,
    triage_note: null,
    fix_prompt: null,
    screenshot_path: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getIsDesigner).mockResolvedValue(false);
  jest.mocked(listTriageReports).mockResolvedValue([]);
});

describe('triage screen — who can see it', () => {
  it('is a dead end without the is_designer flag, and loads nothing', async () => {
    render(<BugTriageScreen />);
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText('Nothing here.')).toBeTruthy();
    expect(screen.queryByLabelText('Filter: All')).toBeNull();
    // Not just hidden — a non-designer's device never queries the table.
    expect(listTriageReports).not.toHaveBeenCalled();
  });

  it('stays a dead end while the flag is still being fetched (fails closed)', () => {
    // useIsDesigner starts false, so nothing admin-shaped renders on the
    // first frame of a slow connection.
    jest.mocked(getIsDesigner).mockReturnValue(new Promise(() => {}));
    render(<BugTriageScreen />);
    expect(screen.getByText('Nothing here.')).toBeTruthy();
  });

  it('shows the queue to a designer', async () => {
    jest.mocked(getIsDesigner).mockResolvedValue(true);
    jest.mocked(listTriageReports).mockResolvedValue([report()]);

    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    expect(screen.queryByText('Nothing here.')).toBeNull();
    expect(listTriageReports).toHaveBeenCalled();
  });
});

describe('triage screen — reading a report back as fields', () => {
  beforeEach(() => {
    jest.mocked(getIsDesigner).mockResolvedValue(true);
  });

  it('renders kind, severity, screen, reporter and the structured detail', async () => {
    jest.mocked(listTriageReports).mockResolvedValue([report()]);
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    // "Bug" is both a filter chip and this card's kind badge.
    expect(screen.getAllByText('Bug').length).toBeGreaterThan(1);
    expect(screen.getByText('Blocker')).toBeTruthy();
    expect(screen.getByText('Map')).toBeTruthy();
    expect(screen.getByText('lara · v1.0.0')).toBeTruthy();
    // The detail is shown under the label it was ASKED under.
    expect(screen.getByText('What did you expect instead?')).toBeTruthy();
    expect(screen.getByText('the card slides up')).toBeTruthy();
  });

  it('labels a feature request with its own primary question', async () => {
    jest.mocked(listTriageReports).mockResolvedValue([
      report({
        kind: 'feature',
        severity: null,
        screen: null,
        description: 'I lose my circles events',
        details: { solution: 'a chip on the feed' },
      }),
    ]);
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('I lose my circles events')).toBeTruthy());

    expect(screen.getByText('What problem does this solve?')).toBeTruthy();
    expect(screen.getByText('Proposed solution')).toBeTruthy();
  });
});

describe('triage screen — actions', () => {
  beforeEach(() => {
    jest.mocked(getIsDesigner).mockResolvedValue(true);
    jest.mocked(listTriageReports).mockResolvedValue([report()]);
  });

  it('approves in one tap', async () => {
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Approve report: the map opened blank'));
    await waitFor(() => expect(setReportStatus).toHaveBeenCalledWith('report-1', 'approved'));
  });

  it('will not commit a rejection without a reason', async () => {
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Reject report: the map opened blank'));
    fireEvent.press(screen.getByLabelText('Confirm rejection'));

    expect(screen.getByText('Say why — the reporter sees this.')).toBeTruthy();
    expect(setReportStatus).not.toHaveBeenCalled();
  });

  it('sends the rejection reason once given', async () => {
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Reject report: the map opened blank'));
    fireEvent.changeText(
      screen.getByPlaceholderText(
        'Working as designed — the feed is chronological on purpose.'
      ),
      'cannot reproduce'
    );
    fireEvent.press(screen.getByLabelText('Confirm rejection'));

    await waitFor(() =>
      expect(setReportStatus).toHaveBeenCalledWith('report-1', 'rejected', 'cannot reproduce')
    );
  });

  it('saves a note', async () => {
    render(<BugTriageScreen />);
    await waitFor(() => expect(screen.getByText('the map opened blank')).toBeTruthy());

    fireEvent.press(screen.getByLabelText('Add a note'));
    fireEvent.changeText(
      screen.getByPlaceholderText('Dupe of the mural one · needs a design call first'),
      'dupe of the mural one'
    );
    fireEvent.press(screen.getByLabelText('Save note on the map opened blank'));

    await waitFor(() =>
      expect(saveTriageNote).toHaveBeenCalledWith('report-1', 'dupe of the mural one')
    );
  });
});
