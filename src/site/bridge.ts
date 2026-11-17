import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  CLICK_LOGOUT,
  FORCED_LOGIN_URL,
  HOME_URL,
  IS_LOGOUT_CONFIRMATION,
  PAGE_HELPERS,
  PROBE,
  autoLoginStep,
} from './pageScripts';
import { loadCredentials } from './credentials';

// 'login' means the WebView is showing something other than the inscription
// app (Shibboleth login, an error page…) and the user has to deal with it.
export type SiteStatus = 'loading' | 'login' | 'ready';

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const COMMAND_TIMEOUT_MS = 30000;
// If auto-login keeps landing on the same step (e.g. a rejected password), stop
// retrying and show the real form instead of looping silently.
const MAX_SAME_AUTO_LOGIN_STEP = 2;
// Backstop across the whole auto-login/bounce sequence, regardless of pattern —
// an alternating loop (e.g. password page -> logout-confirmation page -> password
// page -> ...) would never repeat the same step twice in a row, so it would never
// trip MAX_SAME_AUTO_LOGIN_STEP on its own and could otherwise retry forever,
// reloading real pages on the site with no delay between attempts.
const MAX_AUTO_ACTIONS = 6;

let webView: Pick<WebView, 'injectJavaScript'> | null = null;
let status: SiteStatus = 'loading';
const listeners = new Set<() => void>();
const pending = new Map<number, Pending>();
let nextId = 1;
let readyWaiters: (() => void)[] = [];
// ADF pages are stateful, so commands must never overlap.
let queue: Promise<unknown> = Promise.resolve();
let autoLoginStepSeen: string | null = null;
let autoLoginStepCount = 0;
let autoLoginActions = 0;
// Set by an explicit logout: show the login screen instead of logging straight back in.
let logoutRequested = false;
let autoLoginPaused = false;

function resetAutoLogin() {
  autoLoginStepSeen = null;
  autoLoginStepCount = 0;
  autoLoginActions = 0;
}

function setStatus(s: SiteStatus) {
  if (s === status) return;
  status = s;
  if (s === 'ready') {
    resetAutoLogin();
    logoutRequested = false;
    autoLoginPaused = false;
    readyWaiters.forEach((w) => w());
    readyWaiters = [];
  }
  listeners.forEach((l) => l());
}

function waitReady(): Promise<void> {
  return status === 'ready' ? Promise.resolve() : new Promise((r) => readyWaiters.push(r));
}

function rejectAll(reason: string) {
  pending.forEach((p) => {
    clearTimeout(p.timer);
    p.reject(new Error(reason));
  });
  pending.clear();
}

function exec<T>(body: string): Promise<T> {
  if (!webView) return Promise.reject(new Error('Site non initialisé.'));
  const id = nextId++;
  const script = `(function () {
    var post = function (m) { window.ReactNativeWebView.postMessage(JSON.stringify(m)); };
    var fail = function (e) { post({ id: ${id}, ok: false, error: String((e && e.message) || e) }); };
    try {
      ${PAGE_HELPERS}
      (async function () { ${body} })().then(function (v) { post({ id: ${id}, ok: true, value: v }); }, fail);
    } catch (e) { fail(e); }
  })(); true;`;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Le site ne répond pas.'));
    }, COMMAND_TIMEOUT_MS);
    pending.set(id, { resolve, reject, timer });
    webView!.injectJavaScript(script);
  });
}

function enqueue<T>(task: () => Promise<T>): Promise<T> {
  const result = queue.then(task, task);
  queue = result.catch(() => undefined);
  return result;
}

