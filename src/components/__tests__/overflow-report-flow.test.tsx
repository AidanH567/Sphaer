import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { OverflowMenuSheet } from '@/components/ui/OverflowMenuSheet';
import { ReportSheet } from '@/components/moderation/ReportSheet';
import { submitReport, ModerationUnavailableError } from '@/services/moderation.service';

jest.mock('@/services/moderation.service', () => ({
  submitReport: jest.fn(),
  // Mirrors the real class: no-arg constructor, fixed user-facing message.
  ModerationUnavailableError: class ModerationUnavailableError extends Error {
    constructor() {
      super('This will be available after the next app update.');
      this.name = 'ModerationUnavailableError';
    }
  },
}));

// Same shape as create-event-screen.test.tsx — these sheets read insets.
jest.mock('react-native-safe-area-context', () => {
  const insets = { top: 0, right: 0, bottom: 0, left: 0 };
  const frame = { x: 0, y: 0, width: 390, height: 844 };
  return {
    useSafeAreaInsets: () => insets,
    useSafeAreaFrame: () => frame,
    initialWindowMetrics: { insets, frame },
  };
});

jest.mock('@/context/AuthContext', () => ({
  useAuthContext: () => ({ user: { id: 'user-1' } }),
}));

describe('OverflowMenuSheet → ReportSheet handoff', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(submitReport).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires the action 300ms after closing so stacked Modals never overlap', () => {
    const onClose = jest.fn();
    const onReport = jest.fn();
    render(
      <OverflowMenuSheet
        visible
        actions={[{ label: 'Report event', icon: 'flag-outline', onPress: onReport }]}
        onClose={onClose}
      />
    );

    fireEvent.press(screen.getByLabelText('Report event'));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onReport).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(onReport).toHaveBeenCalledTimes(1);
  });

  it('stays mounted when a reopen interrupts the close animation', () => {
    const onClose = jest.fn();
    const actions = [{ label: 'Report event', onPress: jest.fn() }];
    const { rerender } = render(
      <OverflowMenuSheet visible actions={actions} onClose={onClose} />
    );
    expect(screen.getByLabelText('Report event')).toBeTruthy();

    // Close, then reopen before the 240ms close animation completes. The
    // open branch's setValue() stops the close animation, firing its end
    // callback with finished:false — the regression this guards killed the
    // Modal right here.
    rerender(<OverflowMenuSheet visible={false} actions={actions} onClose={onClose} />);
    act(() => {
      jest.advanceTimersByTime(100);
    });
    rerender(<OverflowMenuSheet visible actions={actions} onClose={onClose} />);
    act(() => {
      jest.advanceTimersByTime(600);
    });
    expect(screen.getByLabelText('Report event')).toBeTruthy();
  });

  it('renders the reason form and submits a report', async () => {
    jest.mocked(submitReport).mockResolvedValueOnce(undefined);
    render(
      <ReportSheet visible targetType="event" targetId="event-1" onClose={jest.fn()} />
    );

    expect(screen.getByText('Spam')).toBeTruthy();
    expect(screen.getByText('Harassment or hate')).toBeTruthy();

    fireEvent.press(screen.getByText('Spam'));
    fireEvent.press(screen.getByLabelText('Submit report'));

    // Resolve the mocked submit + run the success-phase state update.
    await act(async () => {
      await Promise.resolve();
    });
    expect(submitReport).toHaveBeenCalledWith('user-1', {
      targetType: 'event',
      targetId: 'event-1',
      reason: 'spam',
      details: undefined,
    });
  });

  it('shows the degraded message when the reports table is missing', async () => {
    jest.mocked(submitReport).mockRejectedValueOnce(new ModerationUnavailableError());
    render(
      <ReportSheet visible targetType="event" targetId="event-1" onClose={jest.fn()} />
    );

    fireEvent.press(screen.getByText('Spam'));
    fireEvent.press(screen.getByLabelText('Submit report'));
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/available after the next app update/i)).toBeTruthy();
  });
});
