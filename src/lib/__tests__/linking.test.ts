import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  consumePendingDeepLink,
  isDeepLinkablePath,
  pathFromUrl,
  stashPendingDeepLink,
} from '../linking';

jest.mock('@react-native-async-storage/async-storage', () =>
  // The official AsyncStorage jest mock. jest.mock factories are hoisted
  // above imports, so `require` is the only way to reference it here.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

const PENDING_KEY = 'sphaer:pending-deeplink';

beforeEach(async () => {
  // Drain the module-level stash and the mock storage between tests.
  await consumePendingDeepLink();
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('pathFromUrl', () => {
  it('normalizes app-scheme URLs', () => {
    expect(pathFromUrl('sphaer://event/abc-123')).toBe('/event/abc-123');
    expect(pathFromUrl('sphaer://user/u1')).toBe('/user/u1');
    expect(pathFromUrl('sphaer://circles/c1')).toBe('/circles/c1');
    expect(pathFromUrl('sphaer://ticket/t1')).toBe('/ticket/t1');
    expect(pathFromUrl('sphaer://notifications')).toBe('/notifications');
  });

  it('normalizes nested messages routes', () => {
    expect(pathFromUrl('sphaer://messages/m1')).toBe('/messages/m1');
    expect(pathFromUrl('sphaer://messages/circle/c1')).toBe('/messages/circle/c1');
    expect(pathFromUrl('sphaer://messages/event/e1')).toBe('/messages/event/e1');
  });

  it('normalizes canonical https share URLs, with and without www', () => {
    expect(pathFromUrl('https://sphaer.app/event/abc')).toBe('/event/abc');
    expect(pathFromUrl('https://www.sphaer.app/circles/c1')).toBe('/circles/c1');
  });

  it('treats scheme and https host as case-insensitive', () => {
    expect(pathFromUrl('SPHAER://event/abc')).toBe('/event/abc');
    expect(pathFromUrl('HTTPS://SPHAER.APP/user/u1')).toBe('/user/u1');
  });

  it('keeps the path case-sensitive (routes are lowercase)', () => {
    expect(pathFromUrl('sphaer://EVENT/abc')).toBeNull();
    expect(pathFromUrl('https://sphaer.app/Event/abc')).toBeNull();
  });

  it('tolerates an empty custom-scheme host (sphaer:///path)', () => {
    expect(pathFromUrl('sphaer:///event/abc')).toBe('/event/abc');
  });

  it('strips trailing slashes', () => {
    expect(pathFromUrl('https://sphaer.app/event/abc/')).toBe('/event/abc');
    expect(pathFromUrl('sphaer://event/abc//')).toBe('/event/abc');
  });

  it('preserves query strings verbatim and drops fragments', () => {
    expect(pathFromUrl('https://sphaer.app/event/abc?src=push&x=1')).toBe(
      '/event/abc?src=push&x=1',
    );
    expect(pathFromUrl('sphaer://event/abc/?src=push')).toBe('/event/abc?src=push');
    expect(pathFromUrl('https://sphaer.app/event/abc#section')).toBe('/event/abc');
  });

  it('rejects foreign hosts, including lookalike subdomains', () => {
    expect(pathFromUrl('https://evil.com/event/abc')).toBeNull();
    expect(pathFromUrl('https://sphaer.app.evil.com/event/abc')).toBeNull();
    expect(pathFromUrl('https://app.sphaer.app/event/abc')).toBeNull();
  });

  it('rejects non-https and non-app schemes', () => {
    expect(pathFromUrl('http://sphaer.app/event/abc')).toBeNull();
    expect(pathFromUrl('javascript:alert(1)')).toBeNull();
    expect(pathFromUrl('mailto:hello@sphaer.app')).toBeNull();
    expect(pathFromUrl('file:///etc/passwd')).toBeNull();
  });

  it('rejects paths outside the deep-linkable allowlist', () => {
    expect(pathFromUrl('https://sphaer.app/')).toBeNull();
    expect(pathFromUrl('https://sphaer.app/admin')).toBeNull();
    expect(pathFromUrl('https://sphaer.app/event')).toBeNull();
    expect(pathFromUrl('https://sphaer.app/event/edit/abc')).toBeNull();
    expect(pathFromUrl('sphaer://feed')).toBeNull();
    expect(pathFromUrl('sphaer://legal/privacy')).toBeNull();
  });

  it('rejects bare paths, garbage, and non-string input', () => {
    expect(pathFromUrl('/event/abc')).toBeNull();
    expect(pathFromUrl('not a url')).toBeNull();
    expect(pathFromUrl('')).toBeNull();
    expect(pathFromUrl('sphaer://')).toBeNull();
    expect(pathFromUrl(null as unknown as string)).toBeNull();
    expect(pathFromUrl(undefined as unknown as string)).toBeNull();
  });
});

describe('isDeepLinkablePath', () => {
  it('accepts allowlisted in-app paths', () => {
    expect(isDeepLinkablePath('/event/abc')).toBe(true);
    expect(isDeepLinkablePath('/messages/circle/c1')).toBe(true);
    expect(isDeepLinkablePath('/notifications')).toBe(true);
    expect(isDeepLinkablePath('/event/abc/')).toBe(true);
    expect(isDeepLinkablePath('/event/abc?src=push')).toBe(true);
  });

  it('rejects everything else', () => {
    expect(isDeepLinkablePath('/feed')).toBe(false);
    expect(isDeepLinkablePath('/legal/privacy')).toBe(false);
    expect(isDeepLinkablePath('/event')).toBe(false);
    expect(isDeepLinkablePath('event/abc')).toBe(false);
    expect(isDeepLinkablePath('')).toBe(false);
  });
});

describe('pending deep link stash', () => {
  it('round-trips a stashed path and consumes it exactly once', async () => {
    stashPendingDeepLink('/event/abc');
    await expect(consumePendingDeepLink()).resolves.toBe('/event/abc');
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('clears persisted storage on consume', async () => {
    stashPendingDeepLink('/circles/c1');
    await consumePendingDeepLink();
    await expect(AsyncStorage.getItem(PENDING_KEY)).resolves.toBeNull();
  });

  it('falls back to AsyncStorage when module state is gone (OAuth restart)', async () => {
    // Simulate a relaunch: nothing in memory, entry persisted under the key.
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ path: '/messages/m1', ts: Date.now() }),
    );
    await expect(consumePendingDeepLink()).resolves.toBe('/messages/m1');
  });

  it('expires stashes older than 15 minutes', async () => {
    const t0 = 1_750_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    stashPendingDeepLink('/event/abc');
    now.mockReturnValue(t0 + 16 * 60 * 1000);
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('clears persisted storage even when the entry has expired', async () => {
    const t0 = 1_750_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    stashPendingDeepLink('/event/abc');
    now.mockReturnValue(t0 + 16 * 60 * 1000);
    await consumePendingDeepLink();
    await expect(AsyncStorage.getItem(PENDING_KEY)).resolves.toBeNull();
  });

  it('lets a newer stash overwrite an older one', async () => {
    stashPendingDeepLink('/event/old');
    stashPendingDeepLink('/circles/new');
    await expect(consumePendingDeepLink()).resolves.toBe('/circles/new');
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('round-trips query strings through the stash', async () => {
    stashPendingDeepLink('/event/abc?src=share&x=1');
    await expect(consumePendingDeepLink()).resolves.toBe('/event/abc?src=share&x=1');
  });

  it('resolves null instead of throwing when storage reads fail', async () => {
    // Memory is empty (drained by beforeEach), forcing the storage path.
    jest
      .spyOn(AsyncStorage, 'getItem')
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('still consumes from memory when storage writes/removes fail', async () => {
    jest
      .spyOn(AsyncStorage, 'setItem')
      .mockRejectedValueOnce(new Error('disk full'));
    jest
      .spyOn(AsyncStorage, 'removeItem')
      .mockRejectedValueOnce(new Error('disk full'));
    stashPendingDeepLink('/messages/m1');
    await expect(consumePendingDeepLink()).resolves.toBe('/messages/m1');
  });

  it('honors stashes just under the 15-minute window', async () => {
    const t0 = 1_750_000_000_000;
    const now = jest.spyOn(Date, 'now').mockReturnValue(t0);
    stashPendingDeepLink('/event/abc');
    now.mockReturnValue(t0 + 14 * 60 * 1000);
    await expect(consumePendingDeepLink()).resolves.toBe('/event/abc');
  });

  it('refuses to stash non-allowlisted paths', async () => {
    stashPendingDeepLink('/legal/privacy');
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('ignores corrupted or mis-shaped persisted entries', async () => {
    await AsyncStorage.setItem(PENDING_KEY, 'not json');
    await expect(consumePendingDeepLink()).resolves.toBeNull();

    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ nope: true }));
    await expect(consumePendingDeepLink()).resolves.toBeNull();

    await AsyncStorage.setItem(PENDING_KEY, JSON.stringify({ path: 42, ts: 'x' }));
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });

  it('re-validates the persisted path against the allowlist', async () => {
    // e.g. an old install stashed a route that no longer exists.
    await AsyncStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ path: '/admin/secret', ts: Date.now() }),
    );
    await expect(consumePendingDeepLink()).resolves.toBeNull();
  });
});
