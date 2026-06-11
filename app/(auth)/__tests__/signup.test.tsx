import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import SignUpScreen from '../signup';

// ── Mocks (all inline, no shared setup files) ───────────────────────────

// @expo/vector-icons loads its icon font asynchronously and calls setState
// when it lands, which produces act() warnings unrelated to what we assert.
// The icons are decorative here (the actionable a11y labels live on their
// parent touchables), so stub them out.
jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const mockSignUp = jest.fn();
jest.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    signUp: mockSignUp,
    isLoading: false,
  }),
}));

jest.mock('@/services/auth.service', () => ({
  signInWithGoogle: jest.fn(),
}));

const mockRouter = {
  back: jest.fn(),
  push: jest.fn(),
  replace: jest.fn(),
};
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
}));

// ── Constants matching the screen's inline validation copy ──────────────

const NAME_ERROR = 'Name must be 2–50 characters';
const EMAIL_ERROR = 'Enter a valid email address';
const PASSWORD_ERROR = 'Password must be at least 8 characters';

function renderScreen() {
  const utils = render(<SignUpScreen />);
  return {
    ...utils,
    nameInput: utils.getByPlaceholderText('Your name'),
    emailInput: utils.getByPlaceholderText('your@email.com'),
    passwordInput: utils.getByPlaceholderText('Min. 8 characters'),
    signUpButton: utils.getByRole('button', { name: 'Sign up' }),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SignUpScreen form validation', () => {
  it('shows all three inline errors and does not call signUp when everything is empty', () => {
    const { signUpButton, getByText } = renderScreen();

    fireEvent.press(signUpButton);

    expect(getByText(NAME_ERROR)).toBeTruthy();
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_ERROR)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('shows only email + password errors when name is valid but email is invalid and password is short', () => {
    const { signUpButton, nameInput, emailInput, passwordInput, getByText, queryByText } =
      renderScreen();

    fireEvent.changeText(nameInput, 'Aidan');
    fireEvent.changeText(emailInput, 'not-an-email');
    fireEvent.changeText(passwordInput, 'short');
    fireEvent.press(signUpButton);

    expect(queryByText(NAME_ERROR)).toBeNull();
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_ERROR)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });

  it('calls signUp once with email, password and trimmed name, then routes to /welcome with the encoded name on a session result', async () => {
    mockSignUp.mockResolvedValueOnce({ session: { user: { id: 'user-1' } } });
    const { signUpButton, nameInput, emailInput, passwordInput, queryByText } = renderScreen();

    fireEvent.changeText(nameInput, '  Aidan Herstik  ');
    fireEvent.changeText(emailInput, 'aidan@example.com');
    fireEvent.changeText(passwordInput, 'supersecret123');
    fireEvent.press(signUpButton);

    await waitFor(() => {
      expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    });

    expect(mockSignUp).toHaveBeenCalledTimes(1);
    expect(mockSignUp).toHaveBeenCalledWith('aidan@example.com', 'supersecret123', 'Aidan Herstik');
    expect(mockRouter.replace).toHaveBeenCalledWith('/(auth)/welcome?name=Aidan%20Herstik');

    // No validation errors should be visible for a fully valid submission.
    expect(queryByText(NAME_ERROR)).toBeNull();
    expect(queryByText(EMAIL_ERROR)).toBeNull();
    expect(queryByText(PASSWORD_ERROR)).toBeNull();
  });

  it('clears an inline error on re-submit after the field is fixed', () => {
    const { signUpButton, emailInput, getByText, queryByText } = renderScreen();

    // First submit: everything empty → all three errors.
    fireEvent.press(signUpButton);
    expect(getByText(NAME_ERROR)).toBeTruthy();
    expect(getByText(EMAIL_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_ERROR)).toBeTruthy();

    // Fix only the email, re-submit: email error gone, the others remain.
    fireEvent.changeText(emailInput, 'aidan@example.com');
    fireEvent.press(signUpButton);

    expect(queryByText(EMAIL_ERROR)).toBeNull();
    expect(getByText(NAME_ERROR)).toBeTruthy();
    expect(getByText(PASSWORD_ERROR)).toBeTruthy();
    expect(mockSignUp).not.toHaveBeenCalled();
  });
});
