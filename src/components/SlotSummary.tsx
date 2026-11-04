import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ParsedDescription, formatDuration, levelFill, parseDescription } from '../description';
import { theme } from '../theme';

const LEVEL_NAMES = ['Débutant', 'Intermédiaire', 'Avancé'];

function levelLabel(p: ParsedDescription): string {
  if (p.allLevels || p.levels.length === 3) return 'Tous niveaux';
  if (p.levels.length === 1) return LEVEL_NAMES[p.levels[0]];
  const first = LEVEL_NAMES[p.levels[0]];
  const last = LEVEL_NAMES[p.levels[p.levels.length - 1]].toLowerCase();
  return `${first} – ${last}`;
}

// Green for beginner-friendly, red for advanced-only; keyed by levelFill().
const FILL_COLORS: Record<string, string> = {
  '1': '#1B8A5A',
  '1.5': '#7CB342',
  '2': '#E0A100',
  '2.5': '#EF6C00',
  '3': '#C62828',
};

const DOT = 8;
const EMPTY = '#D5D9DE';

function LevelMeter({ parsed }: { parsed: ParsedDescription }) {
  const fill = levelFill(parsed);
  const color = fill === null ? theme.colors.textMuted : FILL_COLORS[String(fill)];
  return (
    <View style={styles.levelRow}>
      <View style={styles.meter}>
        {[0, 1, 2].map((i) => {
          const amount = fill === null ? 0 : fill - i; // ≤0 empty, 0.5 half, ≥1 full
          // Two solid half-discs: no clipping, so the half fill stays crisp on Android too.
          return (
            <View key={i} style={styles.dot}>
              <View style={[styles.half, styles.left, { backgroundColor: amount > 0 ? color : EMPTY }]} />
              <View style={[styles.half, styles.right, { backgroundColor: amount >= 1 ? color : EMPTY }]} />
            </View>
          );
        })}
      </View>
      <Text style={[styles.levelText, { color: fill === null ? theme.colors.text : color }]}>
        {fill === null ? 'Tous niveaux' : levelLabel(parsed)}
      </Text>
    </View>
  );
}

/** Time range, duration, level and extra info parsed from a slot description; raw text if it doesn't parse. */
export function SlotSummary({ description, size = 'md' }: { description: string; size?: 'md' | 'lg' }) {
  const parsed = parseDescription(description);

  if (!parsed.start) return <Text style={styles.raw}>{description}</Text>;

  return (
    <View>
      <View style={styles.timeRow}>
        <Text style={[styles.time, size === 'lg' && styles.timeLg]}>
          {parsed.start} – {parsed.end}
        </Text>
        <Text style={styles.duration}>{formatDuration(parsed.durationMin!)}</Text>
      </View>
      {(parsed.allLevels || parsed.levels.length > 0) && <LevelMeter parsed={parsed} />}
      {parsed.tags.length > 0 && (
        <View style={styles.tags}>
          {parsed.tags.map((t) => (
            <View key={t} style={styles.tag}>
              <Text style={styles.tagText}>{t}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  raw: { fontSize: 14, color: theme.colors.text, lineHeight: 20 },
  timeRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  time: { fontSize: 18, fontWeight: '800', color: theme.colors.text, fontVariant: ['tabular-nums'] },
  timeLg: { fontSize: 26 },
  duration: { fontSize: 13, color: theme.colors.textMuted, fontWeight: '600' },
  levelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  meter: { flexDirection: 'row', gap: 3 },
  dot: { flexDirection: 'row', width: DOT, height: DOT },
  half: { width: DOT / 2, height: DOT },
  left: { borderTopLeftRadius: DOT / 2, borderBottomLeftRadius: DOT / 2 },
  right: { borderTopRightRadius: DOT / 2, borderBottomRightRadius: DOT / 2 },
  levelText: { fontSize: 13, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  tag: {
    backgroundColor: theme.colors.bg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagText: { fontSize: 12, color: theme.colors.textMuted, fontWeight: '600' },
});
