import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, typography } from '@/constants/theme';

const DEFAULT_COLOR = '#2B2A27';

interface SphaerIconProps {
  size?: number;
  color?: string;
}

// Two overlapping horizontal hoops — matches the official Sphaer logo.
// The source paths are drawn on a 78×78 viewBox; we scale uniformly via width/height.
export function SphaerIcon({ size = 64, color = DEFAULT_COLOR }: SphaerIconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 78 78"
      fill="none"
    >
      {/* Top hoop */}
      <Path
        d="M15.7002 33.5C15.7002 31.039 17.7396 28.3533 22.083 26.1816C26.3247 24.0609 32.3033 22.7002 39 22.7002C45.6967 22.7002 51.6753 24.0609 55.917 26.1816C60.2604 28.3533 62.2998 31.039 62.2998 33.5C62.2998 35.961 60.2604 38.6467 55.917 40.8184C51.6753 42.9391 45.6967 44.2998 39 44.2998C32.3033 44.2998 26.3247 42.9391 22.083 40.8184C17.7396 38.6467 15.7002 35.961 15.7002 33.5Z"
        stroke={color}
        strokeWidth="3.4"
      />
      {/* Bottom hoop */}
      <Path
        d="M15.7002 43.9167C15.7002 41.4558 17.7396 38.7701 22.083 36.5984C26.3247 34.4776 32.3033 33.1169 39 33.1169C45.6967 33.1169 51.6753 34.4776 55.917 36.5984C60.2604 38.7701 62.2998 41.4558 62.2998 43.9167C62.2998 46.3777 60.2604 49.0634 55.917 51.2351C51.6753 53.3559 45.6967 54.7166 39 54.7166C32.3033 54.7166 26.3247 53.3559 22.083 51.2351C17.7396 49.0634 15.7002 46.3777 15.7002 43.9167Z"
        stroke={color}
        strokeWidth="3.4"
      />
    </Svg>
  );
}

interface SphaerLogoProps {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}

export function SphaerLogo({
  size = 64,
  showWordmark = true,
  color = DEFAULT_COLOR,
}: SphaerLogoProps) {
  if (!showWordmark) {
    return <SphaerIcon size={size} color={color} />;
  }

  return (
    <View style={styles.row}>
      <SphaerIcon size={size * 0.75} color={color} />
      <Text style={[styles.wordmark, { fontSize: size * 0.5, color }]}>Sphaer</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  wordmark: {
    fontWeight: typography.fontWeight.semibold,
    letterSpacing: 0.5,
  },
});
