/**
 * Signale à IndexNow (Bing, Yandex, etc.) les pages modifiées. Google n'utilise pas IndexNow : il découvre les changements via le sitemap.
 *
 * Usage : node scripts/indexnow.js <fichier-liste>   (une chemin de fichier par ligne, ex. « departement/ain-01/index.html »)
 *         node scripts/indexnow.js --all              (toutes les pages du sitemap)
 *
 * La clé est le nom du fichier <32 caractères hexadécimaux>.txt à la racine du site : elle est publique par conception.
 * Ce script ne lève jamais d'erreur bloquante : un échec de signalement n'empêche pas la publication.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://vigi-fr.vercel.app/';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS = 10000;

const keyFile = readdirSync(ROOT).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) { console.log('IndexNow : aucun fichier clé à la racine, rien à signaler.'); process.exit(0); }
const key = keyFile.replace('.txt', '');

const toUrl = (file) => {
  if (file === 'index.html') return SITE;
  const m = file.match(/^((?:departement|region|guide|donnees|methodologie|a-propos)(?:\/[^/]+)*)\/index\.html$/);
  return m ? `${SITE}${m[1]}/` : null;
};

let urls;
if (process.argv[2] === '--all') {
  urls = [...readFileSync(resolve(ROOT, 'sitemap.xml'), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
} else if (process.argv[2]) {
  urls = [...new Set(readFileSync(process.argv[2], 'utf8').split('\n').map((l) => l.trim()).filter(Boolean).map(toUrl).filter(Boolean))];
} else {
  console.log('Usage : node scripts/indexnow.js <fichier-liste> | --all'); process.exit(0);
}
urls = urls.slice(0, MAX_URLS);
if (!urls.length) { console.log('IndexNow : aucune page indexable modifiée, rien à signaler.'); process.exit(0); }

try {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ host: new URL(SITE).host, key, keyLocation: `${SITE}${keyFile}`, urlList: urls }),
  });
  // 200 : accepté ; 202 : reçu, validation de la clé en attente ; 4xx : requête ou clé refusée.
  console.log(`IndexNow : ${urls.length} URL signalées, réponse HTTP ${res.status}.`);
} catch (error) {
  console.log(`IndexNow : signalement impossible (${error.message}). Sans conséquence pour le site.`);
}
