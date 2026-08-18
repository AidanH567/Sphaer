import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import * as ImagePicker from 'expo-image-picker';
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

/**
 * The annotator is stubbed at its own boundary: this file tests the FORM's
 * side of the feature (dimensions captured, pen offered, flattened image
 * sent), while the drawing itself — strokes, undo, clear, colours, capture —
 * is covered against the real component in ScreenshotAnnotator.test.tsx.
 * Recording the props is what lets these tests assert the handoff in both
 * directions.
 */
interface AnnotatorProps {
  uri: string;
  sourceWidth: number;
  sourceHeight: number;
  onCancel: () => void;
  onSave: (result: { base64: string; dataUri: string }) => void;
}

let mockLastAnnotatorProps: AnnotatorProps | null = null;

jest.mock('@/components/bug-report/ScreenshotAnnotator', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ScreenshotAnnotator: (props: AnnotatorProps) => {
      mockLastAnnotatorProps = props;
      return ReactActual.createElement(View, { testID: 'screenshot-annotator' });
    },
  };
});

beforeEach(() => {
  jest.mocked(submitBugReport).mockClear();
  mockLastAnnotatorProps = null;
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
      screenshotBase64: null,
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

// ─── Annotation wiring ───────────────────────────────────────────────────────
// The form's job in this feature is narrow: capture the screenshot's real
// dimensions, offer the pen, and send the FLATTENED image rather than the raw
// one. The drawing itself is covered in ScreenshotAnnotator.test.tsx.

describe('report screen — screenshot annotation', () => {
  const asset = { uri: 'file:///tmp/shot.png', width: 1170, height: 2532 };

  async function attach(overrides: Partial<typeof asset> = {}) {
    jest.mocked(ImagePicker.requestMediaLibraryPermissionsAsync).mockResolvedValue({
      granted: true,
    } as never);
    jest.mocked(ImagePicker.launchImageLibraryAsync).mockResolvedValue({
      canceled: false,
      assets: [{ ...asset, ...overrides }],
    } as never);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Attach a screenshot'));
    });
  }

  it('offers the pen once a screenshot is attached', async () => {
    render(<BugReportScreen />);
    expect(screen.queryByLabelText('Circle what is wrong')).toBeNull();
    await attach();
    expect(screen.getByLabelText('Circle what is wrong')).toBeTruthy();
  });

  it('opens the annotator on the screenshot that was picked', async () => {
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));
    expect(screen.getByTestId('screenshot-annotator')).toBeTruthy();
    expect(mockLastAnnotatorProps?.uri).toBe('file:///tmp/shot.png');
  });

  it('sends the flattened image, not the screenshot it was drawn on', async () => {
    // The heart of the wiring. Sending `screenshotUri` alone would upload the
    // un-marked original and look identical from the form — the marks would
    // simply never arrive.
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));

    await act(async () => {
      mockLastAnnotatorProps?.onSave({
        base64: 'RkxBVFRFTkVE',
        dataUri: 'data:image/png;base64,RkxBVFRFTkVE',
      });
    });

    fireEvent.changeText(
      screen.getByPlaceholderText('The map opened blank after I tapped a pin.'),
      'the padding on this card is wrong'
    );
    fireEvent.press(screen.getByLabelText('Send report'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(submitBugReport).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        screenshotUri: 'file:///tmp/shot.png',
        screenshotBase64: 'RkxBVFRFTkVE',
      })
    );
  });

  it('says so once marks have been added, and offers to edit them', async () => {
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));
    await act(async () => {
      mockLastAnnotatorProps?.onSave({ base64: 'QQ==', dataUri: 'data:image/png;base64,QQ==' });
    });
    expect(screen.getByText('Marked up')).toBeTruthy();
    expect(screen.getByLabelText('Edit your marks')).toBeTruthy();
  });

  it('drops the marks when the screenshot is removed', async () => {
    // Otherwise a second screenshot would be sent with the FIRST one's
    // annotation flattened into it.
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));
    await act(async () => {
      mockLastAnnotatorProps?.onSave({ base64: 'QQ==', dataUri: 'data:image/png;base64,QQ==' });
    });
    fireEvent.press(screen.getByLabelText('Remove screenshot'));
    expect(screen.queryByText('Marked up')).toBeNull();
    expect(screen.getByLabelText('Attach a screenshot')).toBeTruthy();
  });

  it('starts clean when a different screenshot is attached afterwards', async () => {
    // Replacing is remove-then-attach (there is no swap affordance), and the
    // second screenshot must not inherit the first one's flattened marks —
    // that would send a picture of the wrong screen with a circle on it.
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));
    await act(async () => {
      mockLastAnnotatorProps?.onSave({ base64: 'QQ==', dataUri: 'data:image/png;base64,QQ==' });
    });
    expect(screen.getByText('Marked up')).toBeTruthy();

    fireEvent.press(screen.getByLabelText('Remove screenshot'));
    await attach({ uri: 'file:///tmp/other.png' });

    expect(screen.queryByText('Marked up')).toBeNull();
    expect(mockLastAnnotatorProps?.uri).toBe('file:///tmp/shot.png'); // stale props only

    fireEvent.changeText(
      screen.getByPlaceholderText('The map opened blank after I tapped a pin.'),
      'x'
    );
    fireEvent.press(screen.getByLabelText('Send report'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(submitBugReport).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        screenshotUri: 'file:///tmp/other.png',
        screenshotBase64: null,
      })
    );
  });

  it('disables the pen when the picker reported no dimensions', async () => {
    // Marks placed against invented dimensions land in the wrong place — an
    // honest dead button beats a silently wrong picture.
    render(<BugReportScreen />);
    await attach({ width: 0, height: 0 });
    expect(
      screen.getByLabelText('Circle what is wrong').props.accessibilityState.disabled
    ).toBe(true);
  });

  it('hands the annotator the screenshot’s real pixel size', async () => {
    render(<BugReportScreen />);
    await attach();
    fireEvent.press(screen.getByLabelText('Circle what is wrong'));
    expect(mockLastAnnotatorProps?.sourceWidth).toBe(1170);
    expect(mockLastAnnotatorProps?.sourceHeight).toBe(2532);
  });
});
