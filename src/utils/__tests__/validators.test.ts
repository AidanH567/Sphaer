import { isValidEmail, isValidPassword, isValidUrl, isValidUsername } from '../validators';

describe('isValidEmail', () => {
  it('accepts a normal address', () => {
    expect(isValidEmail('lea@sphaer.app')).toBe(true);
  });
  it('accepts subdomains and plus-tags', () => {
    expect(isValidEmail('a.b+tag@mail.example.co')).toBe(true);
  });
  it('rejects a missing @', () => {
    expect(isValidEmail('lea.sphaer.app')).toBe(false);
  });
  it('rejects a missing TLD dot', () => {
    expect(isValidEmail('lea@localhost')).toBe(false);
  });
  it('rejects whitespace', () => {
    expect(isValidEmail('lea @sphaer.app')).toBe(false);
  });
  it('rejects empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts exactly 8 chars', () => {
    expect(isValidPassword('12345678')).toBe(true);
  });
  it('rejects 7 chars', () => {
    expect(isValidPassword('1234567')).toBe(false);
  });
});

describe('isValidUsername', () => {
  it('accepts letters, digits, underscore', () => {
    expect(isValidUsername('lea_weber99')).toBe(true);
  });
  it('rejects spaces and symbols', () => {
    expect(isValidUsername('lea weber')).toBe(false);
    expect(isValidUsername('lea-weber')).toBe(false);
  });
  it('rejects too-short (<3) and too-long (>30)', () => {
    expect(isValidUsername('ab')).toBe(false);
    expect(isValidUsername('a'.repeat(31))).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('accepts a full URL', () => {
    expect(isValidUrl('https://sphaer.app/events')).toBe(true);
  });
  it('rejects a bare domain (no protocol)', () => {
    // Documents current behavior: new URL() requires a protocol. The
    // profile form pre-strips/normalises before calling this.
    expect(isValidUrl('sphaer.app')).toBe(false);
  });
});
