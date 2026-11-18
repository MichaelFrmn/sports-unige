import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  HOME_URL,
  IS_LOGOUT_CONFIRMATION,
  PAGE_HELPERS,
  PROBE,
  READ_WAYF_ORGANISATIONS,
  autoLoginStep,
  submitLoginCode,
  isWayf,
} from './pageScripts';
import { activeCredentials, forgetSession } from './credentials';
import { clearSessionCookies } from './sessionCookies';
import { ORGANISATIONS, Organisation } from './organisations';

// 'login' means the app needs credentials from the native login screen: none are
// available, auto-login is paused (after a logout), or the last attempt failed.
// 'code' means the site is waiting for the user's two-step code.
export type SiteStatus = 'loading' | 'login' | 'code' | 'ready';

export type LoginCodeRequest = { message: string; rememberLabel: string };

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const COMMAND_TIMEOUT_MS = 30000;
// Backstop on the pages handled in one login attempt. The real flow is about six:
// institution, e-mail, password and the automatic pages between them.
const MAX_AUTO_ACTIONS = 12;
// How long a login may sit on one page before it is reported as stuck.
const LOGIN_STALL_MS = 15000;

let webView: Pick<WebView, 'injectJavaScript'> | null = null;
let status: SiteStatus = 'loading';
const listeners = new Set<() => void>();
const pending = new Map<number, Pending>();
let nextId = 1;
let readyWaiters: (() => void)[] = [];
// ADF pages are stateful, so commands must never overlap.
let queue: Promise<unknown> = Promise.resolve();
// Steps already submitted in this attempt; none is ever submitted twice, so a refused
// password can't be retried into an account lockout.
let submittedSteps: string[] = [];
let autoLoginActions = 0;
let lastLoginPage: string | undefined;
let loginStallTimer: ReturnType<typeof setTimeout> | undefined;
let loginCodeRequest: LoginCodeRequest | null = null;
let loginCodeTried = false;
// Set by an explicit logout: show the login screen instead of logging straight back in.
let autoLoginPaused = false;
// Bumped on logout; SiteWebView remounts its WebView, starting from the cookies left.
let generation = 0;
// Set when a logout couldn't remove only the session cookies: the remount then wipes
// them all (incognito mode), including the remembered two-step login.
let wipeAllCookies = false;
// Why the last login attempt failed, shown on the native login screen.
let loginError: string | null = null;
// Read live from the site's institution picker; the bundled list until then.
let organisations: Organisation[] = ORGANISATIONS;
// Incremented on every page load, so async handlers can tell the page has since moved on.
let loadSeq = 0;

function resetAutoLogin() {
  submittedSteps = [];
  autoLoginActions = 0;
  lastLoginPage = undefined;
  loginCodeTried = false;
  clearTimeout(loginStallTimer);
}

function watchLoginStall() {
  clearTimeout(loginStallTimer);
  loginStallTimer = setTimeout(
    () => {
      // Waiting for the user's code is not a stall.
      if (status !== 'code') failLogin("La connexion n'avance plus. Dernière page :", lastLoginPage);
    },
    LOGIN_STALL_MS
  );
}

function setStatus(s: SiteStatus) {
  if (s === status) return;
  status = s;
  if (s === 'ready') {
    resetAutoLogin();
    autoLoginPaused = false;
    loginError = null;
    readyWaiters.forEach((w) => w());
    readyWaiters = [];
  }
  listeners.forEach((l) => l());
}

function failLogin(message: string, pageAlert?: string) {
  loginError = pageAlert ? `${message}
${pageAlert}` : message;
  clearTimeout(loginStallTimer);
  autoLoginPaused = true;
  forgetSession();
  status = 'login';
  listeners.forEach((l) => l());
}

