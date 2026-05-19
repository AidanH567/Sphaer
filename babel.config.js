module.exports = function (api) {
  const isWeb = api.caller((caller) => caller?.name === 'metro' && caller?.platform === 'web');

  return {
    presets: [
      ['babel-preset-expo', {
        jsxImportSource: 'nativewind',
        // Prevent babel-preset-expo from auto-loading reanimated plugin on web
        // (reanimated v4 plugin needs native worklets runtime, not available on web)
        reanimated: !isWeb,
      }],
    ],
    plugins: [
      ...(!isWeb ? ['react-native-reanimated/plugin'] : []),
    ],
  };
};
