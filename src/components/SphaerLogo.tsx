import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle } from 'react-native-svg';
import { colors, typography } from '@/constants/theme';

interface SphaerLogoProps {
  size?: number;
  showWordmark?: boolean;
  color?: string;
}

export function SphaerIcon({ size = 48, color = colors.black }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" fill="none">
      <Circle cx="24" cy="24" r="20" stroke={color} strokeWidth="2" fill="none" />
      <Ellipse cx="24" cy="24" rx="20" ry="10" stroke={color} strokeWidth="2" fill="none" />
      <Ellipse cx="24" cy="24" rx="20" ry="4" stroke={color} strokeWidth="2" fill="none" />
    </Svg>
  );
}

export function SphaerLogo({ size = 48, showWordmark = true, color = colors.black }: SphaerLogoProps) {
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
