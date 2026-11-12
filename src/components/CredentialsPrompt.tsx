import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { clearCredentials, loadCredentials, saveCredentials } from '../site/credentials';
import { siteBridge } from '../site/bridge';
import { theme } from '../theme';

export function CredentialsPrompt({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [savedEmail, setSavedEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    loadCredentials().then((c) => setSavedEmail(c?.email ?? null));
  }, [visible]);

  const save = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Champs manquants', 'Entrez votre e-mail et votre mot de passe Switch edu-ID.');
      return;
    }
    await saveCredentials({ email: email.trim(), password });
    setPassword('');
    onClose();
    siteBridge.goHome();
  };

  const forget = async () => {
    await clearCredentials();
    setSavedEmail(null);
    setEmail('');
    setPassword('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Connexion automatique</Text>
          <Text style={styles.text}>
            Enregistre ton e-mail et mot de passe Switch edu-ID (chiffrés sur l’appareil) pour que
            l’app se reconnecte seule quand la session expire. Ne couvre pas une éventuelle double
            authentification.
          </Text>
          {savedEmail ? (
            <>
              <Text style={styles.savedText}>Identifiants enregistrés pour {savedEmail}.</Text>
              <Pressable style={[styles.button, styles.forgetButton]} onPress={forget}>
                <Text style={styles.forgetButtonText}>Oublier ces identifiants</Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                placeholder="prenom.nom@epfl.ch"
                placeholderTextColor={theme.colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                style={styles.input}
              />
              <TextInput
                placeholder="Mot de passe"
                placeholderTextColor={theme.colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                style={styles.input}
              />
              <Pressable style={styles.button} onPress={save}>
                <Text style={styles.buttonText}>Enregistrer</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeRow}>
            <Text style={styles.closeText}>Fermer</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: theme.colors.surface,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: 20,
  },
  title: { fontSize: 18, fontWeight: '800', color: theme.colors.text, marginBottom: 8 },
  text: { fontSize: 13, color: theme.colors.textMuted, marginBottom: 16, lineHeight: 18 },
  savedText: { fontSize: 14, color: theme.colors.text, marginBottom: 16 },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: theme.colors.text,
    marginBottom: 12,
  },
  button: {
    backgroundColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  forgetButton: { backgroundColor: theme.colors.dangerBg },
  forgetButtonText: { color: theme.colors.danger, fontWeight: '800', fontSize: 15 },
  closeRow: { alignItems: 'center', marginTop: 16 },
  closeText: { color: theme.colors.textMuted, fontWeight: '700' },
});
