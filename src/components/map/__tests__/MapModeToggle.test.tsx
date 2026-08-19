import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MapModeToggle } from '../MapModeToggle';

/** The control Lara asked for: three viewing options, one selected. */
describe('MapModeToggle', () => {
  it('offers exactly the three viewing options', () => {
    render(<MapModeToggle activeMode="activities" onModeChange={jest.fn()} />);

    expect(screen.getByText('Activities')).toBeTruthy();
    expect(screen.getByText('Venues')).toBeTruthy();
    expect(screen.getByText('My city')).toBeTruthy();
  });

  it('marks only the active mode as selected, for screen readers too', () => {
    render(<MapModeToggle activeMode="venues" onModeChange={jest.fn()} />);

    expect(screen.getByTestId('map-mode-venues').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('map-mode-activities').props.accessibilityState.selected).toBe(false);
    expect(screen.getByTestId('map-mode-favourites').props.accessibilityState.selected).toBe(false);
  });

  it('reports the mode that was tapped', () => {
    const onModeChange = jest.fn();
    render(<MapModeToggle activeMode="activities" onModeChange={onModeChange} />);

    fireEvent.press(screen.getByTestId('map-mode-venues'));
    expect(onModeChange).toHaveBeenCalledWith('venues');

    fireEvent.press(screen.getByTestId('map-mode-favourites'));
    expect(onModeChange).toHaveBeenCalledWith('favourites');
  });

  it('still reports a tap on the already-active mode rather than swallowing it', () => {
    const onModeChange = jest.fn();
    render(<MapModeToggle activeMode="venues" onModeChange={onModeChange} />);

    fireEvent.press(screen.getByTestId('map-mode-venues'));
    expect(onModeChange).toHaveBeenCalledWith('venues');
  });
});
