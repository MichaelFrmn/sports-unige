export interface Slot {
  id: string;
  sport: string;
  description: string; // e.g. "Mercredi 20:30 à 21:45 - intermédiaire/avancé"
  date: string; // YYYY-MM-DD
  siteDate: string; // as shown on the site ("05.11.2026"), used to find the row again
  registered: boolean;
  bookable: boolean;
}

/** Details shown on the site's signup form, before "Enregistrer". */
export interface SignupForm {
  sport: string;
  information: string;
  description: string;
  startDate: string;
  endDate: string;
  location: string;
  price: string; // as shown, e.g. "SFr. 0.00"
  priceChf: number;
  teacher: string;
  window: string; // e.g. "Du 28.10.2026 22:00:00 au 04.11.2026 20:30:00"
  phone: string;
}

export interface Registration {
  id: string;
  sport: string;
  description: string;
  date: string; // YYYY-MM-DD
  siteDate: string; // as shown on the site, used to find the row again
  status: string; // e.g. "Payé"
  paidAt: string;
  price: number; // CHF
  location: string;
  level: string;
  teacher: string;
  cancellable: boolean;
}

/** "05.11.2026" → "2026-11-05" */
export function parseSiteDate(s: string): string {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(s);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : s;
}

/** "SFr. 3.00" → 3 */
export function parsePrice(s: string): number {
  const n = parseFloat(s.replace(/[^\d.]/g, ''));
  return Number.isNaN(n) ? 0 : n;
}

export function formatDay(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('fr-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function localIsoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function isPast(isoDate: string, now = new Date()): boolean {
  return isoDate < localIsoDate(now);
}

/** "Aujourd'hui" / "Demain", or null for other dates. */
export function relativeDay(isoDate: string, now = new Date()): string | null {
  if (isoDate === localIsoDate(now)) return "Aujourd'hui";
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return isoDate === localIsoDate(tomorrow) ? 'Demain' : null;
}
