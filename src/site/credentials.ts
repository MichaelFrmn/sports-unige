import * as SecureStore from 'expo-secure-store';

// Kept in the OS-level encrypted keychain (Android Keystore / iOS Keychain),
// never sent anywhere except typed into the site's own login form.
const EMAIL_KEY = 'unigeSports.autoLogin.email';
const PASSWORD_KEY = 'unigeSports.autoLogin.password';

export interface StoredCredentials {
  email: string;
  password: string;
}

export async function loadCredentials(): Promise<StoredCredentials | null> {
  const [email, password] = await Promise.all([
    SecureStore.getItemAsync(EMAIL_KEY),
    SecureStore.getItemAsync(PASSWORD_KEY),
  ]);
  return email && password ? { email, password } : null;
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(EMAIL_KEY, creds.email),
    SecureStore.setItemAsync(PASSWORD_KEY, creds.password),
  ]);
}

export async function clearCredentials(): Promise<void> {
  await Promise.all([SecureStore.deleteItemAsync(EMAIL_KEY), SecureStore.deleteItemAsync(PASSWORD_KEY)]);
}
