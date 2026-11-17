import React, { useSyncExternalStore } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { siteBridge } from './bridge';
import { HOME_URL } from './pageScripts';

// The scripts are written against the desktop markup; a mobile UA might get a different rendition.
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

export function useSiteStatus() {
  return useSyncExternalStore(siteBridge.subscribe, siteBridge.getStatus);
}

/**
 * The official site, driven by injected scripts and never shown: login goes through
 * the app's own LoginScreen. Rendered beneath the app (see App.tsx) rather than over
 * it at opacity 0, which made Android recomposite it on every change underneath.
 */
export function SiteWebView() {
  const generation = useSyncExternalStore(siteBridge.subscribe, siteBridge.getGeneration);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <WebView<{}>
        // A logout bumps the generation: the WebView remounts in incognito mode, which
        // wipes all cookies on Android, so the next load needs a full fresh login.
        key={generation}
        incognito={generation > 0}
        ref={siteBridge.attach}
        source={{ uri: HOME_URL }}
        userAgent={DESKTOP_UA}
        onLoadStart={siteBridge.onLoadStart}
        onLoadEnd={siteBridge.onLoadEnd}
        onMessage={siteBridge.onMessage}
        sharedCookiesEnabled
        style={{ flex: 1 }}
      />
    </View>
  );
}
