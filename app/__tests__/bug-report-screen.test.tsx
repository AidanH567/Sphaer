import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { submitBugReport } from '@/services/bugReport.service';
import BugReportScreen from '../bug-report';

// ---------------------------------------------------------------------------
// The type-aware form: does picking a kind change WHICH questions get asked,
// and does the right shape reach the service? All mocks inline, per the
// project's testing policy.
// ---------------------------------------------------------------------------

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}));

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('@/services/bugReport.service', () => ({
  submitBugReport: jest.fn(() => Promise.resolve()),
  BugReportUnavailableError: class BugReportUnavailableError extends Error {},
}));

jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ granted: false })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true })),
  MediaTypeOptions: { Images: 'Images' },
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

beforeEach(() => {
  jest.mocked(submitBugReport).mockClear();
});

describe('report screen — kind-conditional fields', () => {
  it('opens on Bug and asks the bug questions', () => {
    render(<BugReportScreen />);
    expect(screen.getByText('What happened?')).toBeTruthy();
    expect(screen.getByText('What did you expect instead? (optional)')).toBeTruthy();
    expect(screen.getByText('Steps to reproduce (optional)')).toBeTruthy();
    // Bug-only extras.
    expect(screen.getByText('How bad is it?')).toBeTruthy();
    expect(screen.getByText('Which screen?')).toBeTruthy();
  });

  it('no longer opens with bug-only wording that shuts out feature ideas', () => {
    render(<BugReportScreen />);
    expect(screen.queryByText('What went wrong?')).toBeNull();
    expect(screen.getByText('Report or suggest')).toBeTruthy();
  });

  it('swaps to the feature questions and drops severity + screen', () => {
    render(<BugReportScreen />);
    fireEvent.press(screen.getByLabelText('Feature report'));

    expect(screen.getByText('What problem does this solve?')).toBeTruthy();
    expect(screen.getByText('Proposed solution (optional)')).toBeTruthy();
    expect(screen.getByText("Who's it for? (optional)")).toBeTruthy();

    expect(screen.queryByText('What happened?')).toBeNull();
    expect(screen.queryByText('Steps to reproduce (optional)')).toBeNull();
    expect(screen.queryByText('How bad is it?')).toBeNull();
    expect(screen.queryByText('Which screen?')).toBeNull();
  });

  it('swaps to the change questions — just what and why', () => {
    render(<BugReportScreen />);
    fireEvent.press(screen.getByLabelText('Change report'));

    expect(screen.getByText('What should change?')).toBeTruthy();
    expect(screen.getByText('Why? (optional)')).toBeTruthy();
    expect(screen.queryByText('Proposed solution (optional)')).toBeNull();
    expect(screen.queryByText('How bad is it?')).toBeNull();
  });

  it('keeps the screenshot attach on every kind', () => {
    render(<BugReportScreen />);
    expect(screen.getByLabelText('Attach a screenshot')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Feature report'));
    expect(screen.getByLabelText('Attach a screenshot')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Change report'));
    expect(screen.getByLabelText('Attach a screenshot')).toBeTruthy();
  });

  it('names the missing field when the primary answer is blank', () => {
    render(<BugReportScreen />);
    fireEvent.press(screen.getByLabelText('Feature report'));
    fireEvent.press(screen.getByLabelText('Send report'));

    expect(screen.getByText('Please answer "What problem does this solve?".')).toBeTruthy();
    expect(submitBugReport).not.toHaveBeenCalled();
  });

  it('files a bug with its severity, screen and structured details', async () => {
    render(<BugReportScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('The map opened blank after I tapped a pin.'),
      'the map opened blank'
    );
    fireEvent.changeText(
      screen.getByPlaceholderText("I expected the pin's event card to slide up."),
      'the card should slide up'
    );
    fireEvent.press(screen.getByLabelText('Severity: Blocker'));
    fireEvent.press(screen.getByLabelText('Screen: Map'));
    fireEvent.press(screen.getByLabelText('Send report'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(submitBugReport).toHaveBeenCalledWith('user-1', {
      description: 'the map opened blank',
      kind: 'bug',
      severity: 'blocker',
      screen: 'Map',
      details: { expected: 'the card should slide up' },
      screenshotUri: null,
    });
  });

  it('does not leak a bug answer into a feature filed afterwards', async () => {
    // The screen keeps ONE answers map across kind switches so typing is not
    // lost. This is the regression that guards it: what you typed under
    // "Steps to reproduce" must not ride along on a feature request.
    render(<BugReportScreen />);
    fireEvent.changeText(
      screen.getByPlaceholderText('1. Open Map\n2. Tap any pin\n3. Screen goes white'),
      '1. open the map'
    );
    fireEvent.press(screen.getByLabelText('Feature report'));
    fireEvent.changeText(
      screen.getByPlaceholderText('I can never find the events my circles posted last week.'),
      'I lose my circles events'
    );
    fireEvent.press(screen.getByLabelText('Send report'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitBugReport).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ kind: 'feature', details: {}, severity: null, screen: null })
    );
  });
});
