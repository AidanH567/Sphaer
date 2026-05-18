import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, radius, shadow } from '@/constants/theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevation?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, style, elevation = 'sm' }: CardProps) {
  return (
    <View style={[styles.card, elevation !== 'none' && shadow[elevation], style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
});
