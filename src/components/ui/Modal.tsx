import React from 'react';
import {
  Modal as RNModal,
  View,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radius, shadow } from '@/constants/theme';

interface ModalProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  showClose?: boolean;
}

export function Modal({ visible, onClose, children, showClose = true }: ModalProps) {
  return (
    <RNModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <TouchableOpacity activeOpacity={1}>
            <View style={styles.card}>
              {showClose && (
                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Ionicons name="close" size={22} color={colors.text.secondary} />
                </TouchableOpacity>
              )}
              {children}
            </View>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </TouchableOpacity>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  keyboardView: {
    width: '100%',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.xl,
    padding: spacing.xl,
    ...shadow.lg,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.base,
    right: spacing.base,
    zIndex: 1,
    padding: spacing.xs,
  },
});
