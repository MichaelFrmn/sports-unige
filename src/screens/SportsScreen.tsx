import React, { useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TextInput, Pressable } from 'react-native';
import { listSports } from '../services/siteService';
import { useSiteQuery } from '../hooks/useSiteQuery';
import { QueryState } from '../components/QueryState';
import { theme } from '../theme';

export function SportsScreen({ navigation }: any) {
  const { data, error, refreshing, refresh } = useSiteQuery(() => listSports());
  const [query, setQuery] = useState('');

  if (!data) return <QueryState error={error} onRetry={refresh} />;

  const filtered = data.filter((s) => s.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <View style={styles.container}>
      <TextInput
        placeholder="Rechercher un sport…"
        placeholderTextColor={theme.colors.textMuted}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      <FlatList
        data={filtered}
        keyExtractor={(s) => s}
        contentContainerStyle={{ padding: 16, paddingTop: 0 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate('Slots', { sport: item })}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.sport}>{item}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={<Text style={styles.empty}>Aucun sport disponible.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  search: {
    margin: 16,
    marginBottom: 12,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
  },
  pressed: { opacity: 0.7 },
  sport: { flex: 1, fontSize: 15, fontWeight: '700', color: theme.colors.text },
  chevron: { fontSize: 22, color: theme.colors.textMuted },
  error: { color: theme.colors.danger, marginHorizontal: 16, marginBottom: 12 },
  empty: { textAlign: 'center', color: theme.colors.textMuted, marginTop: 40 },
});
