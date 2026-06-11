import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Modal } from '@/components/ui/Modal';
import { colors, typography, spacing, radius } from '@/constants/theme';
import { joinCircle, leaveCircle } from '@/services/circles.service';
import { useAuthContext } from '@/context/AuthContext';
import type { CircleWithCounts } from '@/types/circle.types';

interface CirclePreviewModalProps {
  circle: CircleWithCounts;
  visible: boolean;
  onClose: () => void;
  initialIsMember?: boolean;
}

export function CirclePreviewModal({
  circle,
  visible,
  onClose,
  initialIsMember = false,
}: CirclePreviewModalProps) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [isMember, setIsMember] = useState(initialIsMember);
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggleMembership() {
    if (!user) return;
    setIsLoading(true);
    try {
      if (isMember) {
        await leaveCircle(user.id, circle.id);
        setIsMember(false);
      } else {
        await joinCircle(user.id, circle.id);
        setIsMember(true);
      }
    } catch (e: unknown) {
      Alert.alert('Error', e instanceof Error ? e.message : 'Action failed.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleViewCircle() {
    onClose();
    router.push(`/circles/${circle.id}`);
  }

  return (
    <Modal visible={visible} onClose={onClose}>
      <View style={styles.content}>
        {/* Large circular avatar */}
        <TouchableOpacity
          onPress={handleViewCircle}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel={`Open ${circle.name}`}
        >
          {circle.avatar_url ? (
            <Image source={{ uri: circle.avatar_url }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Text style={styles.avatarInitial}>{circle.name[0]?.toUpperCase()}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Name */}
        <TouchableOpacity onPress={handleViewCircle} accessibilityRole="button">
          <Text style={styles.name}>{circle.name}</Text>
        </TouchableOpacity>

        {/* Member count + activities */}
        <Text style={styles.meta}>
          {circle.members_count.toLocaleString('de-DE')} members · {circle.activities_count} Activities
        </Text>

        {/* Description */}
        {circle.description ? (
          <Text style={styles.description}>{circle.description}</Text>
        ) : null}

        {/* Join / Leave button */}
        <TouchableOpacity
          style={[styles.joinButton, isMember && styles.leaveButton]}
          onPress={handleToggleMembership}
          disabled={isLoading}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={isMember ? 'Leave circle' : 'Join circle'}
          accessibilityState={{ selected: isMember, busy: isLoading }}
        >
          <Text style={[styles.joinButtonText, isMember && styles.leaveButtonText]}>
            {isLoading ? '…' : isMember ? 'Leave circle' : 'Join circle'}
          </Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },

  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.surface,
    marginBottom: spacing.xs,
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarInitial: {
    fontSize: typography.fontSize['3xl'],
    fontWeight: typography.fontWeight.bold,
    color: colors.text.secondary,
  },

  name: {
    fontSize: typography.fontSize.xl,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },

  meta: {
    fontSize: typography.fontSize.sm,
    color: colors.text.tertiary,
    textAlign: 'center',
  },

  description: {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: spacing.sm,
    marginTop: spacing.xs,
  },

  joinButton: {
    backgroundColor: colors.black,
    borderRadius: radius.full,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl * 2,
    marginTop: spacing.md,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  joinButtonText: {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
  leaveButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.black,
  },
  leaveButtonText: {
    color: colors.black,
  },
});
