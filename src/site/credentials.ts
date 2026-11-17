import * as SecureStore from 'expo-secure-store';

// Kept in the OS-level encrypted keychain (Android Keystore / iOS Keychain),
// never sent anywhere except typed into the site's own login form.
const KEYS = {
  organisation: 'unigeSports.login.organisation',
  email: 'unigeSports.login.email',
  password: 'unigeSports.login.password',
};

export interface Credentials {
  organisation: string; // entityID from the institution picker
  email: string;
  password: string;
}

export interface StoredLogin {
  organisation: string | null;
  email: string | null;
  password: string | null; // only when "remember me" was on
}

// Used for re-logins while the app is open, even without "remember me".
let session: Credentials | null = null;

export async function loadStoredLogin(): Promise<StoredLogin> {
  const [organisation, email, password] = await Promise.all([
    SecureStore.getItemAsync(KEYS.organisation),
    SecureStore.getItemAsync(KEYS.email),
    SecureStore.getItemAsync(KEYS.password),
  ]);
  return { organisation, email, password };
}

/** Credentials to log in with: this session's, else fully remembered ones. */
export async function activeCredentials(): Promise<Credentials | null> {
  if (session) return session;
  const s = await loadStoredLogin();
  return s.organisation && s.email && s.password
    ? { organisation: s.organisation, email: s.email, password: s.password }
    : null;
}

export async function setCredentials(creds: Credentials, remember: boolean): Promise<void> {
  session = creds;
  await Promise.all([
    SecureStore.setItemAsync(KEYS.organisation, creds.organisation),
    SecureStore.setItemAsync(KEYS.email, creds.email),
    remember ? SecureStore.setItemAsync(KEYS.password, creds.password) : SecureStore.deleteItemAsync(KEYS.password),
  ]);
}

export function forgetSession(): void {
  session = null;
}
