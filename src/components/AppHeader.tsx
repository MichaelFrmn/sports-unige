import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { logout } from '../services/siteService';
import { theme } from '../theme';

/**
 * Plain React header for the two tab-root screens, instead of react-navigation's
 * native header. Switching tabs toggles which native Screen is visible, and a
 * native header (Toolbar-based via react-native-screens) was re-measuring on
 * that toggle — neither disabling the stack transition nor keeping inactive
 * screens attached stopped it. A screen-content header isn't tied to any of
 * that native machinery.
 */
export function AppHeader({ title }: { title: string }) {
  return (
    <SafeAreaView edges={['top']} style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Pressable
        hitSlop={8}
        onPress={() =>
          Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter au site UNIGE.', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
          ])
        }
      >
        <Ionicons name="log-out-outline" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    backgroundColor: theme.colors.primary,
  },
  title: { color: '#fff', fontSize: 17, fontWeight: '800' },
});
