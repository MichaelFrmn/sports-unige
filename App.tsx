import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Alert, View, StyleSheet } from 'react-native';

import { SportsScreen } from './src/screens/SportsScreen';
import { SlotsScreen } from './src/screens/SlotsScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { MyRegistrationsScreen } from './src/screens/MyRegistrationsScreen';
import { LoginCodeScreen, LoginScreen, LoggingIn } from './src/screens/LoginScreen';
import { SiteWebView, useSiteStatus } from './src/site/SiteWebView';
import { logout } from './src/services/siteService';
import { theme } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const header = {
  headerStyle: { backgroundColor: theme.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' as const },
};

function LogoutButton() {
  return (
    <Pressable
      hitSlop={8}
      style={{ marginRight: 16 }}
      onPress={() =>
        Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter au site UNIGE.', [
          { text: 'Annuler', style: 'cancel' },
          { text: 'Se déconnecter', style: 'destructive', onPress: logout },
        ])
      }
    >
      <Ionicons name="log-out-outline" size={22} color="#fff" />
    </Pressable>
  );
}

const stackOptions = { ...header, headerRight: () => <LogoutButton /> };

function ActivitiesTab() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Sports" component={SportsScreen} options={{ title: 'Activités' }} />
      <Stack.Screen name="Slots" component={SlotsScreen} options={{ title: 'Séances' }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Inscription' }} />
    </Stack.Navigator>
  );
}

function RegistrationsTab() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Registrations" component={MyRegistrationsScreen} options={{ title: 'Mes inscriptions' }} />
    </Stack.Navigator>
  );
}

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // Each tab has its own stack, which draws the top bar.
        headerShown: false,
        lazy: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textMuted,
        tabBarIcon: ({ color, size, focused }) => (
          <Ionicons
            name={
              route.name === 'Activités'
                ? focused ? 'barbell' : 'barbell-outline'
                : focused ? 'calendar-clear' : 'calendar-clear-outline'
            }
            size={size}
            color={color}
          />
        ),
      })}
    >
      <Tab.Screen name="Activités" component={ActivitiesTab} />
      <Tab.Screen name="Mes inscriptions" component={RegistrationsTab} />
    </Tab.Navigator>
  );
}

/** The app's own login screen, over everything, whenever the site needs credentials. */
function LoginGate() {
  const status = useSiteStatus();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status !== 'loading') setSubmitting(false);
  }, [status]);

  if (status !== 'login' && status !== 'code' && !submitting) return null;
  return (
    <View style={styles.overlay}>
      {status === 'login' ? (
        <LoginScreen onSubmitted={() => setSubmitting(true)} />
      ) : status === 'code' ? (
        <LoginCodeScreen onSubmitted={() => setSubmitting(true)} />
      ) : (
        <LoggingIn />
      )}
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      {/* Rendered first so it sits underneath the app; it is never shown. */}
      <SiteWebView />
      <NavigationContainer>
        <StatusBar style="light" />
        <Tabs />
      </NavigationContainer>
      <LoginGate />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 20, elevation: 20 },
});
