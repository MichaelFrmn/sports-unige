import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../theme';

type Tone = 'success' | 'danger' | 'warn' | 'neutral';

const tones: Record<Tone, { bg: string; fg: string }> = {
  success: { bg: theme.colors.successBg, fg: theme.colors.success },
  danger: { bg: theme.colors.dangerBg, fg: theme.colors.danger },
  warn: { bg: theme.colors.warnBg, fg: theme.colors.warnText },
  neutral: { bg: '#ECEFF3', fg: theme.colors.textMuted },
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const c = tones[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '700' },
});
