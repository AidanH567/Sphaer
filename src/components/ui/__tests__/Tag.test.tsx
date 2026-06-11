import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Tag } from '../Tag';

describe('Tag', () => {
  it('renders label and fires onPress', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Tag label="Music" onPress={onPress} />);
    fireEvent.press(getByText('Music'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
