import React, { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, SectionList, StyleSheet, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { listMyRegistrations } from '../services/siteService';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { QueryState } from '../components/QueryState';
import { AppHeader } from '../components/AppHeader';
import { Badge } from '../components/Badge';
import { SlotSummary } from '../components/SlotSummary';
import { useUnregister } from '../hooks/useUnregister';
import { Registration, formatDay, isPast } from '../types';
import { theme } from '../theme';

export function MyRegistrationsScreen() {
  const { data, error, refreshing, refresh, reload } = useSiteQuery(({ refresh: fresh }) =>
    listMyRegistrations({ fresh })
  );

  // Re-read when coming back to the tab (e.g. after signing up); the first focus is the initial load.
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const focusedOnce = useRef(false);
  const { busyId, ask } = useUnregister(() => reloadRef.current());
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current) reloadRef.current();
      focusedOnce.current = true;
    }, [])
  );

  if (!data) {
    return (
      <>
        <AppHeader title="Mes inscriptions" />
        <QueryState error={error} onRetry={refresh} />
      </>
    );
  }

  const upcoming = data.filter((r) => !isPast(r.date)).sort((a, b) => a.date.localeCompare(b.date));
  const past = data.filter((r) => isPast(r.date)).sort((a, b) => b.date.localeCompare(a.date));
  const sections = [
    { title: 'À venir', data: upcoming },
    { title: 'Passées', data: past },
  ].filter((s) => s.data.length > 0);

  return (
    <View style={styles.container}>
      <AppHeader title="Mes inscriptions" />
      {error && <Text style={styles.error}>{error}</Text>}
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: 16 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => (
          <RegistrationCard
            reg={item}
            busy={busyId === item.id}
            onUnregister={item.cancellable && !isPast(item.date) ? () => ask(item) : undefined}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>Aucune inscription</Text>
            <Text style={styles.empty}>Vos inscriptions sur le site UNIGE apparaîtront ici.</Text>
          </View>
        }
      />
    </View>
  );
}

function RegistrationCard({
  reg,
  busy,
  onUnregister,
}: {
  reg: Registration;
  busy: boolean;
  onUnregister?: () => void;
}) {
  const meta = [reg.location, reg.teacher].filter(Boolean).join('  ·  ');
  return (
    <View style={[styles.card, isPast(reg.date) && styles.pastCard]}>
      <View style={styles.headerRow}>
        <Text style={styles.sport}>{reg.sport}</Text>
        {reg.status ? <Badge label={reg.status} tone={reg.status === 'Payé' ? 'success' : 'warn'} /> : null}
      </View>
      <Text style={styles.day}>{formatDay(reg.date)}</Text>
      <View style={styles.summary}>
        <SlotSummary description={reg.description} />
      </View>
      {meta ? <Text style={styles.meta}>{meta}</Text> : null}
      {reg.price > 0 && <Text style={styles.meta}>SFr. {reg.price.toFixed(2)}</Text>}
      {onUnregister && (
        <Pressable onPress={onUnregister} disabled={busy} style={styles.unregister} hitSlop={6}>
          {busy ? (
            <ActivityIndicator color={theme.colors.danger} />
          ) : (
            <Text style={styles.unregisterText}>Se désinscrire</Text>
          )}
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  section: {
    fontSize: 13,
    fontWeight: '800',
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: 16,
    marginBottom: 12,
  },
  pastCard: { opacity: 0.6 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sport: { fontSize: 16, fontWeight: '800', color: theme.colors.text, flex: 1 },
  day: { fontSize: 14, fontWeight: '700', color: theme.colors.text, marginTop: 4, textTransform: 'capitalize' },
  summary: { marginTop: 6 },
  meta: { fontSize: 13, color: theme.colors.textMuted, marginTop: 6 },
  unregister: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.danger,
    alignItems: 'center',
  },
  unregisterText: { color: theme.colors.danger, fontWeight: '800', fontSize: 14 },
  error: { color: theme.colors.danger, marginHorizontal: 16, marginTop: 8 },
  emptyWrap: { alignItems: 'center', marginTop: 60, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text, marginBottom: 6 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 14 },
});
