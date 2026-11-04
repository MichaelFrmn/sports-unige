import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator, Pressable } from 'react-native';
import { theme } from '../theme';
import { useSiteStatus } from '../site/SiteWebView';

/** Full-screen loading / error placeholder shown before the first data arrives. */
export function QueryState({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  const status = useSiteStatus();

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Impossible de charger</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={onRetry} style={styles.retry}>
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.hint}>
        {status === 'login' ? 'En attente de connexion…' : 'Chargement depuis le site UNIGE…'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.bg,
  },
  hint: { marginTop: 12, color: theme.colors.textMuted, fontSize: 14 },
  errorTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
  errorText: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 14 },
  retry: {
    marginTop: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryText: { color: '#fff', fontWeight: '800' },
});
