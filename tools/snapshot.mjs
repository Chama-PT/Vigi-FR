/**
 * Instantané des données (data/fwi.json) utilisé à la génération pour pré-rendre dans le HTML
 * ce que le navigateur affiche ensuite via JavaScript. Les robots qui n'exécutent pas JavaScript
 * (la plupart des robots d'assistants IA) voient ainsi les mêmes niveaux que les visiteurs.
 *
 * Règles de validation identiques à getData() dans assets/js/lib.js. Aucune valeur n'est inventée :
 * si le fichier est absent ou invalide, `snap.ok` vaut false et les pages sont générées sans chiffres.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { reading, ranked } from '../assets/js/lib.js';

const isLevel = (v) => v === null || v === undefined || (Number.isInteger(v) && v >= 1 && v <= 4);

export function loadSnapshot(root) {
  const empty = { ok: false, fileDate: null, dataDate: null, schemaVersion: null, byCode: new Map(), days: [], defaultDay: null, count: 0 };
  let json;
  try { json = JSON.parse(readFileSync(resolve(root, 'data/fwi.json'), 'utf8')); } catch { return empty; }
  if (!json || !Array.isArray(json.departments)) return empty;

  const byCode = new Map();
  for (const d of json.departments) {
    if (!d || typeof d.code !== 'string' || typeof d.name !== 'string') continue;
    if (![d.j0, d.j1, d.j2].every(isLevel)) continue;
    byCode.set(d.code, d);
  }
  const days = [0, 1, 2].filter((k) => [...byCode.values()].some((d) => Number.isInteger(d[`j${k}`])));
  if (!days.length || typeof json.fileDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(json.dataDate ?? '')) return empty;
  return {
    ok: true,
    fileDate: json.fileDate,
    dataDate: json.dataDate,
    schemaVersion: json.schemaVersion ?? null,
    byCode,
    days,
    // Même choix que le navigateur : J0 s'il existe, sinon J+1, sinon la première échéance.
    defaultDay: days.includes(0) ? 0 : days.includes(1) ? 1 : days[0],
    count: byCode.size,
  };
}

/** Nombre de départements par niveau pour une échéance. */
export function countsFor(snap, k) {
  const counts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let total = 0;
  for (const d of snap.byCode.values()) {
    const { level } = reading(d, k);
    if (level) { counts[level] += 1; total += 1; }
  }
  const max = [4, 3, 2, 1].find((l) => counts[l] > 0) ?? null;
  return { counts, total, max };
}

/**
 * Position d'un département parmi les autres pour l'indice FWI d'une échéance.
 * « plus élevé » / « plus faible » sont comptés strictement : les ex æquo (nombreux quand l'indice vaut 0) ne créent pas de faux classement.
 */
export function compareFwi(snap, code, k) {
  const me = reading(snap.byCode.get(code), k);
  if (me.fwi === null) return null;
  let higher = 0;
  let lower = 0;
  let total = 0;
  for (const [c, d] of snap.byCode) {
    if (c === code) continue;
    const r = reading(d, k);
    if (r.fwi === null) continue;
    total += 1;
    if (r.fwi > me.fwi) higher += 1;
    else if (r.fwi < me.fwi) lower += 1;
  }
  return { higher, lower, same: total - higher - lower, others: total };
}

export { ranked, reading };
