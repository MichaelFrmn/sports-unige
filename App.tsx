import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, Alert } from 'react-native';

import { SportsScreen } from './src/screens/SportsScreen';
import { SlotsScreen } from './src/screens/SlotsScreen';
import { SignupScreen } from './src/screens/SignupScreen';
import { MyRegistrationsScreen } from './src/screens/MyRegistrationsScreen';
import { SiteWebView } from './src/site/SiteWebView';
import { logout } from './src/services/siteService';
import { theme } from './src/theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const screenHeader = {
  headerStyle: { backgroundColor: theme.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' as const },
};

function SportsStack() {
  return (
    <Stack.Navigator screenOptions={screenHeader}>
      <Stack.Screen name="SportsList" component={SportsScreen} options={{ title: 'Sports' }} />
      <Stack.Screen name="Slots" component={SlotsScreen} options={{ title: 'Séances' }} />
      <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Inscription' }} />
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Tab.Navigator
          screenOptions={({ route }) => ({
            ...screenHeader,
            headerShown: false,
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
          <Tab.Screen name="Activités" component={SportsStack} />
          <Tab.Screen
            name="Mes inscriptions"
            component={MyRegistrationsScreen}
            options={{
              headerShown: true,
              title: 'Mes inscriptions',
              headerRight: () => (
                <Pressable
                  hitSlop={8}
                  style={{ marginRight: 16 }}
                  onPress={() =>
                    Alert.alert('Se déconnecter ?', 'Vous devrez vous reconnecter au site UNIGE.', [
                      { text: 'Annuler', style: 'cancel' },
                      { text: 'Se déconnecter', style: 'destructive', onPress: () => logout() },
                    ])
                  }
                >
                  <Ionicons name="log-out-outline" size={22} color="#fff" />
                </Pressable>
              ),
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
      {/* Mounted once for the app's lifetime: it holds the UNIGE login session. */}
      <SiteWebView />
    </SafeAreaProvider>
  );
}
