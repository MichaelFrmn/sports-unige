import { Registration, SignupForm, Slot, parsePrice, parseSiteDate } from '../types';
import { siteBridge } from '../site/bridge';
import {
  IS_HOME,
  LIST_SPORTS,
  READ_REGISTRATIONS,
  READ_SIGNUP_FORM,
  READ_SIGNUP_RESULT,
  READ_UNREGISTER_RESULT,
  SUBMIT_SIGNUP,
  searchSlots,
  startSignup,
  startUnregister,
} from '../site/pageScripts';

// The only module screens use to reach the UNIGE site. Everything goes through
// the logged-in WebView, so the site's own server stays authoritative.

/** The list/registration scripts need the home page; a past signup flow may have left us elsewhere. */
async function ensureHome() {
  if (!(await siteBridge.run<boolean>(IS_HOME))) await siteBridge.reloadHome();
}

export async function listSports(): Promise<string[]> {
  await ensureHome();
  return siteBridge.run<string[]>(LIST_SPORTS);
}

type RawSlot = { description: string; date: string; registered: boolean; bookable: boolean };

export async function listSlots(sport: string): Promise<Slot[]> {
  await ensureHome();
  const raw = await siteBridge.run<RawSlot[]>(searchSlots(sport));
  return raw.map((r) => {
    const date = parseSiteDate(r.date);
    return { ...r, sport, date, siteDate: r.date, id: `${sport}|${date}|${r.description}` };
  });
}

type RawRegistration = Omit<Registration, 'id' | 'price' | 'date' | 'siteDate'> & { price: string; date: string };

export async function listMyRegistrations(opts: { fresh?: boolean } = {}): Promise<Registration[]> {
  if (opts.fresh) await siteBridge.reloadHome();
  else await ensureHome();
  const raw = await siteBridge.run<RawRegistration[]>(READ_REGISTRATIONS);
  return raw.map((r) => {
    const date = parseSiteDate(r.date);
    return { ...r, date, siteDate: r.date, price: parsePrice(r.price), id: `${r.sport}|${date}|${r.description}` };
  });
}

// ---- Signup ---------------------------------------------------------------

export class SignupError extends Error {
  constructor(public code: 'FULL' | 'INVALID' | 'UNKNOWN', message: string) {
    super(message);
  }
}

const STEP_TIMEOUT_MS = 30000;

type FormPage =
  | ({ kind: 'form' } & Omit<SignupForm, 'priceChf'>)
  | { kind: 'full' | 'blocked'; text: string };

/**
 * Opens the site's signup form for a slot and returns its details. Nothing is booked yet.
 * A full slot is refused here already: the site shows "complet" instead of the form.
 */
export async function openSignup(slot: Slot): Promise<SignupForm> {
  await ensureHome();
  await siteBridge.run(startSignup(slot.sport, slot.description, slot.siteDate));
  const page = await siteBridge.poll<FormPage>(READ_SIGNUP_FORM, STEP_TIMEOUT_MS);
  if (page.kind !== 'form') {
    throw page.kind === 'full'
      ? new SignupError('FULL', page.text || 'Cette activité est complète.')
      : new SignupError('UNKNOWN', page.text || 'Inscription refusée par le site.');
  }
  const { kind: _kind, ...form } = page;
  return { ...form, priceChf: parsePrice(form.price) };
}

/** Leaves the signup form without booking. */
export function abortSignup(): Promise<void> {
  return siteBridge.reloadHome();
}

/**
 * Submits the open form ("Enregistrer"). The site decides: it may accept, or
 * answer that the slot is full. Returns the site's confirmation text.
 */
export async function submitSignup(): Promise<string> {
  let submitError: unknown = null;
  try {
    const r = await siteBridge.run<{ clicked: boolean; error?: string }>(SUBMIT_SIGNUP);
    if (!r.clicked) throw new SignupError('INVALID', r.error ?? 'Formulaire invalide.');
  } catch (e) {
    if (e instanceof SignupError) throw e;
    // The click may have gone through before the page navigated; check the outcome, never re-click.
    submitError = e;
  }

  let result: { kind: 'ok' | 'full' | 'invalid' | 'other'; text: string };
  try {
    result = await siteBridge.poll(READ_SIGNUP_RESULT, STEP_TIMEOUT_MS);
  } catch (e) {
    throw submitError ?? e;
  }
  await siteBridge.reloadHome();

  switch (result.kind) {
    case 'ok':
      return result.text;
    case 'full':
      throw new SignupError('FULL', result.text || 'Cette activité est complète.');
    case 'invalid':
      throw new SignupError('INVALID', result.text);
    default:
      throw new SignupError('UNKNOWN', result.text || 'Réponse inattendue du site.');
  }
}

// ---- Unregister ------------------------------------------------------------

type Target = { sport: string; description: string; siteDate: string };

/** Clicks "Se désinscrire" on the site for this registration. Returns the site's confirmation text. */
export async function unregister(target: Target): Promise<string> {
  // A fresh table, so the row we click is the one the server knows about.
  await siteBridge.reloadHome();

  let clickError: unknown = null;
  try {
    const r = await siteBridge.run<{ clicked: boolean; error?: string }>(
      startUnregister(target.sport, target.description, target.siteDate)
    );
    if (!r.clicked) throw new SignupError('INVALID', r.error ?? 'Désinscription impossible.');
  } catch (e) {
    if (e instanceof SignupError) throw e;
    // The click may have gone through before the page navigated; check the outcome, never re-click.
    clickError = e;
  }

  let result: { kind: 'ok' | 'other' | 'error'; text: string } | null = null;
  try {
    result = await siteBridge.poll(READ_UNREGISTER_RESULT, STEP_TIMEOUT_MS);
  } catch {
    // Unknown page: decide from the registrations table below.
  }
  await siteBridge.reloadHome();

  if (result?.kind === 'ok') return result.text;
  if (result?.kind === 'error') throw new SignupError('INVALID', result.text);

  const stillThere = (await listMyRegistrations()).some(
    (r) => r.sport === target.sport && r.description === target.description && r.siteDate === target.siteDate
  );
  if (!stillThere) return result?.text || 'Votre inscription a été annulée.';
  throw clickError instanceof Error
    ? clickError
    : new SignupError('UNKNOWN', result?.text || "Le site n'a pas confirmé la désinscription.");
}

/** Clicks the site's own "Déconnexion" link. Forces the next load to require a fresh login. */
export function logout(): Promise<void> {
  return siteBridge.logout();
}
