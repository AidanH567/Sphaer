// Dynamic Expo config.
//
// WHY THIS EXISTS (2026-08-17). `app.json` had the Google Maps key written as
// the literal string "$(EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)" in both the iOS and
// Android blocks. Static JSON performs NO substitution, so that literal was
// being embedded into native builds verbatim and the map — one of the three
// feed modes — would fail on device while everything looked fine in the config.
// Only a JS config can read process.env, which is why this file replaces the
// static one as the entry point.
//
// app.json is kept as the base so this stays a small, reviewable diff rather
// than a re-typed config: Expo loads app.config.js in preference, and we spread
// app.json's `expo` block and override only what has to be computed.

const base = require('./app.json');

module.exports = () => {
  const expo = { ...base.expo };

  const mapsKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

  expo.ios = {
    ...expo.ios,
    config: { ...(expo.ios && expo.ios.config), googleMapsApiKey: mapsKey },
  };

  expo.android = {
    ...expo.android,
    config: {
      ...(expo.android && expo.android.config),
      googleMaps: { apiKey: mapsKey },
    },
  };

  // Lets an OTA update know which native binaries it is compatible with.
  // 'appVersion' ties it to expo.version, which is the conservative choice:
  // a native change forces a version bump rather than silently shipping JS to
  // a binary that cannot run it.
  expo.runtimeVersion = { policy: 'appVersion' };

  // ⚠️ EAS CANNOT BUILD WITHOUT `extra.eas.projectId`, and it is NOT set here
  // on purpose. It is minted by `eas init` and bound to Aidan's Expo account —
  // inventing one would produce a config that looks complete and fails at the
  // build server. Run `eas init` once; it writes projectId and `owner` for you.
  // Until then this block is a placeholder that preserves anything already set.
  expo.extra = { ...(expo.extra || {}), eas: { ...((expo.extra || {}).eas || {}) } };

  return { expo };
};
