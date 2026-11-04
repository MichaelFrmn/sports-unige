import type { WebView, WebViewMessageEvent } from 'react-native-webview';
import { HOME_URL, PAGE_HELPERS, PROBE } from './pageScripts';

// 'login' means the WebView is showing something other than the inscription
// app (Shibboleth login, an error page…) and the user has to deal with it.
export type SiteStatus = 'loading' | 'login' | 'ready';

type Pending = {
  resolve: (v: any) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const COMMAND_TIMEOUT_MS = 30000;

let webView: Pick<WebView, 'injectJavaScript'> | null = null;
let status: SiteStatus = 'loading';
const listeners = new Set<() => void>();
const pending = new Map<number, Pending>();
let nextId = 1;
let readyWaiters: (() => void)[] = [];
// ADF pages are stateful, so commands must never overlap.
let queue: Promise<unknown> = Promise.resolve();

function setStatus(s: SiteStatus) {
  if (s === status) return;
  status = s;
  if (s === 'ready') {
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
    try {
      const probe = await exec<{ url: string; app: boolean }>(PROBE);
      setStatus(probe.app ? 'ready' : 'login');
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

  /** Navigates to the home page immediately, whatever state the page is in. */
  goHome() {
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