export const siteBridge = {
  getStatus: () => status,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  attach(ref: Pick<WebView, 'injectJavaScript'> | null) {
    webView = ref;
  },

  onLoadStart() {
    setStatus('loading');
    rejectAll('La page du site a changé pendant le chargement. Réessayez.');
  },

  async onLoadEnd() {
    let probe: { url: string; app: boolean };
    try {
      probe = await exec<{ url: string; app: boolean }>(PROBE);
    } catch {
      setStatus('login');
      return;
    }
    if (probe.app) {
      setStatus('ready');
      return;
    }

    if (autoLoginActions >= MAX_AUTO_ACTIONS) {
      setStatus('login'); // too many automatic steps without reaching the app — let the user take over
      return;
    }

    try {
      if (await exec<boolean>(IS_LOGOUT_CONFIRMATION)) {
        autoLoginActions += 1;
        const next = logoutRequested ? FORCED_LOGIN_URL : HOME_URL;
        logoutRequested = false;
        webView?.injectJavaScript(`location.href = ${JSON.stringify(next)}; true;`);
        return; // stay hidden; the resulting navigation triggers another onLoadEnd
      }
    } catch {
      // Not that page (or the page errored) — fall through to normal handling.
    }

    const creds = autoLoginPaused ? null : await loadCredentials();
    if (!creds) {
      setStatus('login');
      return;
    }
    try {
      const result = await exec<{ step: string; acted: boolean }>(autoLoginStep(creds.email, creds.password));
      autoLoginStepCount = result.step === autoLoginStepSeen ? autoLoginStepCount + 1 : 1;
      autoLoginStepSeen = result.step;
      autoLoginActions += 1;
      const stuck = autoLoginStepCount > MAX_SAME_AUTO_LOGIN_STEP;
      if (!result.acted || result.step === 'other' || stuck) {
        setStatus('login'); // unrecognised page, or auto-login isn't making progress — let the user take over
        return;
      }
      // Acted on a step: a navigation is coming, stay hidden while it loads.
    } catch {
      setStatus('login');
    }
  },

  onMessage(e: WebViewMessageEvent) {
    let msg: { id: number; ok: boolean; value?: unknown; error?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.ok) p.resolve(msg.value);
    else p.reject(new Error(msg.error ?? 'Erreur inconnue.'));
  },

  /** Runs a page script once the inscription app is loaded and logged in. */
  run<T>(body: string): Promise<T> {
    return enqueue(async () => {
      await waitReady();
      return exec<T>(body);
    });
  },

  /**
   * Re-runs a read-only script until it returns non-null, surviving page navigations.
   * Never use it for scripts that click: a retry could submit twice.
   */
  async poll<T>(body: string, timeoutMs: number): Promise<T> {
    const end = Date.now() + timeoutMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Bounded even if the page never becomes ready again.
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Le site ne répond pas.')), timeoutMs);
    });
    deadline.catch(() => undefined);
    try {
      for (;;) {
        try {
          const v = await Promise.race([siteBridge.run<T | null>(body), deadline]);
          if (v !== null) return v;
        } catch (e) {
          if (Date.now() >= end) throw e;
        }
        if (Date.now() >= end) throw new Error('Le site ne répond pas.');
        await new Promise((r) => setTimeout(r, 500));
      }
    } finally {
      clearTimeout(timer);
    }
  },

  /** Clicks the site's "Déconnexion" and ends on the login screen, without auto-login. */
  logout(): Promise<void> {
    return enqueue(async () => {
      await waitReady();
      logoutRequested = true;
      autoLoginPaused = true;
      // The click navigates away, which may reject this call before its reply arrives.
      await exec<boolean>(CLICK_LOGOUT).catch(() => undefined);
    });
  },

  /** Navigates to the home page immediately, whatever state the page is in. */
  goHome() {
    resetAutoLogin();
    autoLoginPaused = false;
    setStatus('loading');
    webView?.injectJavaScript(`location.href = ${JSON.stringify(HOME_URL)}; true;`);
  },

  /** Full reload of the home page, e.g. to get a fresh registrations table. */
  reloadHome(): Promise<void> {
    return enqueue(async () => {
      await waitReady();
      siteBridge.goHome();
      await waitReady();
    });
  },
};
