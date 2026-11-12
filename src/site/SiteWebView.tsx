import React, { useState, useSyncExternalStore } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { siteBridge } from './bridge';
import { HOME_URL } from './pageScripts';
import { theme } from '../theme';
import { CredentialsPrompt } from '../components/CredentialsPrompt';

// The scripts are written against the desktop markup; a mobile UA might get a different rendition.
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export function useSiteStatus() {
  return useSyncExternalStore(siteBridge.subscribe, siteBridge.getStatus);
}

export function SiteWebView() {
  const status = useSiteStatus();
  const shown = status === 'login';
  const [promptOpen, setPromptOpen] = useState(false);

  return (
    <View
      style={[StyleSheet.absoluteFill, shown ? styles.shown : styles.hidden]}
      pointerEvents={shown ? 'auto' : 'none'}
    >
      <SafeAreaView edges={['top']} style={styles.header}>
        <Text style={styles.title}>Connexion UNIGE</Text>
        <View style={styles.headerActions}>
          <Pressable hitSlop={8} onPress={() => setPromptOpen(true)}>
            <Text style={styles.reload}>Connexion auto</Text>
          </Pressable>
          <Pressable hitSlop={8} onPress={siteBridge.goHome}>
            <Text style={styles.reload}>Recharger</Text>
          </Pressable>
        </View>
      </SafeAreaView>
      <WebView<{}>
        ref={siteBridge.attach}
        source={{ uri: HOME_URL }}
        userAgent={DESKTOP_UA}
        onLoadStart={siteBridge.onLoadStart}
        onLoadEnd={siteBridge.onLoadEnd}
        onMessage={siteBridge.onMessage}
        sharedCookiesEnabled
        style={styles.webview}
      />
      <CredentialsPrompt visible={promptOpen} onClose={() => setPromptOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  shown: { zIndex: 10, elevation: 10, backgroundColor: theme.colors.surface },
  hidden: { opacity: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: theme.colors.primary,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 16 },
  reload: { color: '#fff', fontWeight: '700' },
  webview: { flex: 1 },
});
