// Parses slot descriptions like "Lundi 17:45 à 18:45 - intermédiaire/avancé - femmes*".
// Organisers sometimes write free text instead; then only `raw` is meaningful.

export type Level = 0 | 1 | 2; // débutant, intermédiaire, avancé

export interface ParsedDescription {
  raw: string;
  day?: string; // "lundi"
  start?: string; // "17:45"
  end?: string; // "18:45"
  durationMin?: number;
  levels: Level[]; // sorted, unique
  allLevels: boolean;
  tags: string[]; // remaining info, e.g. "femmes*"
}

const DAYS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const TIME = String.raw`(\d{1,2})\s*[:hH.]\s*(\d{2})`;
const SLOT_RE = new RegExp(
  String.raw`^\s*(?:(${DAYS.join('|')})\s+)?${TIME}\s*(?:à|a|-|–|—)\s*${TIME}\s*(?:[-–—:,]\s*)?(.*)$`,
  'i'
);

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

function levelOf(part: string): Level | 'all' | null {
  const f = fold(part);
  if (/^tous( les)? niveaux?$/.test(f)) return 'all';
  if (/^(debutants?|initiation)$/.test(f)) return 0;
  if (/^intermediaires?$/.test(f)) return 1;
  if (/^(avances?|confirmes?|experts?)$/.test(f)) return 2;
  return null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function parseDescription(raw: string): ParsedDescription {
  const result: ParsedDescription = { raw, levels: [], allLevels: false, tags: [] };
  const m = SLOT_RE.exec(raw);
  if (!m) return result;

  const [, day, sh, sm, eh, em, rest] = m;
  const startMin = +sh * 60 + +sm;
  const endMin = +eh * 60 + +em;
  if (+sh > 23 || +eh > 23 || +sm > 59 || +em > 59) return result;

  result.day = day?.toLowerCase();
  result.start = `${pad(+sh)}:${sm}`;
  result.end = `${pad(+eh)}:${em}`;
  result.durationMin = endMin > startMin ? endMin - startMin : endMin + 24 * 60 - startMin;

  const levels = new Set<Level>();
  for (const part of (rest ?? '').split(/\s*[\/,;]\s*|\s+[-–—]\s+/)) {
    const p = part.trim().replace(/^[-–—]\s*/, '');
    if (!p) continue;
    const lvl = levelOf(p);
    if (lvl === 'all') result.allLevels = true;
    else if (lvl !== null) levels.add(lvl);
    else result.tags.push(p.charAt(0).toUpperCase() + p.slice(1));
  }
  result.levels = [...levels].sort();
  return result;
}

export function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${pad(m)}`;
}

/**
 * How many of the 3 level dots to fill (1, 1.5, 2, 2.5 or 3), or null when there's no
 * requirement. A range between two adjacent levels fills the lower one and half of the higher.
 */
export function levelFill(p: ParsedDescription): number | null {
  if (p.allLevels || p.levels.length === 0) return null;
  const min = p.levels[0];
  const max = p.levels[p.levels.length - 1];
  if (max - min >= 2) return null; // débutant → avancé: everyone is welcome
  return max === min ? min + 1 : min + 1.5;
}
