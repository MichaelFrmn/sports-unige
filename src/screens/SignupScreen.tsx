import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { SignupForm, Slot, formatDay } from '../types';
import { SignupError, abortSignup, openSignup, submitSignup } from '../services/siteService';
import { QueryState } from '../components/QueryState';
import { SlotSummary } from '../components/SlotSummary';
import { theme } from '../theme';

const CONDITIONS_URL = 'https://vie-de-campus.unige.ch/a-propos/conditions-generales#55882';

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

export function SignupScreen({ route, navigation }: any) {
  const { slot } = route.params as { slot: Slot };
  const [form, setForm] = useState<SignupForm | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Once submitted, the site has left the form by itself; leaving must not reload over it.
  const done = useRef(false);
  // Only the latest opening counts: an older one's form may no longer be on the site page.
  const attempt = useRef(0);
  const focusedOnce = useRef(false);

  useLayoutEffect(() => {
    navigation.setOptions({ title: slot.sport });
  }, [navigation, slot.sport]);

  const open = () => {
    const current = ++attempt.current;
    setError(null);
    openSignup(slot)
      .then((f) => {
        if (current === attempt.current) setForm(f);
      })
      .catch((e) => {
        if (current !== attempt.current) return;
        if (e instanceof SignupError && e.code === 'FULL') setFull(e.message);
        else setError(e instanceof Error ? e.message : String(e));
      });
  };

  useEffect(() => {
    open();
    return () => {
      if (!done.current) abortSignup().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The other tab shares the site page and may have left this form: reopen it on return.
  useFocusEffect(
    useCallback(() => {
      if (focusedOnce.current && !done.current) {
        setForm(null);
        setFull(null);
        open();
      }
      focusedOnce.current = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  if (full) {
    return (
      <View style={styles.fullWrap}>
        <Text style={styles.fullTitle}>Activité complète</Text>
        <Text style={styles.fullText}>{full}</Text>
        <Text style={styles.fullText}>{slot.description}</Text>
        <Pressable onPress={() => navigation.goBack()} style={[styles.cta, styles.fullButton]}>
          <Text style={styles.ctaText}>Retour aux séances</Text>
        </Pressable>
      </View>
    );
  }

  if (!form) return <QueryState error={error} onRetry={open} />;

  const paid = form.priceChf > 0;

  const onSubmit = async () => {
    setSubmitting(true);
    done.current = true;
    try {
      const message = await submitSignup();
      Alert.alert('Inscription enregistrée', message, [
        { text: 'OK', onPress: () => navigation.navigate('Slots', { sport: slot.sport, refreshKey: Date.now() }) },
      ]);
    } catch (e) {
      const title = e instanceof SignupError && e.code === 'FULL' ? 'Activité complète' : 'Inscription impossible';
      const message =
        e instanceof SignupError && e.code === 'UNKNOWN'
          ? `${e.message}\n\nVérifiez dans « Mes inscriptions » si l’inscription a été prise en compte.`
          : e instanceof Error
            ? e.message
            : String(e);
      Alert.alert(title, message, [{ text: 'OK', onPress: () => navigation.goBack() }]);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={styles.title}>{formatDay(slot.date)}</Text>
        <View style={styles.summary}>
          <SlotSummary description={form.description} size="lg" />
        </View>
        {form.information ? <Text style={styles.info}>{form.information}</Text> : null}

        <View style={styles.card}>
          <Row label="Lieu" value={form.location} />
          <Row label="Enseignant·e" value={form.teacher} />
          <Row label="Dates" value={form.startDate === form.endDate ? form.startDate : `${form.startDate} → ${form.endDate}`} />
          <Row label="Prix" value={paid ? form.price : 'Gratuit'} />
          <Row label="Délai d’inscription" value={form.window} />
          <Row label="Téléphone" value={form.phone || 'manquant'} />
        </View>

        {paid ? (
          <Text style={styles.notice}>
            Activité payante : l’app ne gère pas le paiement, inscrivez-vous sur le site.
          </Text>
        ) : (
          <Text style={styles.terms}>
            En vous inscrivant, vous acceptez{' '}
            <Text style={styles.link} onPress={() => Linking.openURL(CONDITIONS_URL)}>
              les conditions générales de participation
            </Text>
            .
          </Text>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          disabled={paid || submitting || !form.phone}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.cta,
            (paid || !form.phone) && styles.ctaDisabled,
            pressed && styles.ctaPressed,
          ]}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>S'inscrire</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text, textTransform: 'capitalize' },
  summary: { marginTop: 8, marginBottom: 16 },
  info: { fontSize: 14, color: theme.colors.text, marginBottom: 16 },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    gap: 16,
  },
  rowLabel: { fontSize: 14, color: theme.colors.textMuted },
  rowValue: { fontSize: 14, color: theme.colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  notice: { marginTop: 16, color: theme.colors.warnText, fontSize: 14 },
  terms: { marginTop: 16, color: theme.colors.textMuted, fontSize: 13 },
  link: { color: theme.colors.primary, fontWeight: '700' },
  fullWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: theme.colors.bg,
  },
  fullTitle: { fontSize: 20, fontWeight: '800', color: theme.colors.danger, marginBottom: 8 },
  fullText: { textAlign: 'center', color: theme.colors.textMuted, fontSize: 14, marginTop: 4 },
  fullButton: { marginTop: 24, paddingHorizontal: 24 },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  cta: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
  },
  ctaPressed: { backgroundColor: theme.colors.primaryDark },
  ctaDisabled: { backgroundColor: '#C9CDD3' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },
});
