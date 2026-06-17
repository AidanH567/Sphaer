import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

/**
 * Custom web HTML shell (web only — native ignores this file).
 *
 * Why it exists: with Expo's default shell the app sized itself to `height:100%`,
 * which on mobile Safari resolves to the LARGE viewport (URL bar hidden). On
 * first load the URL bar IS shown, so the visible area is shorter than that —
 * the bottom tab bar landed below the fold and a page scrollbar appeared
 * ("doesn't fit the screen"). Pinning the shell to `100dvh` (the *dynamic*,
 * actually-visible viewport height) makes it fit exactly on every phone; content
 * that exceeds the screen scrolls inside its own ScrollView/FlatList, never the
 * page. `overscroll-behavior: none` also kills the iOS rubber-band bounce.
 *
 * Zoom is deliberately NOT disabled (no maximum-scale / user-scalable=no) — that
 * would break accessibility. `viewport-fit=cover` lets safe-area insets work.
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* Expo's reset: RN-web ScrollViews scroll internally, not the document. */}
        <ScrollViewStyleReset />
        {/* Declared AFTER the reset so the dvh height wins. */}
        <style dangerouslySetInnerHTML={{ __html: SHELL_CSS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}

const SHELL_CSS = `
html, body, #root {
  height: 100dvh;
  min-height: 100dvh;
  overscroll-behavior: none;
}
@supports not (height: 100dvh) {
  html, body, #root { height: 100%; min-height: 100%; }
}
`;
