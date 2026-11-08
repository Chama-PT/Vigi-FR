/**
 * Contrôle qualité du site généré : `node tools/verify-site.mjs` (code de sortie 1 si une erreur est détectée).
 * Aucune dépendance : le HTML est produit par tools/generate-pages.mjs, donc son format est prévisible.
 *
 * Erreurs  = à corriger avant publication. Avertissements = à examiner, sans bloquer.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://vigi-fr.vercel.app/';
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);
const read = (p) => readFileSync(resolve(ROOT, p), 'utf8');

/* --- Pages HTML du site (hors dépôt technique) --- */
const SKIP_DIRS = new Set(['node_modules', 'tools', 'scripts', '.github', '.git', 'assets', 'data', 'seo']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name) && dir === ROOT) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith('.html')) out.push(relative(ROOT, full));
  }
  return out;
}
const files = walk(ROOT).filter((f) => !/^google[0-9a-f]+\.html$/.test(f));
const pathOf = (f) => (f === 'index.html' ? '/' : f === '404.html' ? '/404.html' : `/${f.replace(/index\.html$/, '')}`);
const pages = files.map((f) => ({ file: f, path: pathOf(f), html: read(f) }));
const indexable = pages.filter((p) => p.path !== '/404.html');

const textOf = (html) => html.replace(/<script[\s\S]*?<\/script>|<svg[\s\S]*?<\/svg>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const first = (re, s) => (s.match(re) || [])[1];
const entities = (s) => (s ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");

/* --- 1. Balises par page --- */
const titles = new Map(); const descs = new Map(); const h1s = new Map();
for (const p of indexable) {
  const { html, path } = p;
  const title = entities(first(/<title>([\s\S]*?)<\/title>/, html));
  const desc = entities(first(/<meta name="description" content="([^"]*)"/, html));
  const canonical = first(/<link rel="canonical" href="([^"]*)"/, html);
  const robots = first(/<meta name="robots" content="([^"]*)"/, html) ?? '';
  const h1 = [...html.matchAll(/<h1[\s>]/g)].length;
  const h1text = textOf(first(/<h1[^>]*>([\s\S]*?)<\/h1>/, html) ?? '');
  if (!title) err(`${path} : <title> manquant`);
  if (!desc) err(`${path} : meta description manquante`);
  if (canonical !== `${SITE}${path.replace(/^\//, '')}`) err(`${path} : canonical incorrect (${canonical})`);
  if (/noindex/.test(robots)) err(`${path} : page indexable marquée noindex`);
  if (!/<html lang="fr">/.test(html)) err(`${path} : attribut lang absent`);
  if (h1 !== 1) err(`${path} : ${h1} balises h1 (1 attendue)`);
  if (title.length > 80) warn(`${path} : title long (${title.length} car.)`);
  if (desc && (desc.length < 70 || desc.length > 175)) warn(`${path} : meta description de ${desc.length} caractères`);
  for (const [map, key, label] of [[titles, title, 'title'], [descs, desc, 'description'], [h1s, h1text, 'h1']]) {
    if (map.has(key)) err(`${label} dupliqué : « ${key.slice(0, 70)} » sur ${map.get(key)} et ${path}`); else map.set(key, path);
  }
  // Identifiants uniques (accessibilité, ancres)
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
  const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dup.length) err(`${path} : id dupliqués ${[...new Set(dup)].join(', ')}`);
  // Résidus de gabarit
  const visible = textOf(html);
  for (const bad of ['undefined', 'NaN', '[object', '${', 'null ']) if (visible.includes(bad)) err(`${path} : résidu « ${bad} » dans le texte`);
  // Images sans alternative (le site n'en utilise pas, mais toute régression doit être vue)
  for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\salt="/.test(m[0])) err(`${path} : <img> sans attribut alt`);
}

