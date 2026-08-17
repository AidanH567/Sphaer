import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { NeighborhoodSelectInput } from '../NeighborhoodSelectInput';

describe('NeighborhoodSelectInput', () => {
  it('filters the list as the user types', () => {
    const onSelect = jest.fn();
    const { getByLabelText, queryByText } = render(
      <NeighborhoodSelectInput value="" onSelect={onSelect} />
    );
    const input = getByLabelText('Neighborhood (optional)');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'kreuz');

    expect(queryByText('Kreuzberg')).toBeTruthy();
    expect(queryByText('Wedding')).toBeNull();
  });

  it('commits a value only via tapping a suggestion', () => {
    const onSelect = jest.fn();
    const { getByLabelText, getByText } = render(
      <NeighborhoodSelectInput value="" onSelect={onSelect} />
    );
    const input = getByLabelText('Neighborhood (optional)');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'prenz');
    fireEvent.press(getByText('Prenzlauer Berg'));

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith('Prenzlauer Berg');
  });

  it('never commits free text — typing then blurring calls onSelect with nothing', () => {
    jest.useFakeTimers();
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <NeighborhoodSelectInput value="" onSelect={onSelect} />
    );
    const input = getByLabelText('Neighborhood (optional)');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'Fakehausen');
    fireEvent(input, 'blur');
    act(() => {
      jest.runAllTimers();
    });

    expect(onSelect).not.toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('shows a no-match empty state for text outside the list', () => {
    const { getByLabelText, getByText } = render(
      <NeighborhoodSelectInput value="" onSelect={jest.fn()} />
    );
    const input = getByLabelText('Neighborhood (optional)');
    fireEvent(input, 'focus');
    fireEvent.changeText(input, 'Fakehausen');

    expect(
      getByText('No matching Berlin neighbourhood — pick one from the list.')
    ).toBeTruthy();
  });

  it('renders a legacy out-of-list value with a warning instead of crashing', () => {
    const { getByText } = render(
      <NeighborhoodSelectInput value="Prenzlauerberg" onSelect={jest.fn()} />
    );
    // Legacy value predates the fixed list — must still display, flagged.
    expect(
      getByText(
        '“Prenzlauerberg” isn’t a Berlin neighbourhood we recognise — tap to pick one from the list.'
      )
    ).toBeTruthy();
  });

  it('clears the stored value via the clear button', () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <NeighborhoodSelectInput value="Kreuzberg" onSelect={onSelect} />
    );
    fireEvent.press(getByLabelText('Clear neighborhood'));
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
