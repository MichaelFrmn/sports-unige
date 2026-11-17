import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Switch,
  Modal,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { siteBridge } from '../site/bridge';
import { loadStoredLogin, setCredentials } from '../site/credentials';
import { DEFAULT_ORGANISATION } from '../site/organisations';
import { theme } from '../theme';

/**
 * The app's own login form. The official pages (institution picker, organisation
 * login) are filled in by the hidden WebView; the user never sees them.
 */
export function LoginScreen({ onSubmitted }: { onSubmitted: () => void }) {
  const error = useSyncExternalStore(siteBridge.subscribe, siteBridge.getLoginError);
  const [organisation, setOrganisation] = useState(DEFAULT_ORGANISATION);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [missing, setMissing] = useState(false);
  // The site's own institution list, read live from its picker page.
  const organisations = useSyncExternalStore(siteBridge.subscribe, siteBridge.getOrganisations);
  const organisationName = organisations.find((o) => o.entityId === organisation)?.name ?? organisation;
  const shown = organisations.filter((o) => o.name.toLowerCase().includes(search.trim().toLowerCase()));

  useEffect(() => {
    loadStoredLogin().then((s) => {
      if (s.organisation) setOrganisation(s.organisation);
      if (s.email) setEmail(s.email);
      if (s.password) {
        setPassword(s.password);
        setRemember(true);
      }
    });
  }, []);

  const submit = async () => {
    if (!email.trim() || !password) {
      setMissing(true);
      return;
    }
    setMissing(false);
    await setCredentials({ organisation, email: email.trim(), password }, remember);
    onSubmitted();
    siteBridge.login();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Sports UNIGE</Text>
          <Text style={styles.subtitle}>Connecte-toi avec ton compte universitaire.</Text>

          <Text style={styles.label}>Organisation</Text>
          <Pressable style={styles.input} onPress={() => setPickerOpen(true)}>
            <Text style={styles.inputText}>{organisationName}</Text>
          </Pressable>

          <Text style={styles.label}>E-mail</Text>
          <TextInput
            style={styles.input}
            placeholder="prenom.nom@unige.ch"
            placeholderTextColor={theme.colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="username"
            value={email}
            onChangeText={setEmail}
          />

          <Text style={styles.label}>Mot de passe</Text>
          <TextInput
            style={styles.input}
            placeholder="Mot de passe"
            placeholderTextColor={theme.colors.textMuted}
            secureTextEntry
            textContentType="password"
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={submit}
          />

          <View style={styles.rememberRow}>
            <Text style={styles.rememberText}>Se souvenir de moi</Text>
            <Switch
              value={remember}
              onValueChange={setRemember}
              trackColor={{ true: theme.colors.primary, false: theme.colors.border }}
              thumbColor="#fff"
            />
          </View>
          <Text style={styles.hint}>
            Le mot de passe est alors gardé chiffré sur cet appareil pour te reconnecter automatiquement.
          </Text>

          {missing && <Text style={styles.error}>Entre ton e-mail et ton mot de passe.</Text>}
          {error && !missing && <Text style={styles.error}>{error}</Text>}

          <Pressable style={({ pressed }) => [styles.button, pressed && styles.pressed]} onPress={submit}>
            <Text style={styles.buttonText}>Se connecter</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
        <SafeAreaView style={styles.screen}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>Organisation</Text>
            <Pressable hitSlop={8} onPress={() => setPickerOpen(false)}>
              <Text style={styles.pickerClose}>Fermer</Text>
            </Pressable>
          </View>
          <TextInput
            style={[styles.input, styles.search]}
            placeholder="Rechercher une organisation…"
            placeholderTextColor={theme.colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
          <FlatList
            data={shown}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(o) => o.entityId}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                onPress={() => {
                  setOrganisation(item.entityId);
                  setSearch('');
                  setPickerOpen(false);
                }}
              >
                <Text style={[styles.optionText, item.entityId === organisation && styles.optionSelected]}>
                  {item.name}
                </Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

/** Full-screen "logging in" state while the hidden WebView goes through the official pages. */
export function LoggingIn() {
  return (
    <SafeAreaView style={[styles.screen, styles.center]}>
      <ActivityIndicator color={theme.colors.primary} size="large" />
      <Text style={styles.subtitle}>Connexion en cours…</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { padding: 24, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '800', color: theme.colors.primary },
  subtitle: { fontSize: 15, color: theme.colors.textMuted, marginTop: 6, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '700', color: theme.colors.text, marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
  },
  inputText: { fontSize: 15, color: theme.colors.text },
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  rememberText: { fontSize: 15, color: theme.colors.text, fontWeight: '600' },
  hint: { fontSize: 12, color: theme.colors.textMuted, marginTop: 4 },
  error: { color: theme.colors.danger, fontSize: 14, marginTop: 16 },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  pressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '800' },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  search: { margin: 16, marginBottom: 8 },
  pickerTitle: { fontSize: 17, fontWeight: '800', color: theme.colors.text },
  pickerClose: { color: theme.colors.primary, fontWeight: '700' },
  option: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  optionText: { fontSize: 15, color: theme.colors.text },
  optionSelected: { color: theme.colors.primary, fontWeight: '800' },
});