/* --- 2. Données structurées --- */
const typesByPage = {};
for (const p of indexable) {
  const blocks = [...p.html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => m[1]);
  if (!blocks.length) { err(`${p.path} : aucune donnée structurée`); continue; }
  for (const b of blocks) {
    let json;
    try { json = JSON.parse(b); } catch (e) { err(`${p.path} : JSON-LD invalide (${e.message})`); continue; }
    const nodes = json['@graph'] ?? [json];
    typesByPage[p.path] = nodes.map((n) => n['@type']);
    const ids = new Set(nodes.map((n) => n['@id']).filter(Boolean));
    for (const n of nodes) {
      if (n['@type'] === 'WebPage' || n['@type'] === 'AboutPage' || n['@type'] === 'CollectionPage') {
        if (n.url !== `${SITE}${p.path.replace(/^\//, '')}`) err(`${p.path} : WebPage.url incorrect (${n.url})`);
        if (n.breadcrumb && !ids.has(n.breadcrumb['@id'])) err(`${p.path} : breadcrumb référencé mais absent du graphe`);
      }
      if (n['@type'] === 'BreadcrumbList') {
        const last = n.itemListElement.at(-1);
        if (last.item !== `${SITE}${p.path.replace(/^\//, '')}`) err(`${p.path} : dernier élément du fil d’Ariane ≠ page courante`);
        n.itemListElement.forEach((it, i) => { if (it.position !== i + 1) err(`${p.path} : positions du fil d’Ariane incohérentes`); });
      }
      if (n['@type'] === 'FAQPage') {
        const visibleText = textOf(p.html);
        for (const q of n.mainEntity) if (!visibleText.includes(q.name)) err(`${p.path} : question FAQ non visible sur la page : ${q.name}`);
      }
      if (n['@type'] === 'Article' && (!n.datePublished || !n.dateModified || !n.headline)) err(`${p.path} : Article incomplet`);
      if (n['@type'] === 'Dataset') {
        for (const k of ['name', 'description', 'license', 'distribution', 'creator']) if (!n[k]) err(`${p.path} : Dataset sans ${k}`);
        for (const d of n.distribution ?? []) { const rel = d.contentUrl.replace(SITE, ''); if (!existsSync(resolve(ROOT, rel))) err(`${p.path} : distribution introuvable (${rel})`); }
      }
    }
    // Les références @id d'un nœud doivent exister dans le graphe, sauf Organization/WebSite (définis dans chaque graphe).
  }
}

/* --- 3. Liens internes et pages orphelines --- */
const exists = (href) => {
  const clean = href.split('#')[0].split('?')[0];
  if (clean === '' || clean === '/') return true;
  const f = resolve(ROOT, `.${clean}`);
  if (existsSync(f) && statSync(f).isFile()) return true;
  return existsSync(resolve(f, 'index.html'));
};
const links = new Map(); // chemin → Set(chemins liés)
const idsByPath = new Map(pages.map((p) => [p.path, new Set([...p.html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))]));
for (const p of pages) {
  const set = new Set();
  for (const m of p.html.matchAll(/<a\b[^>]*\shref="([^"]+)"/g)) {
    const href = entities(m[1]);
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    if (!exists(href)) { err(`${p.path} : lien interne cassé → ${href}`); continue; }
    const [pathname, hash] = href.split('#');
    const target = pathname === '' ? '/' : pathname;
    if (hash && idsByPath.has(target) && !idsByPath.get(target).has(hash)) err(`${p.path} : ancre introuvable → ${href}`);
    if (!/\.(json|xml|txt|png|svg|ico|webmanifest)$/.test(pathname)) set.add(target.endsWith('/') ? target : `${target}/`);
  }
  links.set(p.path, set);
}
const reachable = new Set(['/']); const queue = ['/'];
while (queue.length) { for (const t of links.get(queue.shift()) ?? []) if (!reachable.has(t) && links.has(t)) { reachable.add(t); queue.push(t); } }
for (const p of indexable) if (!reachable.has(p.path)) err(`${p.path} : page orpheline (aucun lien interne depuis l’accueil)`);
const inbound = new Map(indexable.map((p) => [p.path, 0]));
for (const set of links.values()) for (const t of set) if (inbound.has(t)) inbound.set(t, inbound.get(t) + 1);
const weak = [...inbound].filter(([, n]) => n < 3).map(([p]) => p);
if (weak.length) warn(`${weak.length} pages avec moins de 3 liens entrants : ${weak.slice(0, 5).join(', ')}…`);

