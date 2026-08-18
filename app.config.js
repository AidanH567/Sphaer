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

  // EAS project binding. `eas init` was run on 2026-08-18 and created
  // @aidan567/sphaer, but it CANNOT write here: a dynamic app.config.js is not
  // machine-editable, so it printed the id and exited with
  // "Cannot automatically write to dynamic config at: app.config.js".
  // That is expected behaviour, not a failure - the id below is the one it
  // minted, pasted by hand, and it is bound to Aidan's Expo account.
  //
  // ⚠️ Do NOT invent or regenerate this value. A wrong projectId produces a
  // config that looks complete and fails at the build server.
  expo.owner = expo.owner || 'aidan567';
  expo.extra = {
    ...(expo.extra || {}),
    eas: {
      ...((expo.extra || {}).eas || {}),
      projectId: 'c1500821-30f0-40f6-95d0-af24ea19119e',
    },
  };

  return { expo };
};
