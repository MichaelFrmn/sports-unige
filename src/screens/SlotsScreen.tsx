import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { View, Text, SectionList, StyleSheet, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { listSlots } from '../services/siteService';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { QueryState } from '../components/QueryState';
import { Badge } from '../components/Badge';
import { SlotSummary } from '../components/SlotSummary';
import { useUnregister } from '../hooks/useUnregister';
import { parseDescription } from '../description';
import { Slot, formatDay, relativeDay } from '../types';
import { theme } from '../theme';

function groupByDay(slots: Slot[]) {
  const sorted = [...slots].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (parseDescription(a.description).start ?? '99').localeCompare(parseDescription(b.description).start ?? '99')
  );
  const sections: { date: string; data: Slot[] }[] = [];
  for (const s of sorted) {
    const last = sections[sections.length - 1];
    if (last?.date === s.date) last.data.push(s);
    else sections.push({ date: s.date, data: [s] });
  }
  return sections;
}

export function SlotsScreen({ route, navigation }: any) {
  const { sport, refreshKey } = route.params as { sport: string; refreshKey?: number };
  const { data, error, refreshing, refresh, reload } = useSiteQuery(() => listSlots(sport));
  const { busyId, ask } = useUnregister(() => reload());

  // Set after a signup so the list shows the new "Inscrit·e" badge.
  const lastRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== lastRefreshKey.current) {
      lastRefreshKey.current = refreshKey;
      refresh();
    }
  }, [refreshKey, refresh]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: sport });
  }, [navigation, sport]);

  if (!data) return <QueryState error={error} onRetry={refresh} />;

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      <SectionList
        sections={groupByDay(data)}
        keyExtractor={(s) => s.id}
        contentContainerStyle={{ padding: 16 }}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <View style={styles.dayHeader}>
            <Text style={styles.dayTitle}>{relativeDay(section.date) ?? formatDay(section.date)}</Text>
            {relativeDay(section.date) && <Text style={styles.daySub}>{formatDay(section.date)}</Text>}
          </View>
        )}
        renderItem={({ item }) => {
          const busy = busyId === item.id;
          return (
            <Pressable
              disabled={busy || (!item.registered && !item.bookable)}
              onPress={() => (item.registered ? ask(item) : navigation.navigate('Signup', { slot: item }))}
              style={({ pressed }) => [
                styles.card,
                item.registered && styles.cardRegistered,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.cardBody}>
                <SlotSummary description={item.description} />
              </View>
              <View style={styles.cardSide}>
                {busy ? (
                  <ActivityIndicator color={theme.colors.danger} />
                ) : item.registered ? (
                  <Badge label="Inscrit·e" tone="success" />
                ) : !item.bookable ? (
                  <Badge label="Indisponible" tone="neutral" />
                ) : (
                  <Text style={styles.chevron}>›</Text>
                )}
              </View>
            </Pressable>
          );
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={<Text style={styles.empty}>Aucune séance pour ce sport.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8, marginBottom: 8 },
  dayTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text, textTransform: 'capitalize' },
  daySub: { fontSize: 13, color: theme.colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cardRegistered: { borderColor: theme.colors.success, backgroundColor: theme.colors.successBg },
  pressed: { opacity: 0.7 },
  cardBody: { flex: 1 },
  cardSide: { alignSelf: 'flex-start' },
  chevron: { fontSize: 24, color: theme.colors.textMuted, lineHeight: 24 },
  error: { color: theme.colors.danger, marginHorizontal: 16, marginTop: 8 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
});
