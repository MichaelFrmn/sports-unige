import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  HOME_URL,
  IS_LOGOUT_CONFIRMATION,
  PAGE_HELPERS,
  PROBE,
  READ_WAYF_ORGANISATIONS,
  autoLoginStep,
  isWayf,
  loginUrlFor,
} from './pageScripts';
import { activeCredentials, forgetSession } from './credentials';
import { ORGANISATIONS, Organisation } from './organisations';

// 'login' means the app needs credentials from the native login screen: none are
// available, auto-login is paused (after a logout), or the last attempt failed.
export type SiteStatus = 'loading' | 'login' | 'ready';

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const COMMAND_TIMEOUT_MS = 30000;
// Landing on the same step again means the previous submit was refused (e.g. a wrong
// password): report it instead of resubmitting.
const MAX_SAME_AUTO_LOGIN_STEP = 1;
// Backstop across the whole auto-login/bounce sequence, regardless of pattern —
// an alternating loop (e.g. password page -> logout-confirmation page -> password
// page -> ...) would never repeat the same step twice in a row, so it would never
// trip MAX_SAME_AUTO_LOGIN_STEP on its own and could otherwise retry forever,
// reloading real pages on the site with no delay between attempts. The real flow
// is institution -> e-mail -> password (3 steps), so this leaves headroom without
// allowing a loop.
const MAX_AUTO_ACTIONS = 6;
// After filling and submitting a page, how long to wait for it to navigate.
const SUBMIT_TIMEOUT_MS = 12000;

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
let autoLoginPaused = false;
// Bumped on logout; SiteWebView remounts its WebView in incognito mode, which on
// Android wipes every cookie (UNIGE and Switch edu-ID sessions alike).
let generation = 0;
// Why the last login attempt failed, shown on the native login screen.
let loginError: string | null = null;
// Read live from the site's institution picker; the bundled list until then.
let organisations: Organisation[] = ORGANISATIONS;
// Incremented on every page load, so async handlers can tell the page has since moved on.
let loadSeq = 0;
// The load we last acted on. Android can report the same page load as finished twice;
// acting on it again would look like the site sent us back (e.g. "wrong password").
let actedSeq = -1;

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
  autoLoginPaused = true;
  forgetSession();
  status = 'login';
  listeners.forEach((l) => l());
}

/** Counts consecutive visits to the same step; true when it came back (previous submit refused). */
function repeatedStep(step: string): boolean {
  autoLoginStepCount = step === autoLoginStepSeen ? autoLoginStepCount + 1 : 1;
  autoLoginStepSeen = step;
  autoLoginActions += 1;
  return autoLoginStepCount > MAX_SAME_AUTO_LOGIN_STEP;
}

const STEP_ERRORS: Record<string, string> = {
  wayf: "Le site est revenu au choix de l'organisation.",
  email: 'La page de connexion a refusé l’e-mail. Elle affiche :',
  password: 'La page de connexion est revenue après l’envoi du mot de passe (refusé ?). Elle affiche :',
  other: 'Page de connexion non reconnue (par ex. double authentification). Elle affiche :',
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
  getLoginError: () => loginError,
  getOrganisations: () => organisations,

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
    setStatus('loading');
    rejectAll('La page du site a changé pendant le chargement. Réessayez.');
  },

  async onLoadEnd() {
    const seq = loadSeq;
    if (seq === actedSeq) return;
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
        actedSeq = seq;
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
      setStatus('login');
      return;
    }

    if (isWayf(probe.url)) {
      if (!organisations.some((o) => o.entityId === creds.organisation)) {
        failLogin('Organisation non proposée par le site.');
        return;
      }
      if (repeatedStep('wayf')) {
        failLogin(STEP_ERRORS.wayf);
        return;
      }
      actedSeq = seq;
      webView?.injectJavaScript(`location.href = ${JSON.stringify(loginUrlFor(creds.organisation))}; true;`);
      return;
    }

    let result: { step: string; acted: boolean; alert?: string; page?: string };
    try {
      result = await exec(autoLoginStep(creds.email, creds.password));
    } catch {
      if (!moved()) failLogin('La page de connexion ne répond pas.');
      return;
    }

    // What to show the user if this step fails: the page's error message, else what it shows.
    const detail = result.alert || result.page;

    if (repeatedStep(result.step) || !result.acted || result.step === 'other') {
      failLogin(STEP_ERRORS[result.step] ?? STEP_ERRORS.other, detail);
      return;
    }

    // It filled and submitted the page: a navigation should follow. If it doesn't, say so
    // instead of leaving the user on "Connexion en cours…" forever.
    actedSeq = seq;
    setTimeout(() => {
      if (!moved()) failLogin("La page de connexion n'a pas réagi à l'envoi.", result.page);
    }, SUBMIT_TIMEOUT_MS);
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

  /** Starts a login with credentials from the native login screen. */
  login() {
    autoLoginPaused = false;
    loginError = null;
    siteBridge.goHome();
  },

  /**
   * Wipes the WebView's cookies (via a remount in incognito mode) and ends on the
   * login screen with auto-login paused. The site's own "Déconnexion" can't do this:
   * it leaves the Switch edu-ID session alive, so the next load signs straight back in.
   */
  logout() {
    resetAutoLogin();
    autoLoginPaused = true;
    loginError = null;
    forgetSession();
    rejectAll('Déconnecté.');
    generation += 1;
    status = 'loading';
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
