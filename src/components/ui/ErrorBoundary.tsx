import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, typography, spacing } from '@/constants/theme';

interface ErrorBoundaryProps {
  /** Subtree to protect. */
  children: React.ReactNode;
  /**
   * Identifier surfaced in the fallback's accessibility label and console
   * payload. Make it specific (e.g. "feed-list", "event-detail") so the
   * fallback isn't a generic "Something went wrong" everywhere — it gives
   * us a breadcrumb when a real user reports a crash.
   */
  name?: string;
  /**
   * Custom fallback renderer. Defaults to the centred "Something went wrong"
   * view defined below.
   */
  fallback?: (args: { error: Error; reset: () => void; name?: string }) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * React error boundary. Catches any error thrown by descendants during render,
 * lifecycle methods, or constructors, and renders a recovery view instead of
 * a white screen of death.
 *
 * Class component because React error boundaries require lifecycle methods
 * not yet available in hooks (this is the one place in the codebase where
 * a class is the only option).
 *
 * Resetting via the "Try again" button bumps the local key so the subtree
 * remounts with fresh state. If the underlying error is deterministic (e.g.
 * a null-pointer in a derived render), Try-Again will reproduce the same
 * crash, which is the correct behavior — surface the loop to the user
 * rather than silently spinning.
 *
 * Crash payload is logged to `console.error`. Sentry / Bugsnag wiring is a
 * P2 backlog item that will replace the console call when it lands.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Tagging by `name` makes it easy to grep for "[ErrorBoundary:feed-list]"
    // when investigating reports later.
    console.error(`[ErrorBoundary:${this.props.name ?? 'unknown'}]`, error, info);
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      const { fallback, name } = this.props;
      if (fallback) {
        return fallback({ error: this.state.error, reset: this.reset, name });
      }
      return <DefaultFallback error={this.state.error} reset={this.reset} name={name} />;
    }
    return this.props.children;
  }
}

/**
 * Factory for expo-router's per-route `ErrorBoundary` export. Each route
 * file does:
 *
 *   export const ErrorBoundary = makeRouteErrorBoundary('feed-list');
 *
 * and expo-router uses it as the fallback if the route throws — same
 * visual treatment as the class wrapper above, but no extra component
 * nesting in the happy path.
 */
export function makeRouteErrorBoundary(name: string) {
  return function RouteErrorBoundary({
    error,
    retry,
  }: {
    error: Error;
    retry: () => void;
  }) {
    // Mirror the class component's componentDidCatch logging so route-level
    // and explicit-wrap crashes leave the same breadcrumb.
    if (__DEV__) {
      console.error(`[ErrorBoundary:${name}]`, error);
    }
    return <DefaultFallback error={error} reset={retry} name={name} />;
  };
}

function DefaultFallback({
  error,
  reset,
  name,
}: {
  error: Error;
  reset: () => void;
  name?: string;
}) {
  return (
    <View
      style={styles.container}
      accessibilityRole="alert"
      accessibilityLabel={`Error in ${name ?? 'this screen'}: ${error.message}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={36} color={colors.text.tertiary} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body} numberOfLines={3}>
        We hit an unexpected error. You can try again — if it keeps happening, let us know.
      </Text>
      {__DEV__ && (
        <Text style={styles.errorDetail} numberOfLines={3}>
          {error.message}
        </Text>
      )}
      <TouchableOpacity style={styles.cta} onPress={reset} activeOpacity={0.85}>
        <Text style={styles.ctaLabel}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: typography.fontFamily.display,
    fontSize: 20,
    fontWeight: typography.fontWeight.bold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  body: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 14,
    color: colors.text.secondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  errorDetail: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 12,
    color: colors.text.tertiary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
    textAlign: 'center',
    maxWidth: 320,
  },
  cta: {
    marginTop: spacing.md,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 28,
    backgroundColor: colors.neutral.chocolate,
  },
  ctaLabel: {
    fontFamily: typography.fontFamily.ui,
    fontSize: 15,
    fontWeight: typography.fontWeight.semibold,
    color: colors.white,
  },
});