/* --- 4. Sitemap, robots, llms.txt --- */
const sitemap = read('sitemap.xml');
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
for (const l of locs) if (!l.startsWith(SITE) || !exists(l.replace(SITE, '/'))) err(`sitemap : URL inexistante ${l}`);
if (new Set(locs).size !== locs.length) err('sitemap : URL en double');
for (const p of indexable) if (!locs.includes(`${SITE}${p.path.replace(/^\//, '')}`)) err(`sitemap : page absente ${p.path}`);
for (const m of sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)) if (!/^\d{4}-\d{2}-\d{2}$/.test(m[1])) err(`sitemap : lastmod invalide ${m[1]}`);
const robots = read('robots.txt');
if (!robots.includes(`Sitemap: ${SITE}sitemap.xml`)) err('robots.txt : ligne Sitemap absente');
if (/^Disallow:\s*\S/m.test(robots)) err('robots.txt : une règle Disallow bloque des chemins (à vérifier)');
const llms = read('llms.txt');
for (const m of llms.matchAll(/\]\((https:\/\/vigi-fr\.vercel\.app[^)]*)\)/g)) if (!exists(m[1].replace(SITE.slice(0, -1), ''))) err(`llms.txt : lien inexistant ${m[1]}`);
const key = [...(read('tools/generate-pages.mjs').match(/INDEXNOW_KEY = '([0-9a-f]{32})'/) ?? [])][1];
if (!key || !existsSync(resolve(ROOT, `${key}.txt`)) || read(`${key}.txt`).trim() !== key) err('IndexNow : fichier clé absent ou invalide');
const vercel = JSON.parse(read('vercel.json'));
if (!vercel.headers?.some((h) => h.source === '/(.*)' && h.headers.some((x) => x.key === 'Content-Security-Policy'))) err('vercel.json : CSP absente');
for (const i of JSON.parse(read('manifest.webmanifest')).icons) if (!exists(i.src)) err(`manifest : icône absente ${i.src}`);

/* --- 5. Données pré-rendues et cohérence avec data/fwi.json --- */
let data = null;
try { data = JSON.parse(read('data/fwi.json')); } catch { warn('data/fwi.json absent ou invalide : les pages sont générées sans chiffres'); }
const depts = JSON.parse(read('assets/data/departements.json'));
const deptPages = indexable.filter((p) => p.path.startsWith('/departement/'));
if (deptPages.length !== depts.length) err(`${deptPages.length} pages département pour ${depts.length} départements`);
if (data) {
  for (const p of [...deptPages, ...indexable.filter((x) => x.path === '/')]) {
    const snap = first(/data-snap="([^"]+)"/, p.html);
    if (snap !== data.fileDate) err(`${p.path} : synthèse pré-rendue (${snap}) différente de data/fwi.json (${data.fileDate}) : régénérer les pages`);
  }
}

/* --- 6. Unicité du contenu des pages département --- */
const sentences = (html) => {
  const main = first(/<main id="contenu">([\s\S]*?)<\/main>/, html) ?? '';
  return textOf(main).split(/(?<=[.!?])\s+/).map((s) => s.toLowerCase().replace(/\d+([.,]\d+)?/g, '#').trim()).filter((s) => s.length > 25);
};
const sets = deptPages.map((p) => ({ p, s: new Set(sentences(p.html)) }));
const freq = new Map(); for (const { s } of sets) for (const x of s) freq.set(x, (freq.get(x) ?? 0) + 1);
// Une phrase est « propre » à la page si elle n’apparaît (hors nombres) que sur très peu de pages ; les noms de départements la rendent presque toujours unique.
const unique = sets.map(({ p, s }) => ({ path: p.path, total: s.size, own: [...s].filter((x) => freq.get(x) <= 3).length }));
const ratio = unique.map((u) => u.own / u.total);
const minRatio = Math.min(...ratio); const avgRatio = ratio.reduce((a, b) => a + b, 0) / ratio.length;
if (minRatio < 0.2) warn(`part de phrases propres à la page très faible sur certaines fiches (min ${(minRatio * 100).toFixed(0)} %)`);
const words = deptPages.map((p) => textOf(first(/<main id="contenu">([\s\S]*?)<\/main>/, p.html) ?? '').split(' ').length);

/* --- Rapport --- */
const stats = {
  pages: pages.length, indexables: indexable.length, departements: deptPages.length,
  urlsSitemap: locs.length, titresUniques: titles.size, descriptionsUniques: descs.size,
  motsParFicheDepartement: { min: Math.min(...words), moyenne: Math.round(words.reduce((a, b) => a + b, 0) / words.length), max: Math.max(...words) },
  phrasesPropresParFiche: { moyenne: `${(avgRatio * 100).toFixed(0)} %`, min: `${(minRatio * 100).toFixed(0)} %` },
  typesJsonLdAccueil: typesByPage['/'], typesJsonLdFicheDepartement: typesByPage[deptPages[0]?.path],
};
console.log(JSON.stringify(stats, null, 2));
for (const w of warnings) console.log(`AVERTISSEMENT  ${w}`);
for (const e of errors) console.log(`ERREUR         ${e}`);
console.log(`\n${errors.length ? 'ÉCHEC' : 'OK'} : ${errors.length} erreur(s), ${warnings.length} avertissement(s).`);
process.exit(errors.length ? 1 : 0);