const STEP_ERRORS: Record<string, string> = {
  wayf: "Le choix de l'organisation n'a pas abouti.",
  email: "L'e-mail n'a pas été accepté. La page affiche :",
  password: "Le mot de passe n'a pas été accepté. La page affiche :",
};

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
  getGeneration: () => generation,
  getWipeAllCookies: () => wipeAllCookies,
  getLoginError: () => loginError,
  getOrganisations: () => organisations,
  getLoginCodeRequest: () => loginCodeRequest,

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
    loadSeq += 1;
    // After a failed login or a logout, the login screen stays up whatever the page does,
    // and so does the code screen (the code page can report extra loads).
    if (!autoLoginPaused && status !== 'code') setStatus('loading');
    rejectAll('La page du site a changé pendant le chargement. Réessayez.');
  },

  // Not one call per page: on Android the WebView also reports history.pushState as a
  // new load (the password page calls it), so a page can arrive here more than once.
  // autoLoginStep handles each page only once.
  async onLoadEnd() {
    const seq = loadSeq;
    // The page navigated by itself while we were looking at it: the next onLoadEnd handles it.
    const moved = () => seq !== loadSeq;

    let probe: { url: string; app: boolean };
    try {
      probe = await exec<{ url: string; app: boolean }>(PROBE);
    } catch {
      if (!moved()) setStatus('login');
      return;
    }
    if (probe.app) {
      setStatus('ready');
      return;
    }

    if (autoLoginActions >= MAX_AUTO_ACTIONS) {
      failLogin("La connexion n'aboutit pas.");
      return;
    }

    try {
      if (await exec<boolean>(IS_LOGOUT_CONFIRMATION)) {
        autoLoginActions += 1;
        webView?.injectJavaScript(`location.href = ${JSON.stringify(HOME_URL)}; true;`);
        return; // stay hidden; the resulting navigation triggers another onLoadEnd
      }
    } catch {
      // Not that page (or the page errored) — fall through to normal handling.
    }
    if (moved()) return;

    if (isWayf(probe.url)) {
      try {
        const live = await exec<Organisation[]>(READ_WAYF_ORGANISATIONS);
        if (live.length) {
          organisations = live;
          listeners.forEach((l) => l());
        }
      } catch {
        // Keep the bundled list.
      }
    }
    if (moved()) return;

    const creds = autoLoginPaused ? null : await activeCredentials();
    if (moved()) return;
    if (!creds) {
      clearTimeout(loginStallTimer);
      setStatus('login');
      return;
    }

    watchLoginStall();
    let result: { step: string; acted: boolean; alert?: string; page?: string; rememberLabel?: string };
    try {
      result = await exec(autoLoginStep(creds, submittedSteps));
    } catch {
      if (!moved()) failLogin('La page de connexion ne répond pas.');
      return;
    }
    if (result.step === 'handled') return;

    autoLoginActions += 1;
    lastLoginPage = result.page;
    if (result.step === 'code') {
      loginCodeRequest = {
        message: result.alert || (loginCodeTried ? "Ce code n'a pas été accepté." : ''),
        rememberLabel: result.rememberLabel ?? '',
      };
      setStatus('code');
      return;
    }
    if (status === 'code') setStatus('loading');
    // Submitted, or an automatic page: either way the next page load carries on.
    if (result.acted || result.step === 'other') return;
    failLogin(STEP_ERRORS[result.step], result.alert || result.page);
  },

  onMessage(e: WebViewMessageEvent) {
    let msg: { id: number; ok: boolean; value?: unknown; error?: string; loginStep?: string };
    try {
      msg = JSON.parse(e.nativeEvent.data);
    } catch {
      return;
    }
    if (msg.loginStep) {
      submittedSteps.push(msg.loginStep);
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

  /** Starts a login with credentials from the native login screen. */
  login() {
    autoLoginPaused = false;
    loginError = null;
    siteBridge.goHome();
    watchLoginStall();
  },

  /** Enters the user's two-step code on the official page; it is never stored. */
  async submitLoginCode(code: string, remember: boolean) {
    loginCodeTried = true;
    setStatus('loading');
    watchLoginStall();
    try {
      if (!(await exec<boolean>(submitLoginCode(code, remember)))) {
        failLogin("Impossible d'envoyer le code. La page affiche :", lastLoginPage);
      }
    } catch {
      // The page moved on after the click: the next page load carries on.
    }
  },

  cancelLoginCode() {
    failLogin('Connexion annulée.');
  },

  /**
   * Removes the WebView's session cookies, remounts it and ends on the login screen with
   * auto-login paused. The site's own "Déconnexion" can't do this: it leaves the Switch
   * edu-ID session alive, so the next load signs straight back in. Cookies with an expiry
   * date stay, so the site can still remember this device for two-step login.
   */
  async logout() {
    resetAutoLogin();
    autoLoginPaused = true;
    loginError = null;
    forgetSession();
    rejectAll('Déconnecté.');
    status = 'loading';
    listeners.forEach((l) => l());
    wipeAllCookies = !(await clearSessionCookies());
    generation += 1;
    listeners.forEach((l) => l());
  },

  /** Navigates to the home page immediately, whatever state the page is in. */
  goHome() {
    resetAutoLogin();
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
