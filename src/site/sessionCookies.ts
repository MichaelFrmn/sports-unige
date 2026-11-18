import { requireOptionalNativeModule } from 'expo';

// Android only (modules/site-cookies), and absent from Expo Go.
const native = requireOptionalNativeModule<{ clearSessionCookies(): Promise<boolean> }>('SiteCookies');

/** Deletes the WebView's session cookies only. False if that isn't possible here. */
export async function clearSessionCookies(): Promise<boolean> {
  try {
    return native ? await native.clearSessionCookies() : false;
  } catch {
    return false;
  }
}
