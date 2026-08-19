import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react-native';
import { FilterBar } from '../FilterBar';
import { DEFAULT_FILTER_CATEGORIES, EVENT_CATEGORIES } from '@/constants/categories';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const MORE = 'More categories';
const FEWER = 'Fewer categories';

/**
 * Every pill actually on the row, by label, in the order it renders — chips
 * and the expand control alike.
 *
 * Reading the rendered tree rather than filtering the vocabulary is the point:
 * it pins the real chip set, its order, and its length in one assertion, so a
 * duplicate, a stray, or a chip in the wrong place all fail loudly.
 */
function chipLabels(): string[] {
  return screen
    .getAllByRole('button')
    .map((button) => String(within(button).getByText(/.+/).props.children));
}

describe('FilterBar', () => {
  it('shows the default subset and nothing else, plus a "More categories" chip', () => {
    render(<FilterBar onToggleCategory={jest.fn()} />);

    expect(chipLabels()).toEqual([...DEFAULT_FILTER_CATEGORIES, MORE]);
    expect(DEFAULT_FILTER_CATEGORIES).toHaveLength(14);
  });

  it('keeps the long tail off the row until it is asked for', () => {
    render(<FilterBar onToggleCategory={jest.fn()} />);

    for (const tail of ['Tattoo', 'Jam Session', 'Street Art', 'Pop-ups', 'Coaching']) {
      expect(screen.queryByText(tail)).toBeNull();
    }
  });

  it('reveals every remaining category when "More categories" is pressed', () => {
    render(<FilterBar onToggleCategory={jest.fn()} />);

    fireEvent.press(screen.getByText(MORE));

    expect(chipLabels()).toEqual([...EVENT_CATEGORIES, FEWER]);
    expect(EVENT_CATEGORIES).toHaveLength(36);
    // Named for what it now does.
    expect(screen.queryByText(MORE)).toBeNull();
  });

  it('collapses back to the default subset', () => {
    render(<FilterBar onToggleCategory={jest.fn()} />);

    fireEvent.press(screen.getByText(MORE));
    fireEvent.press(screen.getByText(FEWER));

    expect(chipLabels()).toEqual([...DEFAULT_FILTER_CATEGORIES, MORE]);
  });

  it('does not select anything when the expand control is pressed', () => {
    const onToggleCategory = jest.fn();
    render(<FilterBar onToggleCategory={onToggleCategory} />);

    fireEvent.press(screen.getByText(MORE));

    expect(onToggleCategory).not.toHaveBeenCalled();
  });

  it('toggles a category from either half of the row', () => {
    const onToggleCategory = jest.fn();
    render(<FilterBar onToggleCategory={onToggleCategory} />);

    fireEvent.press(screen.getByText('Art'));
    expect(onToggleCategory).toHaveBeenCalledWith('Art');

    fireEvent.press(screen.getByText(MORE));
    fireEvent.press(screen.getByText('Tattoo'));
    expect(onToggleCategory).toHaveBeenCalledWith('Tattoo');
  });

  it('marks the selected chips as selected', () => {
    render(<FilterBar selectedCategories={['Music']} onToggleCategory={jest.fn()} />);

    expect(
      screen.getByRole('button', { name: 'Music' }).props.accessibilityState.selected,
    ).toBe(true);
    expect(screen.getByRole('button', { name: 'Art' }).props.accessibilityState.selected).toBe(
      false,
    );
    // The expand control is not a filter and must never read as one.
    expect(screen.getByRole('button', { name: MORE }).props.accessibilityState.selected).toBe(
      false,
    );
  });

  it('keeps a selected tail category on the collapsed row so it stays clearable', () => {
    // Filter state outlives this component — open an event from a filtered
    // feed and come back and the filter is still on. If the only chip that
    // could clear it lives behind "More categories", the feed looks broken.
    const onToggleCategory = jest.fn();
    render(<FilterBar selectedCategories={['Tattoo']} onToggleCategory={onToggleCategory} />);

    expect(chipLabels()).toEqual([...DEFAULT_FILTER_CATEGORIES, 'Tattoo', MORE]);

    fireEvent.press(screen.getByText('Tattoo'));
    expect(onToggleCategory).toHaveBeenCalledWith('Tattoo');
  });

  it('does not show a selected tail category twice once expanded', () => {
    render(<FilterBar selectedCategories={['Tattoo']} onToggleCategory={jest.fn()} />);

    fireEvent.press(screen.getByText(MORE));

    expect(screen.getAllByText('Tattoo')).toHaveLength(1);
    expect(chipLabels()).toEqual([...EVENT_CATEGORIES, FEWER]);
  });

  it('renders a retired category name when an old filter still carries it', () => {
    // `events.categories` is unvalidated `text[]`, so `Wellness` survives in
    // production rows until the rename migration is applied by hand. If such a
    // value ever reaches filter state it must still appear as a chip, or the
    // user is stuck with a filter they cannot see or switch off.
    const onToggleCategory = jest.fn();
    render(<FilterBar selectedCategories={['Wellness']} onToggleCategory={onToggleCategory} />);

    expect(chipLabels()).toEqual([...DEFAULT_FILTER_CATEGORIES, 'Wellness', MORE]);
    expect(
      screen.getByRole('button', { name: 'Wellness' }).props.accessibilityState.selected,
    ).toBe(true);

    fireEvent.press(screen.getByText('Wellness'));
    expect(onToggleCategory).toHaveBeenCalledWith('Wellness');
  });
});
