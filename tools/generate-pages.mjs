#!/usr/bin/env node
/**
 * Outil facultatif (déjà exécuté, les pages générées sont dans le dépôt) : écrit les pages HTML statiques.
 * Vous n'avez pas besoin de le lancer pour déployer ni pour la mise à jour quotidienne des données,
 * qui ne touche que data/fwi.json. Il sert seulement si vous modifiez le gabarit des pages.
 *
 * Usage : node tools/generate-pages.mjs          (depuis la racine du dépôt)
 *         SITE_URL=https://exemple.fr/ node tools/generate-pages.mjs
 * Entrées : tools/out/depts.json (noms, régions, préfectures), tools/out/map.json (fond de carte, voisinage).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, THRESHOLDS, DAYS, fmt, reading, trend, dayDate, formatDateTime } from '../assets/js/lib.js';
import { ADVICE, adviceFor, FACTORS, MEANING } from '../assets/js/content.js';
import { CHEF_LIEU } from '../scripts/fetch-data.js';
import { LOC, REGION_LOC, regionSlug, cap } from './editorial.mjs';
import { loadSnapshot, countsFor, compareFwi, ranked } from './snapshot.mjs';
import { buildGuides, GUIDE_DATES } from './guides.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.SITE_URL ?? 'https://vigi-fr.vercel.app/').replace(/\/?$/, '/');
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), 'utf8'));
const OUT = new Map();
const write = (p, content) => { OUT.set(p, content); };
const flush = () => { for (const [p, content] of OUT) { const f = resolve(ROOT, p); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, content, 'utf8'); } };

const depts = read('tools/out/depts.json');
const map = read('tools/out/map.json');
const ORDER_KEY = (c) => (c === '2A' ? 19.1 : c === '2B' ? 19.2 : Number(c));
depts.sort((a, b) => ORDER_KEY(a.code) - ORDER_KEY(b.code));
const byCode = new Map(depts.map((d) => [d.code, d]));
const url = (d) => `/departement/${d.slug}/`;
const snap = loadSnapshot(ROOT);
const regionNames = [...new Set(depts.map((d) => d.region))].sort((a, b) => a.localeCompare(b, 'fr'));
const regionUrl = (name) => `/region/${regionSlug(name)}/`;
const GITHUB = 'https://github.com/Chama-PT/Vigi-FR/';
const ISSUES = `${GITHUB}issues`;
// Dates des pages éditoriales : modifiées à la main quand le contenu change (jamais « maintenant »), pour que la génération reste déterministe.
const PAGE_DATES = { methodologie: '2026-11-07', apropos: '2026-11-08', donnees: '2026-11-07', guides: GUIDE_DATES.modified, legal: '2026-11-08' };
const frDate = (iso) => new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fr = (n) => String(n).replace('.', ',');

/* ------------------------------------------------------------------ */
/* Éléments communs                                                     */
/* ------------------------------------------------------------------ */
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'; object-src 'none'";
const CSP_HEADER = `${CSP}; frame-ancestors 'none'`;
const OG_ALT = 'Vigi-FR : risque d’incendie de forêt par département en France métropolitaine';

const SPRITE = readFileSync(resolve(ROOT, 'tools/sprite.html'), 'utf8').trim();

const ic = (name, cls = '') => `<svg class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true" focusable="false"><use href="#icon-${name}"/></svg>`;

const NAV = [
  { href: '/', label: 'Accueil', id: 'home' },
  { href: '/#carte', label: 'Carte', id: 'carte' },
  { href: '/#departements', label: 'Départements', id: 'depts' },
  { href: '/guide/', label: 'Guides', id: 'guides' },
  { href: '/methodologie/', label: 'Méthodologie', id: 'methodologie' },
  { href: '/a-propos/', label: 'À propos', id: 'apropos' },
];

// Sites officiels cités en sources : le navigateur peut résoudre leur nom à l’avance (aucune connexion n’est ouverte avant un clic).
const PREFETCH_HOSTS = ['www.ecologie.gouv.fr', 'effis.jrc.ec.europa.eu', 'vigilance.meteofrance.fr', 'open-meteo.com'];

const ROBOTS_INDEX = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

function head({ title, description, path, robots = ROBOTS_INDEX, jsonld = null, scripts = [], ogType = 'website', published = null, modified = null }) {
  const canonical = `${SITE}${path.replace(/^\//, '')}`;
  const image = `${SITE}assets/img/og-image.png`;
  const modules = ['lib.js', ...(scripts.includes('home.js') || scripts.includes('dept.js') ? ['content.js'] : [])];
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${CSP}">
  <meta name="referrer" content="no-referrer">
  <meta name="color-scheme" content="dark">
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="robots" content="${robots}">
${robots.startsWith('noindex') ? '' : `  <link rel="canonical" href="${canonical}">
  <link rel="alternate" hreflang="fr-FR" href="${canonical}">
  <link rel="alternate" hreflang="x-default" href="${canonical}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:site_name" content="Vigi-FR">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${canonical}">
  <meta property="og:image" content="${image}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${esc(OG_ALT)}">
${ogType === 'article' && published ? `  <meta property="article:published_time" content="${published}">\n` : ''}${ogType === 'article' && modified ? `  <meta property="article:modified_time" content="${modified}">\n` : ''}  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${image}">
`}  <meta name="theme-color" content="#0B0A08">
  <link rel="icon" href="/favicon.ico" sizes="32x32">
  <link rel="icon" href="/assets/img/favicon.svg" type="image/svg+xml">
  <link rel="icon" href="/assets/img/icon-192.png" type="image/png" sizes="192x192">
  <link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
  <link rel="manifest" href="/manifest.webmanifest">
  <link rel="alternate" type="application/atom+xml" title="Vigi-FR : situation quotidienne et guides" href="/feed.xml">
${PREFETCH_HOSTS.map((h) => `  <link rel="dns-prefetch" href="//${h}">`).join('\n')}
  <link rel="preload" href="/assets/fonts/InstrumentSerif-Regular.woff2" as="font" type="font/woff2" crossorigin>
  <link rel="preload" href="/assets/fonts/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
${modules.map((m) => `  <link rel="modulepreload" href="/assets/js/${m}">`).join('\n')}
${jsonld ? `  <script type="application/ld+json">${JSON.stringify(jsonld)}</script>\n` : ''}  <link rel="stylesheet" href="/assets/css/styles.css">
  <script type="module" src="/assets/js/site.js"></script>
${scripts.map((s) => `  <script type="module" src="/assets/js/${s}"></script>`).join('\n')}
</head>`;
}

/* ------------------------------------------------------------------ */
/* Données structurées (schema.org) : uniquement ce qui est visible et vérifiable sur la page. */
/* ------------------------------------------------------------------ */
const ORG_ID = `${SITE}#organization`;
const WEBSITE_ID = `${SITE}#website`;
const ORG = {
  '@type': 'Organization', '@id': ORG_ID, name: 'Vigi-FR', url: SITE,
  logo: { '@type': 'ImageObject', url: `${SITE}assets/img/icon-512.png`, width: 512, height: 512 },
  description: 'Site indépendant et open source qui publie le niveau de risque d’incendie de forêt des départements de France métropolitaine, calculé chaque jour avec l’indice forêt-météo.',
  sameAs: [GITHUB],
};
const WEBSITE = { '@type': 'WebSite', '@id': WEBSITE_ID, url: SITE, name: 'Vigi-FR', inLanguage: 'fr-FR', description: 'Risque d’incendie de forêt par département en France métropolitaine, calculé à partir de prévisions météo (indice FWI).', publisher: { '@id': ORG_ID } };

/** Fil d’Ariane : items = [[nom, chemin], …] ; le dernier est la page courante. */
const breadcrumb = (pagePath, items) => ({
  '@type': 'BreadcrumbList', '@id': `${SITE}${pagePath.replace(/^\//, '')}#breadcrumb`,
  itemListElement: items.map(([name, p], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE}${p.replace(/^\//, '')}` })),
});
/** Nœud de page : type WebPage (ou sous-type), rattaché au site et au fil d’Ariane. */
const webPage = ({ path, title, description, type = 'WebPage', modified = null, crumbs = true, extra = {} }) => ({
  '@type': type, '@id': `${SITE}${path.replace(/^\//, '')}#page`, url: `${SITE}${path.replace(/^\//, '')}`, name: title, description,
  inLanguage: 'fr-FR', isPartOf: { '@id': WEBSITE_ID }, ...(crumbs ? { breadcrumb: { '@id': `${SITE}${path.replace(/^\//, '')}#breadcrumb` } } : {}),
  ...(modified ? { dateModified: modified } : {}), ...extra,
});
const graph = (...nodes) => ({ '@context': 'https://schema.org', '@graph': [ORG, WEBSITE, ...nodes.flat().filter(Boolean)] });
/** Texte brut d’un fragment HTML (pour FAQPage) : retire les balises et le texte réservé aux lecteurs d’écran. */
const plain = (html) => html.replace(/<span class="sr-only">.*?<\/span>/g, '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();

function header(active) {
  const link = (n, mobile) => `<li><a href="${n.href}"${n.id === active ? ' aria-current="page"' : ''}>${esc(n.label)}${mobile ? ic('arrow') : ''}</a></li>`;
  return `  ${SPRITE}
  <a class="skip-link" href="#contenu">Aller au contenu</a>
  <header class="site-header">
    <div class="container site-header__inner">
      <a class="brand" href="/" aria-label="Vigi-FR, accueil"><svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 64 64"><use href="#icon-flame"/></svg><span>Vigi-<em>FR</em></span></a>
      <nav class="nav" aria-label="Navigation principale">${NAV.map((n) => `<a href="${n.href}"${n.id === active ? ' aria-current="page"' : ''}>${esc(n.label)}</a>`).join('')}</nav>
      <button type="button" class="search-trigger" data-open-search aria-haspopup="dialog" aria-label="Rechercher un département">${ic('search')}<span class="search-trigger__label">Rechercher un département</span><kbd aria-hidden="true">/</kbd></button>
      <a class="btn btn--primary btn--sm header-cta" href="/#carte">Voir la carte nationale ${ic('arrow', 'icon--arrow')}</a>
      <button type="button" class="menu-btn" id="menu-btn" aria-expanded="false" aria-controls="mobile-nav" aria-label="Ouvrir le menu">${ic('menu')}</button>
    </div>
    <div class="mobile-nav" id="mobile-nav" hidden>
      <div class="container">
        <ul>${NAV.map((n) => link(n, true)).join('')}</ul>
        <a class="btn btn--primary" href="/#carte">Voir la carte nationale ${ic('arrow', 'icon--arrow')}</a>
      </div>
    </div>
  </header>`;
}

const SUD = ['gironde-33', 'landes-40', 'herault-34', 'gard-30', 'var-83', 'bouches-du-rhone-13', 'alpes-maritimes-06', 'corse-du-sud-2a'];

function footer() {
  const sud = SUD.map((s) => depts.find((d) => d.slug === s)).filter(Boolean);
  return `  <footer class="site-footer">
    <div class="container">
      <div class="footer-grid">
        <div class="footer-brand">
          <a class="brand" href="/" aria-label="Vigi-FR, accueil"><svg class="icon" aria-hidden="true" focusable="false" viewBox="0 0 64 64"><use href="#icon-flame"/></svg><span>Vigi-<em>FR</em></span></a>
          <p>Le risque d’incendie de forêt en France métropolitaine, département par département, calculé chaque jour à partir de prévisions météo.</p>
        </div>
        <nav aria-labelledby="f-nav"><p class="footer-title" id="f-nav">Navigation</p><ul>${NAV.map((n) => `<li><a href="${n.href}">${esc(n.label === 'Carte' ? 'Carte nationale' : n.label)}</a></li>`).join('')}</ul></nav>
        <nav aria-labelledby="f-sud"><p class="footer-title" id="f-sud">Sud de la France</p><ul>${sud.map((d) => `<li><a href="${url(d)}">${esc(d.name)} (${d.code})</a></li>`).join('')}</ul></nav>
        <div><p class="footer-title">Sources</p><ul>
          <li><a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo.com<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
          <li><a href="https://effis.jrc.ec.europa.eu/" rel="noopener noreferrer" target="_blank">EFFIS<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
          <li><a href="https://vigilance.meteofrance.fr/" rel="noopener noreferrer" target="_blank">Vigilance Météo-France<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
          <li><a href="/donnees/">Données ouvertes (JSON)</a></li>
        </ul></div>
        <div><p class="footer-title">Mentions</p><ul>
          <li><a href="https://creativecommons.org/licenses/by/4.0/deed.fr" rel="noopener noreferrer" target="_blank">Licence CC BY 4.0<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
          <li><a href="/a-propos/">À propos et indépendance</a></li>
          <li><a href="/politique-de-confidentialite/">Politique de confidentialité</a></li>
          <li><a href="/conditions-d-utilisation/">Conditions d’utilisation</a></li>
          <li><a href="/a-propos/#contact">Contact et signalements</a></li>
          <li><a href="/methodologie/">Limites de la méthode</a></li>
          <li><a href="${GITHUB}" rel="noopener noreferrer" target="_blank">Code source sur GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
          <li><a href="${ISSUES}" rel="noopener noreferrer" target="_blank">Signaler une erreur<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a></li>
        </ul></div>
      </div>
      <div class="footer-bottom">
        <p><strong>Données météo : Open-Meteo.com.</strong> Prévisions utilisées pour calculer l’indice FWI, sous <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" rel="noopener noreferrer" target="_blank">licence CC BY 4.0<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>. Le niveau de risque est un calcul de Vigi-FR, non un bulletin officiel.</p>
        <p>Dernier calcul : <span data-update>${snap.ok ? `<time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>` : 'indisponible'}</span>. Site indépendant, non affilié à Open-Meteo ni à Météo-France. En cas d’urgence : 18 ou 112.</p>
        <p>Contours des départements : IGN (Admin Express), version simplifiée par Grégoire David, sous Licence ouverte. Polices Instrument Serif et Geist, sous licence SIL Open Font.</p>
      </div>
    </div>
  </footer>`;
}

const page = (headHtml, active, body) => `${headHtml}
<body>
${header(active)}
${body}
${footer()}
</body>
</html>
`;


/* ------------------------------------------------------------------ */
/* Pré-rendu des valeurs du dernier calcul (identique à ce que dessine le JavaScript) */
/* Les dates sont toujours absolues (« jeudi 5 novembre 2026 ») : un HTML généré hier ne doit pas dire « demain ». */
/* ------------------------------------------------------------------ */
const dayFullFmt = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const addDays = (dataDate, k) => { const [y, m, d] = dataDate.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d + k)); };
const dayFull = (k) => dayFullFmt.format(addDays(snap.dataDate, k));
const isoDay = (k) => addDays(snap.dataDate, k).toISOString().slice(0, 10);
const plural = (n, w) => `${w}${n >= 2 ? 's' : ''}`;
const badgeHtml = (level, size = '') => {
  const known = Boolean(LEVELS[level]);
  return `<span class="badge${size ? ` badge--${size}` : ''}" data-l="${known ? level : 0}">${ic(known ? level : 0)}<span>${known ? `${level} — ${LEVELS[level].label}` : 'Non disponible'}</span></span>`;
};
const TREND_ICON = { up: 'trend-up', down: 'trend-down', flat: 'trend-flat' };
const trendCell = (D) => {
  const tr = trend(D);
  return tr ? `<span class="bcard__trend">${ic(TREND_ICON[tr.dir])}${tr.dir === 'flat' ? 'Stable' : `${tr.delta > 0 ? '+' : '−'}${fmt(Math.abs(tr.delta))}`}</span>` : '—';
};
const deptLink = (d) => `<a href="${url(d)}">${esc(d.name)} (${d.code})</a>`;
const statesLine = (counts) => [1, 2, 3, 4].filter((l) => counts[l] > 0).map((l) => `${counts[l]} au niveau ${l} (${LEVELS[l].label.toLowerCase()})`).join(', ');

/** Lignes du tableau « liste » de l’accueil (ordre par numéro, échéance par défaut). */
function listRowsHtml() {
  return depts.map((info) => {
    const D = snap.byCode.get(info.code);
    const r = reading(D, snap.defaultDay);
    return `<tr><th scope="row"><a href="${url(info)}"><span class="code">${info.code}</span>${esc(info.name)}</a></th><td>${badgeHtml(r.level, 'sm')}</td><td class="n">${fmt(r.fwi)}</td><td>${trendCell(D)}</td></tr>`;
  }).join('');
}

/** « Le point du jour » : synthèse nationale en texte, pour les lecteurs et robots sans JavaScript. */
function bulletinHtml() {
  if (!snap.ok) return '';
  const k = snap.defaultDay;
  const { counts, total, max } = countsFor(snap, k);
  const top = ranked(snap, k).slice(0, 6);
  const topLi = top.map((r) => `<li>${deptLink(byCode.get(r.d.code))} : niveau ${r.level} (${LEVELS[r.level].label.toLowerCase()}), indice FWI ${fmt(r.fwi)}</li>`).join('');
  return `
        <div class="card bulletin reveal" id="bulletin" data-snap="${snap.fileDate}">
          <h3 class="eyebrow">Le point au ${dayFull(k)}</h3>
          <p>Sur les ${total} départements suivis, ${statesLine(counts)}. Le niveau le plus élevé du pays est le niveau ${max} (${LEVELS[max].label.toLowerCase()}).</p>
          <p>Indices FWI les plus élevés ce jour-là :</p>
          <ol class="rank-list">${topLi}</ol>
          <p class="fine-print">Dernier calcul : <time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>. Les niveaux sont calculés au chef-lieu de chaque département ; ils ne remplacent pas les arrêtés préfectoraux. <a href="/methodologie/">Méthode de calcul</a>.</p>
        </div>`;
}

/* ------------------------------------------------------------------ */
/* Accueil                                                              */
/* ------------------------------------------------------------------ */
// Titre : 30 à 60 caractères (au-delà, les moteurs le tronquent). Le mot-clé principal « risque incendie » est en tête.
const HOME_TITLE = 'Risque incendie de forêt par département | Vigi-FR';
const HOME_DESC = 'Risque incendie de forêt dans les 96 départements de France métropolitaine : niveau de 1 à 4, recalculé chaque jour avec l’indice forêt-météo (FWI).';

/* Section « Prévention » de l’accueil. Chaque réponse s’ouvre par la phrase qui répond à la question du titre
 * (extractible seule par un moteur de réponse). Les faits chiffrés viennent des deux sources citées en bas de page. */
const SRC_MTE = 'https://www.ecologie.gouv.fr/politiques-publiques/prevention-feux-foret';
const SRC_SDES = 'https://www.statistiques.developpement-durable.gouv.fr/edition-numerique/chiffres-cles-risques-naturels/30-feux-de-foret-et-vegetation';
const extLink = (href, label) => `<a href="${href}" rel="noopener noreferrer" target="_blank">${label}<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>`;
const SRC_OLD = 'https://www.ecologie.gouv.fr/sites/default/files/documents/06.01.2026_OLD_Fiche-Presse-2026_0.pdf';
const FIGS = [
  ['96', 'départements suivis chaque jour, au niveau de leur chef-lieu', 'calculs Vigi-FR à partir de prévisions Open-Meteo.com'],
  ['4', 'niveaux de risque : faible, modéré, élevé, très élevé', `classes de danger ${extLink('https://effis.jrc.ec.europa.eu/', 'EFFIS')}, regroupées par Vigi-FR`],
  ['90&nbsp;%', 'des départs de feux de forêt ont une origine humaine', extLink(SRC_MTE, 'ministère de la Transition écologique')],
  ['90&nbsp;%', 'des maisons détruites lors des feux de forêt ne sont pas, ou sont mal, débroussaillées', extLink(SRC_MTE, 'ministère de la Transition écologique')],
  ['50&nbsp;m', 'de débroussaillement autour des constructions, portés à 100 m lorsque les enjeux le justifient', extLink(SRC_OLD, 'fiche OLD 2026 du ministère')],
  ['7&nbsp;400', 'communes comportant des territoires exposés au risque d’incendie de forêt', extLink(SRC_OLD, 'fiche OLD 2026 du ministère')],
];
const CODE_REQ = 'curl https://vigi-fr.vercel.app/data/fwi.json'.replace('https://vigi-fr.vercel.app/', SITE);
const CODE_JSON = `{
  "schemaVersion": 2,
  "fileDate": "2026-11-04T12:50:17Z",
  "source": "Open-Meteo.com",
  "departments": [
    { "code": "01", "name": "Ain", "j1": 1, "j2": 1, "fwi1": 0.7, "fwi2": 0 }
  ]
}`;
const CODE_LEVELS = `FWI < 11,2         → niveau 1 (faible)
11,2 ≤ FWI < 21,3  → niveau 2 (modéré)
21,3 ≤ FWI < 38    → niveau 3 (élevé)
FWI ≥ 38           → niveau 4 (très élevé)`;
const codeBlock = (cap, code) => `<figure class="code"><figcaption>${cap}</figcaption><pre><code>${esc(code)}</code></pre></figure>`;
const PREVENTION = [
  ['Qu’est-ce que le risque incendie de forêt ?',
    `Le risque incendie de forêt est la possibilité qu’un feu démarre et se propage dans la végétation. Il dépend de la météo et de la sécheresse du combustible. Il dépend aussi de ce qui se trouve sur le passage du feu : habitations, routes, massifs. On distingue donc l’aléa, c’est-à-dire le danger lié aux conditions du moment, des enjeux, c’est-à-dire ce qu’un feu pourrait toucher.`,
    `Cependant, Vigi-FR ne mesure que la part météorologique de ce danger, au chef-lieu de chaque département, avec l’indice forêt-météo (FWI). Il ne tient compte ni de la présence d’habitations ni de l’état réel de chaque massif. Le guide <a href="/guide/indice-foret-meteo-fwi/">Indice forêt-météo : définition, niveaux, limites</a> décrit ces limites en détail.`,
    `À retenir : le niveau de risque décrit un danger météorologique, pas une certitude d’incendie. Plus le niveau est élevé, plus un départ de feu peut se propager vite.`],
  ['Le feu de forêt est-il un risque naturel ?',
    `Oui, le feu de forêt fait partie des risques naturels. Il reste pourtant très lié aux activités humaines. Selon le ministère de la Transition écologique, ${extLink(SRC_MTE, '90 % des départs de feux de forêt ont une origine humaine')}. Les autres départs ont une origine naturelle, comme la foudre.`,
    `Les campagnes de sensibilisation visent donc des gestes du quotidien. Il s’agit des mégots jetés, des barbecues et des travaux à étincelles près de la végétation (${extLink(SRC_SDES, 'service statistique du ministère')}). La météo, elle, détermine à quelle vitesse un départ de feu peut se propager.`,
    `À retenir : un feu de forêt est un risque naturel, mais le plus souvent humain par son déclenchement. La prévention commence donc par des gestes simples, avant même de regarder la météo.`],
  ['Que change le niveau de risque pour la prévention incendie ?',
    `Plus le niveau est élevé, plus les règles de sécurité incendie en milieu naturel comptent. Aux niveaux 3 et 4, évitez tout feu, barbecue ou point chaud en forêt et près de la végétation sèche. Ne jetez jamais de mégot et ne stationnez pas sur l’herbe sèche.`,
    `Au niveau 2, un départ de feu reste possible, donc la prudence s’impose. En revanche, au niveau 1, les conditions sont peu favorables aux départs de feu de végétation. Une campagne nationale de prévention rappelle ces gestes chaque année. Chaque fiche de département reprend les conseils de vigilance du niveau affiché, et seuls les arrêtés préfectoraux fixent les interdictions.`,
    `À retenir : le niveau indique quand redoubler de vigilance, pas ce qui est autorisé. Pour connaître une interdiction précise, consultez la mairie ou la préfecture de votre département.`],
  ['Qui assure la lutte contre l’incendie et la gestion du risque ?',
    `La lutte contre l’incendie relève des sapeurs-pompiers (18 ou 112). La gestion du risque incendie, elle, associe l’État, les collectivités et les propriétaires. Ainsi, chacun agit à son niveau : les secours éteignent, les autorités encadrent, les propriétaires protègent leurs constructions.`,
    `Par ailleurs, les préfectures peuvent limiter l’accès aux massifs ou l’usage du feu par arrêté. En outre, le PPRIF, plan de prévention des risques naturels d’incendie de forêt, fixe un zonage réglementaire des constructions. Selon le ministère, ce zonage s’impose aux autorisations d’urbanisme.`,
    `À retenir : en cas de feu, les secours interviennent ; avant tout feu, la prévention incombe à chacun. Les décisions locales sont publiées par la préfecture et la mairie. Le niveau de Vigi-FR vient en complément : il éclaire la vigilance, sans décider des mesures.`],
  ['Quels travaux de prévention incendie sont obligatoires ?',
    `Le débroussaillement est obligatoire autour des constructions dans les territoires concernés. Il s’agit des obligations légales de débroussaillement (OLD), fixées localement par arrêté préfectoral. Elles portent sur une zone de 50 mètres autour des constructions, portée à 100 mètres lorsque les enjeux le justifient. Près de ${extLink(SRC_OLD, '7 400 communes')} comportent des territoires exposés.`,
    `Ces travaux sont un moyen de protection contre l’incendie des habitations. En effet, ${extLink(SRC_MTE, '90 % des maisons détruites lors des feux de forêt ne sont pas, ou sont mal, débroussaillées')}. Ils sont permanents et ne dépendent donc pas du niveau du jour. Le guide <a href="/guide/debroussaillement-obligatoire/">Débroussaillement obligatoire : qui, où, quand, quelles sanctions</a> détaille les règles.`,
    `À retenir : pour savoir si votre terrain est concerné, contactez la mairie ou la préfecture. Vous pouvez aussi consulter ${extLink('https://jedebroussaille.gouv.fr/', 'jedebroussaille.gouv.fr')}, service indiqué par le ministère. Le zonage informatif est publié sur ${extLink('https://www.georisques.gouv.fr/', 'Géorisques')}.`],
  ['Où trouver une carte du risque incendie de forêt ?',
    `La <a href="#carte">carte nationale de cette page</a> colore chaque département selon son niveau de risque, de 1 à 4. Elle se lit en un coup d’œil. Survolez ou touchez un département pour afficher son niveau, son indice FWI et sa tendance sur les deux jours suivants.`,
    `Pour une carte officielle du danger de feux de forêt, consultez la Météo des forêts de Météo-France. De même, pour la vigilance incendie locale (accès aux massifs, usage du feu), lisez les arrêtés de votre préfecture. Le guide <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux : qui dit quoi ?</a> explique les différences.`,
    `À retenir : une carte indique un niveau de danger, pas un périmètre d’incendie. Celle de cette page ne remplace ni la Météo des forêts, carte officielle, ni les arrêtés de votre préfecture.`],
  ['Que faire en cas de départ de feu en forêt ?',
    `Appelez immédiatement le 18 (sapeurs-pompiers) ou le 112, en indiquant le lieu le plus précis possible. Éloignez-vous du feu. Laissez les accès libres pour les secours. Si le feu est important ou menace des habitations, n’attendez pas : l’alerte rapide reste le geste le plus utile.`,
    `Signalez tout feu naissant, même petit : un départ de feu repéré tôt est en effet plus facile à maîtriser. Chaque fiche de département rappelle ces consignes d’urgence. Le 112 fonctionne en effet partout en France, comme dans le reste de l’Union européenne.`,
    `Ces réflexes valent à tous les niveaux de risque : 18 ou 112, lieu précis, éloignement. Un feu repéré au niveau 1 ou 2 peut aussi devenir dangereux si le vent se lève. Mieux vaut donc le signaler que supposer qu’il s’éteindra seul.`],
];

const FAQ = [
  ['Que signifie le niveau affiché ?', ['Vigi-FR affiche, pour chaque département, un niveau de risque d’incendie de forêt pour les prochains jours. Ce niveau repose sur l’indice forêt-météo canadien (FWI), calculé à partir des prévisions météorologiques au chef-lieu du département.']],
  ['Comment lire les quatre niveaux de risque ?', ['L’échelle comporte quatre niveaux. Le 1 (Faible) correspond à un FWI inférieur à 11,2 ; le 2 (Modéré) va de 11,2 à 21,3. Le 3 (Élevé) va de 21,3 à 38 ; le 4 (Très élevé) commence à 38. Ainsi, plus le niveau est haut, plus les conditions favorisent le départ et la propagation d’un feu de végétation.', 'Ces seuils (11,2 ; 21,3 ; 38) viennent des classes de danger du système européen EFFIS, qui en compte six. Vigi-FR regroupe donc les deux classes les plus basses (niveau 1) et les deux plus hautes (niveau 4).']],
  ['D’où viennent les données et comment sont-elles calculées ?', ['Les prévisions météorologiques viennent d’<a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo.com<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>, sous licence CC BY 4.0. Chaque jour, Vigi-FR en tire l’indice FWI de chaque département. Ce niveau est un calcul du site. Il ne s’agit ni d’un bulletin officiel de Météo-France ni d’une consigne des autorités. Aucune donnée personnelle n’est collectée.', 'Le détail du calcul est décrit sur la page <a href="/methodologie/">Méthodologie</a>.']],
  ['À quelle fréquence les données sont-elles mises à jour ?', ['Le calcul est refait chaque jour, tôt le matin (heure de Paris), toute l’année. Ainsi, les niveaux restent à jour. La date et l’heure du dernier calcul figurent en haut de la page d’accueil et dans le pied de page. Si ce calcul date de plusieurs jours, le site vous le signale.']],
  ['Le site fonctionne-t-il toute l’année ?', ['Oui. Le calcul est refait chaque jour, en toute saison. Hors été, les niveaux sont souvent bas. Cependant, un épisode chaud, sec et venteux peut les faire monter à tout moment de l’année.']],
  ['Que faire quand le risque est élevé ou très élevé ?', ['Évitez tout feu, barbecue ou point chaud en forêt et près de la végétation sèche. Ne jetez jamais de mégot et ne stationnez pas sur l’herbe sèche. Renseignez-vous sur les arrêtés de votre préfecture, qui peuvent limiter l’accès aux massifs. En cas de départ de feu, appelez le 18 ou le 112.', 'Pour la vigilance météorologique officielle, consultez <a href="https://vigilance.meteofrance.fr/" rel="noopener noreferrer" target="_blank">vigilance.meteofrance.fr<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.']],
  ['Pourquoi un seul point de calcul par département ?', ['Le calcul est fait au chef-lieu de chaque département. Un massif éloigné du chef-lieu peut donc avoir un niveau réel différent de celui affiché. C’est aussi le cas d’un département contrasté, par exemple avec un littoral et un relief.']],
  ['Qu’est-ce que l’indice forêt-météo (FWI ou IFM) ?', ['C’est un indice de danger météorologique d’origine canadienne. Il estime dans quelle mesure la météo favorise l’éclosion d’un feu de végétation, puis sa propagation. Il tient compte de la température, de l’humidité de l’air, du vent et de la pluie récente. FWI est le sigle anglais, IFM le sigle utilisé en France. Il ne signale aucun incendie en cours.', 'Le guide <a href="/guide/indice-foret-meteo-fwi/">Indice forêt-météo : définition, niveaux, limites</a> détaille ses composantes.']],
  ['Quelle différence avec la Météo des forêts de Météo-France ?', ['La Météo des forêts est la carte officielle de danger de feux de Météo-France, en quatre couleurs par département. Vigi-FR est un calcul indépendant du FWI au chef-lieu, avec des seuils fixes. Par conséquent, les niveaux peuvent différer. Ni l’un ni l’autre n’a de valeur réglementaire.', 'Voir <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux : qui dit quoi ?</a>']],
  ['Peut-on réutiliser les données de Vigi-FR ?', ['Oui. Le dernier calcul est publié au format JSON, avec ses champs documentés, sous licence CC BY 4.0. Il suffit donc de citer Vigi-FR et Open-Meteo.com. Voir la page <a href="/donnees/">Données ouvertes</a>.']],
  ['Vigi-FR remplace-t-il les arrêtés préfectoraux ?', ['Non. Vigi-FR est un outil d’information. Seuls les arrêtés des préfectures et les consignes des autorités font foi. Cela vaut pour les restrictions d’accès aux massifs et d’usage du feu.']],
];

function homePage() {
  const regions = [...new Set(depts.map((d) => d.region))].sort((a, b) => a.localeCompare(b, 'fr'));
  const mapPaths = depts.map((d) => `<a class="dept" data-code="${d.code}" href="${url(d)}" tabindex="0" aria-label="${esc(d.name)} (${d.code})"><path class="shape" d="${map.depts[d.code].d}"/></a>`).join('\n          ');
  const levelLi = (l) => `<li data-l="${l}">${ic(l)}<span><strong>${l} — ${LEVELS[l].label}</strong><small>${LEVELS[l].range}</small></span><b data-count>${hc ? hc.counts[l] : '—'}</b></li>`;
  const faqNode = { '@type': 'FAQPage', '@id': `${SITE}#faq`, url: SITE, name: 'Questions fréquentes sur le risque incendie de forêt et Vigi-FR', inLanguage: 'fr-FR', isPartOf: { '@id': `${SITE}#page` }, mainEntity: FAQ.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: plain(a.map((p) => `<p>${p}</p>`).join(' ')) } })) };
  const ogImage = { '@type': 'ImageObject', '@id': `${SITE}#primaryimage`, url: `${SITE}assets/img/og-image.png`, width: 1200, height: 630, caption: OG_ALT };
  const jsonld = graph(
    webPage({ path: '/', title: HOME_TITLE, description: HOME_DESC, modified: snap.ok ? snap.fileDate : null, crumbs: false, extra: { primaryImageOfPage: { '@id': ogImage['@id'] }, image: { '@id': ogImage['@id'] }, about: { '@type': 'Thing', name: 'Risque d’incendie de forêt' }, author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID } } }),
    ogImage, faqNode);
  const k0 = snap.defaultDay;
  const hc = snap.ok ? countsFor(snap, k0) : null;
  const topR = snap.ok ? ranked(snap, k0)[0] : null;

  const body = `  <main id="contenu">
    <section class="hero" id="hero" aria-labelledby="titre-principal" data-calm="${hc ? String(hc.max !== null && hc.max <= 1) : 'false'}">
      <div class="hero__bg" aria-hidden="true">
        <div class="hero__glow"></div>
        <div class="hero__map"><svg viewBox="0 0 ${map.width} ${map.height}" focusable="false"><g id="hero-map-g"></g></svg></div>
        <div class="embers">${'<i></i>'.repeat(12)}</div>
      </div>
      <div class="container">
        <div class="hero__grid">
          <div class="hero__copy">
            <div class="eyebrow eyebrow--ember">Risque d’incendie de forêt · France métropolitaine</div>
            <h1 id="titre-principal" class="display">Comprendre le risque incendie de forêt, <em>département par département.</em></h1>
            <p class="lead">Niveau de risque, indice forêt-météo (FWI) et prévisions pour les prochains jours dans les 96 départements de France métropolitaine. Recalculé chaque jour, toute l’année, à partir de prévisions météo.</p>
            <div class="hero__actions">
              <a class="btn btn--primary" href="#carte">Explorer la carte ${ic('arrow', 'icon--arrow')}</a>
              <button type="button" class="btn btn--ghost" data-open-search aria-haspopup="dialog">${ic('search')} Rechercher mon département</button>
            </div>
          </div>
          <aside class="nat" aria-labelledby="nat-title">
            <div class="nat__top"><h2 class="eyebrow" id="nat-title">Vigilance nationale</h2><span class="eyebrow" id="nat-day">${snap.ok ? `Prévision · ${dayDate(snap.dataDate, k0)}` : ''}</span></div>
            <div class="nat__ring" id="nat-ring">
              <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false"><circle class="track" cx="100" cy="100" r="88"/>${[1, 2, 3, 4].map((l) => `<circle class="seg" data-l="${l}" cx="100" cy="100" r="88"/>`).join('')}</svg>
              <div class="nat__center" id="nat-center" data-l="${hc?.max ?? 0}" aria-live="polite"><span class="nat__word" id="nat-word">${hc?.max ? LEVELS[hc.max].label : '<span class="skeleton sk-word"></span>'}</span><span class="nat__sub" id="nat-sub">${hc?.max ? `Niveau ${hc.max} sur 4` : 'Chargement'}</span></div>
            </div>
            <ul class="nat__rows" id="nat-rows">${[1, 2, 3, 4].map((l) => `<li class="nat__row" data-l="${l}">${ic(l)}<span>${l} — ${LEVELS[l].label}</span><b>${hc ? hc.counts[l] : '—'}</b></li>`).join('')}</ul>
            <p class="nat__foot" id="nat-foot">${topR && topR.fwi !== null ? `Indice FWI le plus élevé : <strong>${fmt(topR.fwi)}</strong> à ${esc(byCode.get(topR.d.code).name)} (${topR.d.code}).` : '<span class="skeleton sk-line"></span>'}</p>
          </aside>
        </div>
        <dl class="meta-strip">
          <div><dt>Dernière mise à jour</dt><dd id="m-update">${snap.ok ? `<time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>` : '<span class="skeleton sk-line"></span>'}</dd></div>
          <div><dt>Source des prévisions</dt><dd>Open-Meteo.com</dd></div>
          <div><dt>Départements suivis</dt><dd id="m-count">${hc ? `${hc.total} sur ${depts.length}` : '<span class="skeleton sk-line"></span>'}</dd></div>
          <div><dt>Niveau national</dt><dd id="m-level">${hc?.max ? `${badgeHtml(hc.max, 'sm')}<span class="sr-only"> ${dayFull(k0)}</span>` : '<span class="skeleton sk-line"></span>'}</dd></div>
        </dl>
        <nav class="toc" aria-label="Sur cette page">
          <div class="chips">
            <a href="#carte">Carte</a><a href="#vigilance">Territoires les plus exposés</a><a href="#essentiel">L’essentiel</a><a href="#lire">Comment lire le risque</a><a href="#prevention">Prévention</a><a href="#chiffres">Chiffres clés</a><a href="#comparaison">Comparaison</a><a href="#donnees-ouvertes">Données ouvertes</a><a href="#faq">Questions fréquentes</a><a href="#departements">Les 96 départements</a>
          </div>
        </nav>
      </div>
    </section>

    <section class="section" id="carte" aria-labelledby="t-carte">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Carte nationale</div>
          <h2 class="display" id="t-carte">La carte du risque incendie <em>en France métropolitaine</em></h2>
          <p class="lead">Cette carte colore chaque département selon son niveau de risque d’incendie de forêt, de 1 (faible) à 4 (très élevé). Survolez un département, ou touchez-le, pour lire son niveau, son indice FWI et sa tendance. Ouvrez ensuite sa fiche ; les onglets changent d’échéance.</p>
        </div>
        <div class="map-tools">
          <div id="day-tabs" class="tabs skeleton sk-tabs"></div>
          <div class="view-switch" id="view-switch" role="group" aria-label="Mode d’affichage">
            <button type="button" data-view="map" aria-pressed="true">${ic('map')} Carte</button>
            <button type="button" data-view="list" aria-pressed="false">${ic('list')} Liste</button>
          </div>
        </div>
        <p class="sr-only" id="day-live" role="status" aria-live="polite"></p>
        <div class="map-view">
          <div class="map-layout">
            <div class="map-stage" id="map-stage" data-zoomed="false">
              <div class="map-wrap">
                <svg class="france-map" id="france-map" viewBox="0 0 ${map.width} ${map.height}" role="group" aria-label="Carte des départements de France métropolitaine, colorée selon le niveau de risque. Chaque département est un lien vers sa fiche.">
                  <defs><pattern id="hatch-4" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="#E5352B"/><rect width="2" height="7" fill="#0B0A08" fill-opacity="0.4"/></pattern></defs>
                  <g id="map-glow" class="map-glow"></g>
                  <g class="map-layer" id="map-layer">
          ${mapPaths}
                  </g>
                  <g id="map-hatch" class="map-hatch"></g>
                  <path id="map-hl" class="map-hl" d=""/>
                </svg>
              </div>
              <div class="tip" id="tip" aria-hidden="true" data-l="0">
                <div class="tip__head"><span class="tip__name"></span><span class="tip__code"></span></div>
                <div class="tip__badge"></div>
                <div class="eyebrow">Indice FWI</div>
                <p class="tip__fwi num"></p>
                <div class="tip__row"><span>Tendance</span><b class="tip__trend"></b></div>
                <div class="tip__row"><span>Région</span><b class="tip__region"></b></div>
              </div>
            </div>
            <div class="side">
              <div class="card">
                <h3 class="eyebrow">Légende · niveaux de risque</h3>
                <ol class="legend" id="legend">${[1, 2, 3, 4].map(levelLi).join('')}</ol>
                <p class="fine-print">Nombre de départements par niveau, pour l’échéance affichée. Les hachures signalent le niveau 4. Au clavier, parcourez la carte avec la touche Tab.</p>
              </div>
              <div class="card sel" id="sel" data-l="0" aria-live="polite"><div class="eyebrow">Département sélectionné</div><p class="sel__hint">Survolez la carte, ou touchez un département, pour afficher son niveau. Au clavier, parcourez les départements avec la touche Tab.</p></div>
            </div>
          </div>
        </div>
        <div class="list-view" id="list-view" hidden>
          <div class="list-tools"><label class="sr-only" for="list-filter">Filtrer les départements</label><input class="field" id="list-filter" type="search" placeholder="Filtrer par nom, numéro ou région" autocomplete="off"></div>
          <div class="table-scroll">
            <table class="data-table" id="list-table">
              <caption class="sr-only" id="list-caption">${snap.ok ? `Niveaux de risque le ${dayFull(k0)} : ${depts.length} départements.` : ''}</caption>
              <thead><tr>
                <th scope="col"><button type="button" data-sort="code">N°</button> · <button type="button" data-sort="name">Département</button></th>
                <th scope="col"><button type="button" data-sort="level">Niveau</button></th>
                <th scope="col" class="n"><button type="button" data-sort="fwi">Indice FWI</button></th>
                <th scope="col">Évolution J+1 / J+2</th>
              </tr></thead>
              <tbody id="list-body">${snap.ok ? listRowsHtml() : ''}</tbody>
            </table>
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="vigilance" aria-labelledby="t-vig">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Départements sous vigilance</div>
          <h2 class="display" id="t-vig">Les territoires <em>les plus exposés</em></h2>
          <p class="lead">Ce classement place en tête les départements au niveau de risque le plus élevé. Viennent ensuite ceux dont l’indice FWI est le plus haut.</p>
        </div>
        ${(() => {
          if (!hc) return '<p class="bento-state" id="bento-state" hidden></p>';
          const hot = hc.counts[3] + hc.counts[4];
          const day = `le ${dayFull(k0)}`;
          const lead = hc.max <= 1 ? `Aucun département n’est au-dessus du niveau 1 ${day}.` : hot > 0 ? `${hot} ${plural(hot, 'département')} au niveau 3 ou plus ${day}.` : `Aucun département au niveau 3 ou plus ${day}.`;
          return `<p class="bento-state" id="bento-state"><strong>${lead}</strong>${hc.max <= 1 ? ' Voici ceux dont l’indice FWI est le plus élevé.' : ' Classés par niveau, puis par indice FWI.'}</p>`;
        })()}
        <div class="bento" id="bento">
          <div class="skeleton sk-card bcard--hero"></div><div class="skeleton sk-card bcard--wide"></div><div class="skeleton sk-card bcard--wide"></div>
          <div class="skeleton sk-card bcard--std"></div><div class="skeleton sk-card bcard--std"></div><div class="skeleton sk-card bcard--std"></div>
        </div>
        <div class="bento-more reveal"><a class="btn btn--ghost" href="#departements">Voir les 96 départements ${ic('arrow', 'icon--arrow')}</a></div>${bulletinHtml()}
      </div>
    </section>

    <section class="section" id="essentiel" aria-labelledby="t-ess">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">En bref</div>
          <h2 class="display" id="t-ess">L’essentiel&nbsp;: <em>ce qu’il faut retenir</em></h2>
          <p class="lead">Chaque jour, Vigi-FR transforme la météo en un niveau de risque d’incendie de forêt, de 1 à 4. Il couvre les 96 départements de France métropolitaine.</p>
        </div>
        <div class="prose reveal">
          <ul>
            <li><strong>Niveaux :</strong> de 1 (faible) à 4 (très élevé), d’après l’indice forêt-météo (FWI).</li>
            <li><strong>Seuils :</strong> 11,2 ; 21,3 et 38, ceux des classes de danger EFFIS.</li>
            <li><strong>Exemple :</strong> avec un FWI de 25, un département est au niveau 3 (élevé). En effet, 25 se situe entre 21,3 et 38.</li>
            <li><strong>Calcul :</strong> refait chaque jour au chef-lieu de chaque département, à partir de prévisions Open-Meteo.</li>
            <li><strong>Limite :</strong> ce n’est pas un bulletin officiel. Les arrêtés préfectoraux font foi.</li>
            <li><strong>Urgence :</strong> appelez le 18 ou le 112.</li>
          </ul>
        </div>
      </div>
    </section>

    <section class="section" id="lire" aria-labelledby="t-lire">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Comment lire le risque ?</div>
          <h2 class="display" id="t-lire">Cinq éléments, <em>un seul indice</em></h2>
          <p class="lead">Le niveau de risque repose sur un seul indice, le FWI. Il est construit à partir de la météo du moment et de l’état de sécheresse. Ainsi, plus il est élevé, plus un feu de forêt démarre et se propage facilement.</p>
        </div>
        <ol class="flow reveal">
          <li><div class="eyebrow">${ic('thermo')} Étape 1</div><h3>La météo à midi</h3><p>Température, humidité de l’air, vent et pluie des dernières 24 heures, prévus au chef-lieu du département.</p></li>
          <li><div class="eyebrow">${ic('drop')} Étape 2</div><h3>La sécheresse accumulée</h3><p>Trois codes (FFMC, DMC et DC) suivent l’humidité des feuilles mortes, de l’humus et du sol profond. Ils tiennent compte des 30 derniers jours.</p></li>
          <li><div class="eyebrow">${ic('wind')} Étape 3</div><h3>Propagation et combustible</h3><p>Deux indices en découlent : la vitesse de propagation du feu (ISI) et le combustible disponible (BUI).</p></li>
          <li><div class="eyebrow">${ic('gauge')} Étape 4</div><h3>L’indice FWI</h3><p>Enfin, les deux se combinent en un chiffre, le FWI, classé en quatre niveaux, de Faible à Très élevé.</p></li>
        </ol>
        <div class="scale reveal">
          <div class="scale__bar" role="img" aria-label="Échelle du FWI : niveau 1 jusqu’à 11,2 ; niveau 2 de 11,2 à 21,3 ; niveau 3 de 21,3 à 38 ; niveau 4 à partir de 38.">${[['1', '0'], ['2', '11,2'], ['3', '21,3'], ['4', '38']].map(([l, v]) => `<span class="scale__seg" data-l="${l}">${v}${l === '4' ? ' et +' : ''}</span>`).join('')}</div>
          <ul class="scale__labels">${[1, 2, 3, 4].map((l) => `<li data-l="${l}"><strong>${l} — ${LEVELS[l].label}</strong>${LEVELS[l].hint}</li>`).join('')}</ul>
          <p class="fine-print">Source des seuils : classes de danger du système européen EFFIS (Copernicus), regroupées en quatre niveaux.</p>
        </div>
        <div class="factors">${FACTORS.map((f, i) => `
          <article class="factor reveal"><div class="factor__icon">${ic(f.icon)}</div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p><div class="mono">${esc(f.tag)}</div></article>`).join('')}
        </div>
      </div>
    </section>

    <section class="section" id="prevention" aria-labelledby="t-prev">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Prévention</div>
          <h2 class="display" id="t-prev">Prévenir le risque incendie : <em>ce que change le niveau</em></h2>
          <p class="lead">Le niveau de risque indique si la météo favorise un feu de forêt. La prévention, elle, se prépare avant l’épisode à risque. Elle concerne autant les autorités que chacun d’entre nous.</p>
        </div>
        <div class="prevention">
          <div class="prevention__text">
            ${PREVENTION.map(([q, ...ps]) => `<div class="prevention__item prose"><h3>${esc(q).replace(/ \?$/, '\u00a0?')}</h3>${ps.map((x) => `<p>${x}</p>`).join('')}</div>`).join('\n            ')}
          </div>
          <figure class="prevention__fig reveal">
            <img src="/assets/img/reflexes-risque-incendie.svg" width="560" height="452" loading="lazy" decoding="async" alt="Quatre réflexes quand le risque incendie de forêt est élevé : pas de feu ni de barbecue près de la végétation sèche, aucun mégot jeté, pas de stationnement sur l’herbe sèche, et en cas de départ de feu, appeler le 18 ou le 112.">
            <figcaption class="fine-print">Les quatre réflexes de base, repris des conseils de vigilance affichés sur chaque fiche de département.</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section class="section" id="chiffres" aria-labelledby="t-chiffres">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Chiffres clés</div>
          <h2 class="display" id="t-chiffres">Le risque incendie <em>en chiffres</em></h2>
          <p class="lead">Selon nos calculs quotidiens et les publications du ministère de la Transition écologique, six repères chiffrés résument l’échelle de Vigi-FR. Ils éclairent aussi le contexte de la prévention. Chacun indique sa source.</p>
        </div>
        <ul class="keyfigs reveal">
          ${FIGS.map(([n, t, src]) => `<li class="keyfig"><strong class="keyfig__n">${n}</strong><span class="keyfig__t">${t}.</span><span class="keyfig__s">Source : ${src}.</span></li>`).join('\n          ')}
        </ul>
      </div>
    </section>

    <section class="section" id="comparaison" aria-labelledby="t-cmp">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Comparaison</div>
          <h2 class="display" id="t-cmp">Vigi-FR vs Météo des forêts&nbsp;: <em>que consulter ?</em></h2>
          <p class="lead">Les deux cartes se complètent, mais elles ne mesurent pas la même chose. L’une est officielle et saisonnière ; l’autre est indépendante et disponible toute l’année.</p>
        </div>
        <div class="table-scroll reveal">
          <table class="data-table">
            <caption class="sr-only">Comparaison entre Vigi-FR et la Météo des forêts de Météo-France</caption>
            <thead><tr><th scope="col">Critère</th><th scope="col">Vigi-FR</th><th scope="col">Météo des forêts</th></tr></thead>
            <tbody>
              <tr><th scope="row">Nature</th><td>Calcul indépendant du FWI, publié par un site open source</td><td>Carte officielle du danger de feux de forêt de Météo-France</td></tr>
              <tr><th scope="row">Niveaux</th><td>Quatre niveaux, seuils fixes (FWI 11,2 ; 21,3 ; 38)</td><td>Quatre couleurs par département</td></tr>
              <tr><th scope="row">Période</th><td>Recalculé chaque jour, toute l’année</td><td>De juin à septembre, selon le ${extLink(SRC_MTE, 'ministère de la Transition écologique')}</td></tr>
              <tr><th scope="row">Valeur réglementaire</th><td>Aucune</td><td>Aucune</td></tr>
            </tbody>
          </table>
        </div>
        <div class="prose reveal cmp-text">
          <h3>Deux points de vue complémentaires</h3>
          <p>D’un côté, la Météo des forêts offre une lecture officielle du danger. De l’autre, Vigi-FR publie un calcul transparent, réutilisable et disponible toute l’année. En revanche, aucune des deux ne dit si un massif est accessible : seul l’arrêté de la préfecture le précise.</p>
          <h3>Limites et critiques du niveau de risque</h3>
          <p>Le niveau de Vigi-FR a des limites. Il est calculé au chef-lieu du département, donc un massif éloigné peut connaître d’autres conditions. Cependant, cette simplification rend le calcul transparent et reproductible par n’importe qui. Par ailleurs, les niveaux de Vigi-FR peuvent différer de la Météo des forêts. Aucun des deux ne remplace l’arrêté de la préfecture.</p>
          <h3>Conclusion : que retenir ?</h3>
          <p>Consultez Vigi-FR pour une vue quotidienne et chiffrée. Ouvrez la Météo des forêts pour la carte officielle. Lisez l’arrêté de votre préfecture avant toute sortie en massif ou tout usage du feu. En cas d’urgence, appelez le 18 ou le 112. Le guide <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux : qui dit quoi ?</a> détaille ces différences.</p>
        </div>
      </div>
    </section>

    <section class="section" id="donnees-ouvertes" aria-labelledby="t-do">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Pour les développeurs</div>
          <h2 class="display" id="t-do">Réutiliser les données&nbsp;: <em>un JSON ouvert</em></h2>
          <p class="lead">Les niveaux de risque de Vigi-FR sont publiés dans un fichier JSON ouvert. N’importe quel site ou application peut le lire sans clé ni inscription. Voici donc comment l’interroger et comment lire un niveau.</p>
        </div>
        <div class="datadoc">
          <div class="prose reveal">
            <ul>
              <li><strong>Format :</strong> JSON, UTF-8, accessible depuis d’autres sites (CORS ouvert).</li>
              <li><strong>Adresse :</strong> <a href="/data/fwi.json">/data/fwi.json</a>.</li>
              <li><strong>Contenu :</strong> niveau de 1 à 4 et indice FWI de chaque département, pour chaque échéance.</li>
              <li><strong>Mise à jour :</strong> recalcul quotidien, date du calcul dans le champ <code>fileDate</code>.</li>
              <li><strong>Licence :</strong> CC BY 4.0, avec mention de Vigi-FR et d’Open-Meteo.com.</li>
              <li><strong>Documentation :</strong> page <a href="/donnees/">Données ouvertes</a>.</li>
            </ul>
          </div>
          <div class="codeblocks reveal">
            ${codeBlock('Requête', CODE_REQ)}
            ${codeBlock('Réponse (extrait, valeurs d’exemple)', CODE_JSON)}
            ${codeBlock('Correspondance entre l’indice FWI et le niveau', CODE_LEVELS)}
          </div>
        </div>
      </div>
    </section>

    <section class="section" id="faq" aria-labelledby="t-faq">
      <div class="container faq-grid">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">FAQ et méthodologie</div>
          <h2 class="display" id="t-faq">Questions <em>fréquentes</em></h2>
          <p class="lead">Cette FAQ répond aux questions les plus fréquentes sur l’origine des données et leur mise à jour. Elle explique aussi la signification des niveaux et les bons réflexes. Le détail du calcul est sur la page <a href="/methodologie/">Méthodologie</a>.</p>
        </div>
        <div class="faq reveal">
          ${FAQ.map(([q, a]) => `<details name="faq"><summary>${esc(q)}${ic('plus')}</summary><div class="faq__a">${a.map((p) => `<p>${p}</p>`).join('')}</div></details>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section" id="departements" aria-labelledby="t-depts">
      <div class="container">
        <div class="section__head reveal">
          <div class="eyebrow eyebrow--ember">Index</div>
          <h2 class="display" id="t-depts">Les 96 départements, <em>par région</em></h2>
          <p class="lead">Chaque département a sa fiche. Elle donne son niveau de risque, son indice FWI, les conditions météo et les conseils de vigilance.</p>
        </div>
        <div class="regions">
          ${regions.map((r) => `<div class="region reveal"><h3><a href="${regionUrl(r)}">${esc(r)}</a></h3><p class="region__lead">Les ${depts.filter((d) => d.region === r).length} départements de la région ${esc(r)}, classés par numéro. Ouvrez ensuite une fiche pour lire l’indice FWI et les conseils de vigilance.</p><ul>${depts.filter((d) => d.region === r).map((d) => {
            const lv = snap.ok ? reading(snap.byCode.get(d.code), k0).level : null;
            return `<li><a href="${url(d)}" data-code="${d.code}" data-name="${esc(d.name)}" data-l="${lv ?? 0}"${lv ? ` aria-label="${d.code} ${esc(d.name)}, niveau ${lv} sur 4"` : ''}><span class="code">${d.code}</span>${esc(d.name)}<span class="dot" aria-hidden="true"></span></a></li>`;
          }).join('')}</ul><div class="region__more"><a href="${regionUrl(r)}">Synthèse ${esc(REGION_LOC[r])}</a></div></div>`).join('\n          ')}
        </div>
      </div>
    </section>

    <section class="section" aria-labelledby="titre-avertissement">
      <div class="container">
        <aside class="safety reveal" role="note">
          <div>
            <div class="eyebrow eyebrow--ember">Information et sécurité</div>
            <h2 id="titre-avertissement">En cas d’urgence, appelez le 18 ou le 112.</h2>
            <p>Vigi-FR est un outil d’information. Il ne remplace ni les consignes des autorités (préfectures, mairies, sapeurs-pompiers) ni les arrêtés locaux. Ceux-ci limitent l’accès aux massifs ou l’usage du feu. Le 18 joint les sapeurs-pompiers ; le 112 est le numéro d’urgence européen.</p>
          </div>
          <div class="safety__calls"><b>18</b><span>Sapeurs-pompiers</span><b>112</b><span>Urgence européenne</span></div>
        </aside>
      </div>
    </section>

    <section class="section" aria-labelledby="titre-sources">
      <div class="container">
        <h2 class="h-sm" id="titre-sources">Sources et méthode</h2>
        <p class="sources-lead">Les niveaux reposent sur des prévisions météo ouvertes, la méthode canadienne du FWI et les classes de danger européennes EFFIS. La section Prévention s’appuie, elle, sur deux publications officielles.</p>
        <ul class="sources">
          <li>Prévisions météo : <a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo.com<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>, sous licence CC BY 4.0.</li>
          <li>Indice forêt-météo (FWI) : Van Wagner, C.E. (1987), <em>Development and structure of the Canadian Forest Fire Weather Index System</em>, Forestry Technical Report 35, Canadian Forestry Service.</li>
          <li>Classes de niveau : système européen d’information sur les feux de forêt, <a href="https://effis.jrc.ec.europa.eu/" rel="noopener noreferrer" target="_blank">EFFIS<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</li>
          <li>Prévention des feux de forêt (origine des départs, PPRIF, débroussaillement) : ${extLink(SRC_MTE, 'ministère de la Transition écologique')}.</li>
          <li>Origine des départs de feu et campagnes de sensibilisation : ${extLink(SRC_SDES, 'Chiffres clés des risques naturels, feux de forêt et de végétation (service statistique du ministère)')}.</li>
        </ul>
      </div>
    </section>
    <noscript><div class="container"><p class="notice">La carte interactive nécessite JavaScript. Les niveaux du dernier calcul restent lisibles dans le tableau, le point du jour et l’index des départements.</p></div></noscript>
  </main>`;
  return page(head({ title: HOME_TITLE, description: HOME_DESC, path: '/', jsonld, scripts: ['home.js'] }), 'home', body);
}

/* ------------------------------------------------------------------ */
/* Pages département                                                    */
/* ------------------------------------------------------------------ */
const coord = ([lat, lon]) => `${fmt(Math.abs(lat), 3)} ° ${lat >= 0 ? 'N' : 'S'}, ${fmt(Math.abs(lon), 3)} ° ${lon >= 0 ? 'E' : 'O'}`;

/** Jauge semi-circulaire (mêmes dimensions que assets/js/dept.js). L’aiguille est ajoutée par le JavaScript, qui l’anime. */
function dialSvg(level, fwi) {
  const CX = 150, CY = 150, R = 118, MAX = 60;
  const ang = (v) => Math.PI + (Math.min(Math.max(v, 0), MAX) / MAX) * Math.PI;
  const pt = (a, r) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];
  const arc = (v0, v1) => { const g = 0.018; const [x0, y0] = pt(ang(v0) + g, R); const [x1, y1] = pt(ang(v1) - g, R); return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`; };
  const bounds = [0, ...THRESHOLDS, MAX];
  const arcs = [1, 2, 3, 4].map((l) => `<path class="arc${l === level ? ' on' : ''}" data-l="${l}" d="${arc(bounds[l - 1], bounds[l])}"/>`).join('');
  const ticks = bounds.map((v) => { const [tx, ty] = pt(ang(v), R + 22); return `<text class="tick" x="${tx.toFixed(1)}" y="${(ty + 4).toFixed(1)}" text-anchor="${v === 0 ? 'end' : v === MAX ? 'start' : 'middle'}">${fmt(v, v % 1 ? 1 : 0)}</text>`; }).join('');
  return `<svg viewBox="0 0 300 190" role="img" focusable="false" aria-label="Indice FWI ${fmt(fwi)} sur une échelle de 0 à 60, niveau ${level} ${LEVELS[level].short}">${arcs}${ticks}<text class="tick" x="${CX}" y="${CY + 32}" text-anchor="middle">INDICE FWI</text></svg>`;
}

/** Cartes « conditions » : mêmes libellés que paintConditions() dans assets/js/dept.js. */
const CONDITIONS = [
  { ic: 'thermo', key: 't', label: 'Température', unit: '°C', d: 1, text: 'Température de l’air à midi, heure de Paris.' },
  { ic: 'drop', key: 'h', label: 'Humidité de l’air', unit: '%', d: 0, text: 'Humidité relative à midi : plus l’air est sec, plus la végétation s’assèche vite.' },
  { ic: 'wind', key: 'w', label: 'Vent', unit: 'km/h', d: 1, text: 'Vitesse du vent à 10 m, à midi.' },
  { ic: 'rain', key: 'r', label: 'Pluie sur 24 h', unit: 'mm', d: 1, text: 'Pluie cumulée sur les 24 heures précédant midi.' },
  { ic: 'leaf', key: 'ffmc', label: 'Végétation fine (FFMC)', unit: '', d: 1, text: 'Humidité des feuilles et brindilles mortes : plus la valeur est haute, plus elles sont sèches.' },
  { ic: 'sun', key: 'dmc', label: 'Humus (DMC)', unit: '', d: 1, text: 'Humidité de la couche d’humus : plus la valeur est haute, plus elle est sèche.' },
  { ic: 'gauge', key: 'dc', label: 'Sécheresse profonde (DC)', unit: '', d: 1, text: 'Sécheresse des couches profondes du sol, qui évolue lentement : plus la valeur est haute, plus la sécheresse est installée.' },
];
const condItemsHtml = (w) => CONDITIONS.filter((c) => w[c.key] !== null && w[c.key] !== undefined)
  .map((c) => `<div class="cond__item"><div class="eyebrow">${ic(c.ic)}${c.label}</div><p class="cond__val">${fmt(w[c.key], c.d)}${c.unit ? `<small>${c.unit}</small>` : ''}</p><p>${c.text}</p></div>`).join('');

function meaningHtml(d, r, D) {
  const l = r.level;
  const parts = [`<p><strong>Niveau ${l} — ${LEVELS[l].label}</strong> (${LEVELS[l].range}). ${MEANING[l]}</p>`];
  if (r.fwi !== null) {
    if (l < 4) {
      const next = THRESHOLDS[l - 1];
      const gap = Math.round((next - r.fwi) * 10) / 10;
      parts.push(`<p>L’indice est de ${fmt(r.fwi)} : il manque ${fmt(gap)} ${plural(gap, 'point')} pour atteindre le niveau ${l + 1} (${fmt(next)}).</p>`);
    } else {
      const over = Math.round((r.fwi - THRESHOLDS[2]) * 10) / 10;
      parts.push(`<p>L’indice est de ${fmt(r.fwi)}, soit ${fmt(over)} ${plural(over, 'point')} au-dessus du seuil du niveau 4 (${fmt(THRESHOLDS[2])}).</p>`);
    }
  }
  const tr = trend(D);
  if (tr) parts.push(`<p>Évolution entre le ${dayDate(snap.dataDate, 1, true)} et le ${dayDate(snap.dataDate, 2, true)} : ${tr.text.replace(/ entre demain et après-demain$/, '').charAt(0).toLowerCase()}${tr.text.replace(/ entre demain et après-demain$/, '').slice(1)}.</p>`);
  parts.push(`<p class="fine-print">Le niveau est calculé au chef-lieu (${esc(d.prefecture)}) : il peut différer ailleurs dans le département, notamment sur le littoral ou en altitude.</p>`);
  return parts.join('');
}

/** Synthèse chiffrée : texte + tableau, générés à partir du dernier calcul et rattachés à sa date. */
function deptResumeHtml(d, loc, neighbors, regionMembers) {
  const D = snap.byCode.get(d.code);
  const point = `<p>Le niveau est calculé au chef-lieu, ${esc(d.prefecture)} (${coord(CHEF_LIEU[d.code])}). ${esc(d.name)} compte ${neighbors.length} ${plural(neighbors.length, 'département')} limitrophe${neighbors.length >= 2 ? 's' : ''} : ${neighbors.map((n) => `<a href="${url(n)}">${esc(n.name)}</a>`).join(', ')}.</p>`;
  const r = snap.ok ? reading(D, snap.defaultDay) : { level: null };
  if (!snap.ok || r.level === null) {
    return `<section class="card" id="resume" aria-labelledby="t-resume"><h2 id="t-resume">Point de calcul et voisinage</h2><div class="prose">${point}<p>Aucune prévision n’est disponible dans le dernier calcul. Les niveaux sont recalculés chaque jour, toute l’année.</p></div></section>`;
  }
  const k = snap.defaultDay;
  const pts = snap.days.map((kk) => ({ kk, ...reading(D, kk) })).filter((p) => p.level !== null);
  const cmp = compareFwi(snap, d.code, k);
  const rows = regionMembers.map((m) => ({ m, ...reading(snap.byCode.get(m.code), k) })).filter((x) => x.level !== null);
  const hot = rows.filter((x) => x.level >= 3).length;
  const tr = trend(D);
  const lines = [];
  lines.push(`<p>Le niveau de risque d’incendie de forêt ${loc} est de <strong>${r.level} (${LEVELS[r.level].label.toLowerCase()})</strong> le ${dayFull(k)}, avec un indice FWI de <strong>${fmt(r.fwi)}</strong> au chef-lieu.</p>`);
  if (pts.length > 1) {
    let s = `Niveaux prévus : ${pts.map((p) => `${p.level} le ${dayDate(snap.dataDate, p.kk, true)}`).join(', ')}.`;
    if (tr) {
      const when = `entre le ${dayDate(snap.dataDate, 1, true)} et le ${dayDate(snap.dataDate, 2, true)}`;
      s += tr.dir === 'flat' ? ` L’indice reste stable ${when} (écart inférieur à 1 point).` : ` L’indice est en ${tr.dir === 'up' ? 'hausse' : 'baisse'} de ${fmt(Math.abs(tr.delta))} point${Math.abs(tr.delta) >= 2 ? 's' : ''} ${when}.`;
    }
    lines.push(`<p>${s}</p>`);
  }
  if (cmp && cmp.others > 0) {
    const vb = (n) => (n === 0 ? 'aucun n’a' : `${n} ${n >= 2 ? 'ont' : 'a'}`);
    lines.push(`<p>Ce jour-là, parmi les ${cmp.others + 1} départements, ${vb(cmp.higher)} un indice FWI plus élevé que celui de ce département ; ${vb(cmp.lower)} un indice plus faible${cmp.same ? ` (${cmp.same} à égalité)` : ''}.</p>`);
  }
  if (rows.length > 1) lines.push(`<p>${hot > 0 ? `Dans la région ${esc(d.region)}, ${hot} ${plural(hot, 'département')} sur ${rows.length} ${hot >= 2 ? 'sont' : 'est'} au niveau 3 ou plus ce jour-là.` : `Dans la région ${esc(d.region)}, aucun des ${rows.length} départements n’est au niveau 3 ou plus ce jour-là.`}</p>`);
  const nbRows = neighbors.map((n) => ({ n, ...reading(snap.byCode.get(n.code), k) })).filter((x) => x.level !== null);
  if (nbRows.length) lines.push(`<p>Départements limitrophes : ${nbRows.map((x) => `${deptLink(x.n)}, niveau ${x.level} (indice ${fmt(x.fwi)})`).join(' ; ')}.</p>`);
  const hasMeteo = pts.some((p) => p.w);
  const head = `<th scope="col">Échéance</th><th scope="col">Niveau</th><th scope="col">Indice FWI</th>${hasMeteo ? '<th scope="col">Temp. (°C)</th><th scope="col">Humidité (%)</th><th scope="col">Vent (km/h)</th><th scope="col">Pluie 24 h (mm)</th><th scope="col">FFMC</th><th scope="col">DMC</th><th scope="col">DC</th>' : ''}`;
  const val = (p, key, dg) => `<td class="n">${p.w && p.w[key] !== null && p.w[key] !== undefined ? fmt(p.w[key], dg) : '—'}</td>`;
  const body = pts.map((p) => `<tr><th scope="row">${dayFull(p.kk)}</th><td>${badgeHtml(p.level, 'sm')}</td><td class="n">${fmt(p.fwi)}</td>${hasMeteo ? `${val(p, 't', 1)}${val(p, 'h', 0)}${val(p, 'w', 1)}${val(p, 'r', 1)}${val(p, 'ffmc', 1)}${val(p, 'dmc', 1)}${val(p, 'dc', 1)}` : ''}</tr>`).join('');
  return `<section class="card" id="resume" aria-labelledby="t-resume" data-snap="${snap.fileDate}">
              <div class="eyebrow">Résumé chiffré</div>
              <h2 id="t-resume">Situation ${loc} le ${dayFull(k)}</h2>
              <div class="prose">${lines.join('')}</div>
              <div class="table-scroll"><table class="lvtable"><caption class="sr-only">Niveau et indice FWI par échéance pour ${esc(d.name)}</caption><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
              <div class="prose">${point}</div>
              <p class="fine-print">Calcul Vigi-FR du <time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time> à partir des prévisions Open-Meteo.com (CC BY 4.0). Valeurs à midi, heure de Paris. Données complètes : <a href="/donnees/">fichier JSON ouvert</a> ; méthode : <a href="/methodologie/">Méthodologie</a>.</p>
            </section>`;
}

function deptPage(d) {
  const info = map.depts[d.code];
  const loc = LOC[d.code];
  const neighbors = info.neighbors.map((c) => byCode.get(c)).filter(Boolean);
  const regionMembers = depts.filter((x) => x.region === d.region);
  const sameRegion = regionMembers.filter((x) => x.code !== d.code);
  let title = `Risque incendie de forêt ${loc} (${d.code}) : niveau et prévisions | Vigi-FR`;
  if (title.length > 78) title = `Risque incendie de forêt ${loc} (${d.code}) | Vigi-FR`;
  let description = `Risque d’incendie de forêt ${loc} (${d.code}), ${d.region} : niveau, indice FWI et conseils, recalculés chaque jour au chef-lieu (${d.prefecture}).`;
  if (description.length > 165) description = `Risque d’incendie de forêt ${loc} (${d.code}), ${d.region} : niveau, indice FWI et conseils au chef-lieu (${d.prefecture}).`;
  const listed = [];
  for (const n of neighbors) { if ((`${description} Voisins : ${[...listed, n.name].join(', ')}.`).length <= 165) listed.push(n.name); else break; }
  if (listed.length) description += ` Voisins : ${listed.join(', ')}.`;
  const path = url(d);
  const k = snap.defaultDay;
  const D = snap.byCode.get(d.code);
  const r = snap.ok ? reading(D, k) : { level: null, fwi: null, w: null };
  const ok = snap.ok && r.level !== null;
  const jsonld = graph(
    webPage({ path, title, description, modified: snap.ok ? snap.fileDate : null, extra: { about: { '@type': 'AdministrativeArea', name: d.name, identifier: d.code, containedInPlace: { '@type': 'AdministrativeArea', name: d.region } } } }),
    breadcrumb(path, [['Accueil', '/'], [d.region, regionUrl(d.region)], [`${d.name} (${d.code})`, path]]),
  );
  const adviceItems = (l) => adviceFor(l, d.prefecture).map((t) => `<li>${esc(t)}</li>`).join('');
  const nbSlot = (n) => {
    if (!ok) return { l: 0, html: '' };
    const x = reading(snap.byCode.get(n.code), k);
    return { l: x.level ?? 0, html: x.level ? `${badgeHtml(x.level, 'sm')}${x.fwi !== null ? `<span class="code">FWI ${fmt(x.fwi)}</span>` : ''}` : '' };
  };
  const chartTable = ok ? `<caption>Indice FWI et niveau par échéance</caption><thead><tr><th scope="col">Échéance</th><th scope="col">Indice FWI</th><th scope="col">Niveau</th></tr></thead><tbody>${snap.days.map((kk) => ({ kk, ...reading(D, kk) })).filter((p) => p.level !== null).map((p) => `<tr><th scope="row">${dayFull(p.kk)}</th><td>${fmt(p.fwi)}</td><td>${p.level} — ${LEVELS[p.level].label}</td></tr>`).join('')}</tbody>` : '';
  const panel = ok
    ? `<div class="now__panel" id="now-panel" data-l="${r.level}" aria-live="polite"><div class="now__body"><p class="now__date" id="now-date">Niveau du ${dayFull(k)}</p><div id="now-badge">${badgeHtml(r.level, 'lg')}</div><p class="now__big"><span class="num" id="now-fwi">${fmt(r.fwi)}</span><small>Indice FWI</small></p><p class="now__hint" id="now-hint">${LEVELS[r.level].hint}</p></div><div class="dial">${dialSvg(r.level, r.fwi)}</div></div>`
    : `<div class="now__panel skeleton sk-now" id="now-panel" data-l="0" aria-live="polite"></div>`;
  const lv = ok ? r.level : 3;
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="${regionUrl(d.region)}">${esc(d.region)}</a></li><li aria-current="page">${esc(d.name)} (${d.code})</li></ol></nav>
      <div id="dept-root" data-code="${d.code}" data-pref="${esc(d.prefecture)}">
        <header class="dhead">
          <h1 id="titre-principal"><span class="dhead__kicker">Risque d’incendie de forêt&nbsp;:</span>${esc(d.name)} <span class="dhead__code"><span class="sr-only">(</span>${d.code}<span class="sr-only">)</span></span></h1>
          <div class="dhead__meta"><span>${ic('pin')} <a href="${regionUrl(d.region)}">${esc(d.region)}</a></span><span>${ic('building')} Préfecture : ${esc(d.prefecture)}</span><span id="dept-badge">${ok ? `${badgeHtml(r.level, 'lg')}<span class="sr-only"> ${dayFull(k)}</span>` : ''}</span></div>
          <p class="lead">Suivi du risque d’incendie de forêt ${loc} (${d.code}), département de la région ${esc(d.region)} dont la préfecture est ${esc(d.prefecture)} : niveau, indice forêt-météo (FWI), conditions météo et conseils de vigilance, recalculés chaque jour.</p>
        </header>

        <section class="now" aria-labelledby="t-now">
          <h2 class="sr-only" id="t-now">Niveau de risque par échéance</h2>
          <div id="dtabs" class="tabs skeleton sk-tabs"></div>
          ${panel}
          <p class="fine-print">Dernier calcul : <span data-update>${snap.ok ? `<time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>` : 'indisponible'}</span>. Niveaux recalculés chaque jour, toute l’année, au chef-lieu (${esc(d.prefecture)}).</p>
        </section>

        <div class="stack section">
          ${deptResumeHtml(d, loc, neighbors, regionMembers)}

          <section class="card chart-card" id="chart-card" aria-labelledby="t-chart">
            <div><div class="eyebrow">Évolution de l’indice</div><h2 id="t-chart">Indice FWI par échéance</h2></div>
            <figure class="chart"><div id="chart"><span class="skeleton sk-chart"></span></div><figcaption class="fine-print">Les bandes colorées correspondent aux quatre niveaux. Seuils : ${THRESHOLDS.map(fr).join(' ; ')}.</figcaption></figure>
            <table class="sr-only" id="chart-table">${chartTable}</table>
          </section>

          <section class="card" id="conditions" aria-labelledby="cond-title"${ok && r.w && condItemsHtml(r.w) ? '' : ' hidden'}>
            <div class="eyebrow">Météo et sécheresse</div>
            <h2 id="cond-title">${ok && r.w ? `Conditions le ${dayFull(k)}` : 'Conditions'}</h2>
            <div class="cond" id="cond-grid">${ok && r.w ? condItemsHtml(r.w) : ''}</div>
            <p class="fine-print">Valeurs calculées à midi (heure de Paris), au chef-lieu, à partir des prévisions Open-Meteo.</p>
          </section>

          <div class="two-col">
            <section class="card card--lv" id="meaning" data-l="${ok ? r.level : 0}" aria-labelledby="t-meaning">
              <h2 id="t-meaning">Ce que cela signifie</h2>
              <div class="prose" id="meaning-body">${ok ? meaningHtml(d, r, D) : `<p>${LEVELS[3].hint} Le niveau exact et l’indice FWI de ${esc(d.name)} s’affichent dès que les données sont chargées.</p>`}</div>
            </section>
            <section class="card card--lv" id="advice" data-l="${ok ? r.level : 0}" aria-labelledby="advice-title">
              <h2 id="advice-title">${ok ? `Conseils de vigilance · niveau ${r.level}` : 'Que faire en cas de risque élevé ?'}</h2>
              <ul class="advice" id="advice-list">${adviceItems(lv)}</ul>
              <details class="levels-fold" id="levels-fold"><summary>Conseils pour chaque niveau</summary>
                <dl>${[1, 2, 3, 4].map((l) => `<div data-level="${l}"${ok && l === r.level ? ' data-current' : ''}><dt>${badgeHtml(l, 'sm')}</dt><dd><ul class="advice">${adviceItems(l)}</ul></dd></div>`).join('')}</dl>
              </details>
            </section>
          </div>

          <section aria-labelledby="t-nb">
            <h2 class="h-sm" id="t-nb">Départements limitrophes</h2>
            <div class="neighbors">${neighbors.map((n) => { const s = nbSlot(n); return `<a href="${url(n)}" data-code="${n.code}" data-l="${s.l}"><span class="code">${n.code}</span><span class="name">${esc(n.name)}</span><span class="slot">${s.html}</span></a>`; }).join('')}</div>
          </section>

          ${sameRegion.length ? `<section aria-labelledby="t-region">
            <h2 class="h-sm" id="t-region">Autres départements : ${esc(d.region)}</h2>
            <div class="chips">${sameRegion.map((n) => `<a href="${url(n)}">${esc(n.name)} (${n.code})</a>`).join('')}<a href="${regionUrl(d.region)}">Synthèse ${esc(REGION_LOC[d.region])}</a><a href="/#departements">Tous les départements</a></div>
          </section>` : `<section aria-labelledby="t-region"><h2 class="h-sm" id="t-region">Région ${esc(d.region)}</h2><div class="chips"><a href="${regionUrl(d.region)}">Synthèse ${esc(REGION_LOC[d.region])}</a><a href="/#departements">Tous les départements</a></div></section>`}

          <aside class="card" role="note" aria-labelledby="titre-avertissement">
            <h2 id="titre-avertissement">Information et sécurité</h2>
            <div class="prose"><p>Vigi-FR est un outil d’information. Il ne remplace ni les consignes des autorités (préfectures, mairies, sapeurs-pompiers) ni les arrêtés locaux. <strong>En cas d’urgence, appelez le 18 ou le 112.</strong> Pour comprendre les différences entre les cartes de risque, lisez <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux</a> ; pour les obligations de débroussaillement, <a href="/guide/debroussaillement-obligatoire/">le guide dédié</a>.</p></div>
          </aside>
        </div>
      </div>
    </div>
  </main>`;
  return page(head({ title, description, path, jsonld, scripts: ['dept.js'] }), 'depts', body);
}

/* ------------------------------------------------------------------ */
/* Méthodologie et à propos                                             */
/* ------------------------------------------------------------------ */
function methodPage() {
  const title = 'Méthodologie : comment est calculé le risque d’incendie | Vigi-FR';
  const description = 'Indice forêt-météo (FWI), données Open-Meteo, niveaux de risque et limites de la méthode utilisée par Vigi-FR pour estimer le risque d’incendie de forêt par département.';
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Méthodologie</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">Méthodologie</div>
        <h1 class="display">Comment est calculé <em>le risque</em></h1>
        <p class="lead">Vigi-FR ne reprend pas un bulletin officiel : le site calcule lui-même un indice reconnu, à partir de prévisions météo publiques. Voici les étapes, les seuils et les limites.</p>
      </div>
      <div class="stack section">
        <div class="prose">
          <h2>Le principe</h2>
          <p>Pour chaque département de France métropolitaine, Vigi-FR calcule l’<strong>indice forêt-météo canadien (FWI)</strong>, selon les équations de Van Wagner (1987). Le calcul est refait chaque jour, toute l’année, au chef-lieu du département.</p>
          <h2>Les données d’entrée</h2>
          <ul>
            <li><strong>Température, humidité relative, vent à 10 m et pluie</strong>, en valeurs horaires, fournis par Open-Meteo.com pour le chef-lieu de chaque département.</li>
            <li><strong>Heure de calcul : 12 h, heure de Paris.</strong> La pluie est cumulée sur les 24 heures précédentes.</li>
            <li><strong>Amorçage :</strong> la série est calculée sur les 30 derniers jours, puis sur aujourd’hui, demain et après-demain. Les périodes sèches ou humides récentes sont ainsi prises en compte.</li>
          </ul>
          <h2>Du calcul au niveau</h2>
          <ul>
            <li><strong>FFMC</strong> : humidité des combustibles fins (feuilles et brindilles mortes). Elle réagit en quelques heures.</li>
            <li><strong>DMC</strong> : humidité de la couche d’humus, qui évolue sur quelques jours à quelques semaines.</li>
            <li><strong>DC</strong> : sécheresse des couches profondes, qui évolue sur plusieurs semaines.</li>
            <li><strong>ISI</strong> (vitesse de propagation) combine le FFMC et le vent. <strong>BUI</strong> (quantité de combustible disponible) combine le DMC et le DC.</li>
            <li><strong>FWI</strong> combine l’ISI et le BUI. Plus il est élevé, plus un feu démarre et se propage facilement.</li>
          </ul>
        </div>
        <div>
          <h2 class="h-sm">Les quatre niveaux</h2>
          <div class="table-scroll"><table class="lvtable">
            <thead><tr><th scope="col">Niveau</th><th scope="col">Indice FWI</th><th scope="col">Signification</th></tr></thead>
            <tbody>${[1, 2, 3, 4].map((l) => `<tr data-l="${l}"><td><span class="badge" data-l="${l}">${ic(l)}<span>${l} — ${LEVELS[l].label}</span></span></td><td class="mono">${LEVELS[l].range.replace('FWI ', '')}</td><td>${esc(LEVELS[l].hint)}</td></tr>`).join('')}</tbody>
          </table></div>
          <p class="fine-print">Les seuils (11,2 ; 21,3 ; 38) sont ceux des classes de danger du système européen d’information sur les feux de forêt (EFFIS), qui en compte six : Vigi-FR regroupe les deux classes les plus basses (niveau 1) et les deux plus hautes (niveau 4). Les niveaux concernent uniquement la France métropolitaine. <a href="/guide/indice-foret-meteo-fwi/">En savoir plus sur l’indice et ses classes</a>.</p>
        </div>
        <div class="prose">
          <h2>Limites à connaître</h2>
          <ul>
            <li><strong>Ce n’est pas une prévision officielle.</strong> Les niveaux ne proviennent pas de la Météo des forêts de Météo-France : ils sont calculés par le site, et peuvent différer (voir <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux</a>).</li>
            <li><strong>Un point par département.</strong> Le calcul est fait au chef-lieu. Un massif éloigné du chef-lieu, ou un département contrasté (par exemple un littoral et un relief), peut avoir un niveau réel différent.</li>
            <li><strong>Un outil d’information.</strong> Seuls les arrêtés des préfectures et les consignes des autorités et des sapeurs-pompiers font foi. En cas d’urgence : 18 ou 112.</li>
          </ul>
          <h2>Sources et licences</h2>
          <ul>
            <li>Prévisions météo : <a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo.com<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>, sous <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" rel="noopener noreferrer" target="_blank">licence CC BY 4.0<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</li>
            <li>Van Wagner, C.E. (1987), <em>Development and structure of the Canadian Forest Fire Weather Index System</em>, Forestry Technical Report 35, Canadian Forestry Service.</li>
            <li>Classes de niveau : <a href="https://effis.jrc.ec.europa.eu/" rel="noopener noreferrer" target="_blank">EFFIS<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</li>
            <li>Les niveaux publiés sont téléchargeables au format JSON : <a href="/data/fwi.json">/data/fwi.json</a>, documenté sur la page <a href="/donnees/">Données ouvertes</a>.</li>
          </ul>
          <p>Retrouvez les niveaux du jour sur <a href="/#carte">la carte nationale</a>.</p>
        </div>
      </div>
    </div>
  </main>`;
  const jsonld = graph(
    webPage({ path: '/methodologie/', title, description, modified: PAGE_DATES.methodologie, extra: { citation: { '@type': 'CreativeWork', name: 'Van Wagner, C.E. (1987), Development and structure of the Canadian Forest Fire Weather Index System, Forestry Technical Report 35, Canadian Forestry Service' } } }),
    breadcrumb('/methodologie/', [['Accueil', '/'], ['Méthodologie', '/methodologie/']]),
  );
  return page(head({ title, description, path: '/methodologie/', jsonld }), 'methodologie', body);
}


/* ------------------------------------------------------------------ */
/* Pages légales : confidentialité et conditions d’utilisation           */
/* ------------------------------------------------------------------ */
function legalPage({ path, title, description, crumb, h1, lead, sections }) {
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="/a-propos/">À propos</a></li><li aria-current="page">${esc(crumb)}</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">Mentions</div>
        <h1 class="display">${h1}</h1>
        <p class="lead">${lead}</p>
      </div>
      <div class="stack section">
        <div class="prose">
${sections.map(([h, ...ps]) => `          <h2>${h}</h2>\n${ps.map((x) => `          <p>${x}</p>`).join('\n')}`).join('\n')}
          <p class="fine-print">Dernière mise à jour : ${frDate(PAGE_DATES.legal)}. Voir aussi la page <a href="/a-propos/">À propos et indépendance</a>.</p>
        </div>
      </div>
    </div>
  </main>`;
  const jsonld = graph(
    webPage({ path, title, description, modified: PAGE_DATES.legal }),
    breadcrumb(path, [['Accueil', '/'], ['À propos', '/a-propos/'], [crumb, path]]),
  );
  return page(head({ title, description, path, jsonld }), 'apropos', body);
}

const privacyPage = () => legalPage({
  path: '/politique-de-confidentialite/',
  title: 'Politique de confidentialité | Vigi-FR',
  description: 'Vigi-FR ne collecte aucune donnée personnelle : ni cookie, ni outil de mesure d’audience, ni service tiers. Hébergement, liens sortants et contact.',
  crumb: 'Politique de confidentialité',
  h1: 'Politique de <em>confidentialité</em>',
  lead: 'Vigi-FR ne collecte aucune donnée personnelle. Cette page explique ce que le site fait, ou ne fait pas, quand vous le consultez.',
  sections: [
    ['Données collectées', 'Le site ne comporte ni formulaire, ni compte, ni cookie, ni outil de mesure d’audience. Les polices, les scripts et les données météo sont servis par le site lui-même. Aucune donnée personnelle n’est donc demandée, enregistrée ni transmise à un tiers par Vigi-FR.'],
    ['Stockage dans votre navigateur', 'Le site n’écrit rien dans votre navigateur : ni cookie, ni stockage local. La recherche de département et la carte fonctionnent à partir de fichiers publics chargés depuis le site, sans identifiant.'],
    ['Hébergement', 'Le site est hébergé par Vercel. Comme tout hébergeur, celui-ci peut conserver des journaux techniques de connexion, par exemple l’adresse IP, la date et la page demandée, pour assurer la sécurité et le bon fonctionnement du service. Vigi-FR n’utilise aucun outil pour identifier ses visiteurs.'],
    ['Liens sortants', 'Le site renvoie vers des sites officiels, comme Météo-France, EFFIS ou le ministère de la Transition écologique. Ces liens ne s’ouvrent que si vous cliquez dessus. Cependant, votre navigateur peut résoudre à l’avance le nom de domaine de ces sites. Leur propre politique de confidentialité s’applique ensuite.'],
    ['Vos droits et contact', `Aucune donnée personnelle n’étant collectée par Vigi-FR, il n’y a rien à consulter, corriger ou effacer chez lui. Pour toute question sur cette politique, ouvrez un <a href="${ISSUES}" rel="noopener noreferrer" target="_blank">signalement sur GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a> : le site n’affiche pas d’adresse e-mail. Vous pouvez aussi saisir la ${extLink('https://www.cnil.fr/', 'CNIL')}.`],
  ],
});

const termsPage = () => legalPage({
  path: '/conditions-d-utilisation/',
  title: 'Conditions d’utilisation | Vigi-FR',
  description: 'Conditions d’utilisation de Vigi-FR : usage libre et gratuit, niveaux fournis à titre d’information sans valeur réglementaire, licences des données et du code.',
  crumb: 'Conditions d’utilisation',
  h1: 'Conditions <em>d’utilisation</em>',
  lead: 'Vigi-FR est un site d’information libre et gratuit. Ces conditions précisent ce que vous pouvez en attendre et comment réutiliser ses données.',
  sections: [
    ['Objet du site', 'Vigi-FR publie chaque jour un niveau de risque d’incendie de forêt, de 1 à 4, pour les 96 départements de France métropolitaine. Il le calcule à partir de prévisions météo et de l’indice forêt-météo (FWI). La page <a href="/methodologie/">Méthodologie</a> décrit ce calcul.'],
    ['Usage libre et gratuit', 'La consultation du site est libre et gratuite, sans inscription. Vous pouvez en citer les pages et en réutiliser les données dans le respect des licences indiquées plus bas.'],
    ['Information sans valeur réglementaire', 'Les niveaux sont fournis à titre d’information. Ils n’ont aucune valeur réglementaire et ne remplacent ni les arrêtés préfectoraux ni les consignes des secours. Seuls ces textes fixent les restrictions d’accès aux massifs et d’usage du feu. <strong>En cas d’urgence, appelez le 18 ou le 112.</strong>'],
    ['Absence de garantie', 'Les niveaux reposent sur des prévisions météo et sur un calcul simplifié au chef-lieu de chaque département. Le site est fourni tel quel, sans garantie d’exactitude ni de disponibilité. Aucune décision de sécurité ne doit donc reposer sur le seul niveau affiché.'],
    ['Réutilisation et licences', `Les données sont publiées sous licence ${extLink('https://creativecommons.org/licenses/by/4.0/deed.fr', 'CC BY 4.0')} : citez Vigi-FR et Open-Meteo.com. Le code du site est distribué sous licence MIT, qui ne s’applique pas aux données d’Open-Meteo. La page <a href="/donnees/">Données ouvertes</a> décrit le fichier JSON.`],
    ['Liens sortants', 'Le site renvoie vers des sites tiers, cités comme sources. Vigi-FR n’en contrôle pas le contenu et n’est pas responsable de leur disponibilité.'],
    ['Signalements et évolution des conditions', `Une erreur dans un niveau, un texte ou une source ? Signalez-la sur la page des <a href="${ISSUES}" rel="noopener noreferrer" target="_blank">signalements GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>. Ces conditions peuvent évoluer ; la date de dernière mise à jour figure en bas de page.`],
  ],
});

function aboutPage() {
  const title = 'À propos de Vigi-FR | Vigi-FR';
  const description = 'Vigi-FR est un site indépendant qui publie le niveau de risque d’incendie de forêt de chaque département de France métropolitaine. Données, licences et vie privée.';
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">À propos</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">À propos</div>
        <h1 class="display">Un site <em>indépendant</em>, au service de la vigilance</h1>
        <p class="lead">Vigi-FR publie, chaque jour, le niveau de risque d’incendie de forêt de chaque département de France métropolitaine.</p>
      </div>
      <div class="stack section">
        <div class="prose">
          <h2>Ce que fait le site</h2>
          <p>Il calcule l’indice forêt-météo (FWI) à partir de prévisions météo et le traduit en quatre niveaux, de Faible à Très élevé, pour les prochains jours. Il est disponible toute l’année. Le détail du calcul est sur la page <a href="/methodologie/">Méthodologie</a>.</p>
          <h2>Ce que le site n’est pas</h2>
          <p>Vigi-FR n’est ni un bulletin officiel, ni un service de Météo-France, ni une consigne des autorités. Il ne remplace pas les arrêtés des préfectures. Il est indépendant et n’est affilié ni à Open-Meteo ni à Météo-France. <strong>En cas d’urgence, appelez le 18 ou le 112.</strong></p>
          <h2>Données et licences</h2>
          <ul>
            <li>Les prévisions météo viennent d’<a href="https://open-meteo.com/" rel="noopener noreferrer" target="_blank">Open-Meteo.com<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>, sous <a href="https://creativecommons.org/licenses/by/4.0/deed.fr" rel="noopener noreferrer" target="_blank">licence CC BY 4.0<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</li>
            <li>Les contours des départements viennent de l’IGN (Admin Express), dans une version simplifiée par Grégoire David, sous Licence ouverte.</li>
            <li>Le code du site est distribué sous licence MIT. Cette licence ne s’applique pas aux données d’Open-Meteo.</li>
            <li>Polices Instrument Serif et Geist, sous licence SIL Open Font.</li>
          </ul>
          <h2 id="conditions">Conditions d’utilisation</h2>
          <p>L’utilisation du site est libre et gratuite. Les niveaux sont fournis à titre d’information, sans valeur réglementaire. Ils ne remplacent ni les arrêtés préfectoraux ni les consignes des secours. Les données sont réutilisables sous licence CC BY 4.0 : citez Vigi-FR et Open-Meteo.com. Le texte complet figure sur la page <a href="/conditions-d-utilisation/">Conditions d’utilisation</a>.</p>
          <h2 id="confidentialite">Vie privée et confidentialité</h2>
          <p>Aucune donnée personnelle n’est collectée par le site. Les données météo sont chargées depuis le site lui-même : votre navigateur n’appelle aucun service tiers. Le détail figure sur la page <a href="/politique-de-confidentialite/">Politique de confidentialité</a>.</p>
          <h2>Code source</h2>
          <p>Le code est public : <a href="${GITHUB}" rel="noopener noreferrer" target="_blank">Code source sur GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</p>
          <h2 id="contact">Contact, corrections et signalements</h2>
          <p>Le site n’affiche pas d’adresse e-mail : le canal de contact est GitHub. Une erreur dans un niveau, un texte ou une source ? Signalez-la sur la page des <a href="${ISSUES}" rel="noopener noreferrer" target="_blank">signalements GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>. Les guides citent leurs sources et indiquent leur date de mise à jour ; les niveaux affichent la date de leur dernier calcul.</p>
          <h2>Pour aller plus loin</h2>
          <p>Retrouvez les explications pédagogiques dans les <a href="/guide/">guides</a>, la <a href="/methodologie/">méthodologie</a> et la documentation des <a href="/donnees/">données ouvertes</a>.</p>
        </div>
      </div>
    </div>
  </main>`;
  const jsonld = graph(
    webPage({ path: '/a-propos/', title, description, type: 'AboutPage', modified: PAGE_DATES.apropos, extra: { mainEntity: { '@id': ORG_ID } } }),
    breadcrumb('/a-propos/', [['Accueil', '/'], ['À propos', '/a-propos/']]),
  );
  return page(head({ title, description, path: '/a-propos/', jsonld }), 'apropos', body);
}

/* ------------------------------------------------------------------ */
/* Pages régionales : synthèse par région (index de navigation + niveaux du dernier calcul) */
/* ------------------------------------------------------------------ */
function regionPage(region) {
  const path = regionUrl(region);
  const members = depts.filter((d) => d.region === region);
  const rloc = REGION_LOC[region];
  const names = members.map((d) => d.name);
  let title = `Risque incendie de forêt ${rloc} : niveau par département | Vigi-FR`;
  if (title.length > 75) title = `Risque incendie de forêt ${rloc} | Vigi-FR`;
  let description = `Niveau de risque d’incendie de forêt des ${members.length} départements ${rloc}, recalculé chaque jour avec l’indice forêt-météo (FWI).`;
  const room = 165 - description.length - 2;
  const list = []; for (const n of names) { if ([...list, n].join(', ').length + 4 <= room) list.push(n); else break; }
  if (list.length >= 2) description += ` ${list.join(', ')}…`;
  const k = snap.defaultDay;
  const jsonld = graph(
    webPage({ path, title, description, modified: snap.ok ? snap.fileDate : null, extra: { about: { '@type': 'AdministrativeArea', name: region }, mainEntity: { '@type': 'ItemList', name: `Départements ${rloc}`, numberOfItems: members.length, itemListElement: members.map((d, i) => ({ '@type': 'ListItem', position: i + 1, name: `${d.name} (${d.code})`, url: `${SITE}departement/${d.slug}/` })) } } }),
    breadcrumb(path, [['Accueil', '/'], [region, path]]),
  );
  let summary = '';
  let table;
  if (snap.ok) {
    const rows = members.map((d) => ({ d, D: snap.byCode.get(d.code), ...reading(snap.byCode.get(d.code), k) }));
    const withData = rows.filter((x) => x.level !== null);
    const { counts } = countsFor({ ...snap, byCode: new Map(members.map((d) => [d.code, snap.byCode.get(d.code)]).filter(([, v]) => v)) }, k);
    const hot = withData.filter((x) => x.level >= 3).length;
    const top = [...withData].sort((a, b) => b.level - a.level || (b.fwi ?? 0) - (a.fwi ?? 0) || a.d.code.localeCompare(b.d.code))[0];
    summary = `<p>Le ${dayFull(k)}, ${hot > 0 ? `${hot} ${plural(hot, 'département')} sur ${withData.length} ${hot >= 2 ? 'sont' : 'est'} au niveau 3 ou plus` : `aucun des ${withData.length} départements n’est au niveau 3 ou plus`} ${rloc}. ${statesLine(counts) ? `Répartition : ${statesLine(counts)}. ` : ''}${top && top.fwi !== null ? `L’indice FWI le plus élevé de la région est de ${fmt(top.fwi)}, à ${esc(top.d.name)} (${top.d.code}).` : ''}</p>`;
    const dayCols = snap.days;
    table = `<div class="table-scroll"><table class="lvtable"><caption class="sr-only">Niveaux de risque d’incendie de forêt ${esc(rloc)} par département</caption><thead><tr><th scope="col">Département</th><th scope="col">Préfecture (point de calcul)</th>${dayCols.map((kk) => `<th scope="col">Niveau, ${dayDate(snap.dataDate, kk)}</th>`).join('')}<th scope="col">Indice FWI, ${dayDate(snap.dataDate, k)}</th></tr></thead><tbody>${rows.map((x) => `<tr><th scope="row"><a href="${url(x.d)}"><span class="code">${x.d.code}</span>${esc(x.d.name)}</a></th><td>${esc(x.d.prefecture)}</td>${dayCols.map((kk) => `<td>${badgeHtml(reading(x.D, kk).level, 'sm')}</td>`).join('')}<td class="n">${fmt(x.fwi)}</td></tr>`).join('')}</tbody></table></div>`;
  } else {
    table = `<div class="table-scroll"><table class="lvtable"><thead><tr><th scope="col">Département</th><th scope="col">Préfecture (point de calcul)</th></tr></thead><tbody>${members.map((d) => `<tr><th scope="row"><a href="${url(d)}"><span class="code">${d.code}</span>${esc(d.name)}</a></th><td>${esc(d.prefecture)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">${esc(region)}</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">Synthèse régionale</div>
        <h1 class="display">Risque d’incendie de forêt <em>${esc(rloc)}</em></h1>
        <p class="lead">${members.length} ${plural(members.length, 'département')} ${esc(rloc)} : ${names.map(esc).join(', ')}. Niveau de risque du dernier calcul, indice forêt-météo (FWI) et accès à la fiche de chaque département.</p>
      </div>
      <div class="stack section">
        <section class="card"${snap.ok ? ` data-snap-region="${snap.fileDate}"` : ''} aria-labelledby="t-reg">
          <h2 id="t-reg">${snap.ok ? `Situation ${esc(rloc)} le ${dayFull(k)}` : `Les départements ${esc(rloc)}`}</h2>
          ${summary ? `<div class="prose">${summary}</div>` : ''}
          ${table}
          <p class="fine-print">${snap.ok ? `Calcul Vigi-FR du <time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>, au chef-lieu de chaque département, à partir des prévisions Open-Meteo.com (CC BY 4.0). ` : ''}Les niveaux ne remplacent pas les arrêtés préfectoraux. <a href="/methodologie/">Méthodologie</a> · <a href="/guide/comparer-sources-risque-incendie/">Comparer les sources</a>.</p>
        </section>
        <section aria-labelledby="t-others">
          <h2 class="h-sm" id="t-others">Autres régions</h2>
          <div class="chips">${regionNames.filter((r) => r !== region).map((r) => `<a href="${regionUrl(r)}">${esc(r)}</a>`).join('')}<a href="/#departements">Tous les départements</a></div>
        </section>
        <aside class="card" role="note" aria-labelledby="titre-avertissement">
          <h2 id="titre-avertissement">Information et sécurité</h2>
          <div class="prose"><p>Vigi-FR est un outil d’information. Il ne remplace ni les consignes des autorités (préfectures, mairies, sapeurs-pompiers) ni les arrêtés locaux. <strong>En cas d’urgence, appelez le 18 ou le 112.</strong></p></div>
        </aside>
      </div>
    </div>
  </main>`;
  return page(head({ title, description, path, jsonld }), 'depts', body);
}

/* ------------------------------------------------------------------ */
/* Guides éditoriaux                                                    */
/* ------------------------------------------------------------------ */
const ext = (href, text) => `<a href="${href}" rel="noopener noreferrer" target="_blank">${text}<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>`;
const GUIDES = buildGuides({ ext });
const guideUrl = (g) => `/guide/${g.slug}/`;

function guidePage(g) {
  const path = guideUrl(g);
  const title = `${g.title} | Vigi-FR`;
  const pageId = `${SITE}${path.replace(/^\//, '')}#page`;
  const jsonld = graph(
    webPage({ path, title, description: g.description, type: 'WebPage', modified: GUIDE_DATES.modified, extra: { mainEntity: { '@id': `${SITE}${path.replace(/^\//, '')}#article` } } }),
    { '@type': 'Article', '@id': `${SITE}${path.replace(/^\//, '')}#article`, headline: g.title, description: g.description, inLanguage: 'fr-FR', datePublished: GUIDE_DATES.published, dateModified: GUIDE_DATES.modified, author: { '@id': ORG_ID }, publisher: { '@id': ORG_ID }, mainEntityOfPage: { '@id': pageId }, isPartOf: { '@id': WEBSITE_ID }, image: [`${SITE}assets/img/og-image.png`], citation: g.sources.map((s) => ({ '@type': 'CreativeWork', name: s.name, ...(s.url ? { url: s.url } : {}) })) },
    breadcrumb(path, [['Accueil', '/'], ['Guides', '/guide/'], [g.breadcrumbName, path]]),
  );
  const others = GUIDES.filter((x) => x.slug !== g.slug);
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="/guide/">Guides</a></li><li aria-current="page">${esc(g.breadcrumbName)}</li></ol></nav>
      <article>
        <div class="page-head">
          <div class="eyebrow eyebrow--ember">Guide</div>
          <h1 class="display">${g.h1}</h1>
          <p class="lead">${g.lead}</p>
          <p class="fine-print">Publié le <time datetime="${GUIDE_DATES.published}">${frDate(GUIDE_DATES.published)}</time>, mis à jour le <time datetime="${GUIDE_DATES.modified}">${frDate(GUIDE_DATES.modified)}</time>. Rédaction : Vigi-FR.</p>
        </div>
        <div class="stack section">
          <div class="prose">${g.body()}
          </div>
          <section class="card" aria-labelledby="t-src">
            <h2 id="t-src">Sources</h2>
            <ul class="sources">${g.sources.map((s) => `<li>${s.url ? ext(s.url, esc(s.name)) : esc(s.name)}</li>`).join('')}</ul>
            <p class="fine-print">Ce guide est un résumé pédagogique. Seuls les textes officiels et les arrêtés de votre préfecture font foi. Une erreur ? <a href="${ISSUES}" rel="noopener noreferrer" target="_blank">Signalez-la sur GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</p>
          </section>
          <section aria-labelledby="t-more">
            <h2 class="h-sm" id="t-more">À lire aussi</h2>
            <div class="chips">${others.map((x) => `<a href="${guideUrl(x)}">${esc(x.breadcrumbName)}</a>`).join('')}<a href="/methodologie/">Méthodologie</a><a href="/#carte">Carte nationale</a></div>
          </section>
        </div>
      </article>
    </div>
  </main>`;
  return page(head({ title, description: g.description, path, jsonld, ogType: 'article', published: GUIDE_DATES.published, modified: GUIDE_DATES.modified }), 'guides', body);
}

function guidesHubPage() {
  const path = '/guide/';
  const title = 'Guides : comprendre le risque d’incendie de forêt | Vigi-FR';
  const description = 'Guides pédagogiques et sourcés : indice forêt-météo (FWI), différences entre Météo des forêts et Vigi-FR, débroussaillement obligatoire.';
  const jsonld = graph(
    webPage({ path, title, description, type: 'CollectionPage', modified: GUIDE_DATES.modified, extra: { mainEntity: { '@type': 'ItemList', itemListElement: GUIDES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, name: g.title, url: `${SITE}guide/${g.slug}/` })) } } }),
    breadcrumb(path, [['Accueil', '/'], ['Guides', path]]),
  );
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Guides</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">Guides</div>
        <h1 class="display">Comprendre le risque <em>d’incendie de forêt</em></h1>
        <p class="lead">Des explications courtes, appuyées sur des sources publiques citées, pour interpréter les niveaux affichés sur Vigi-FR et sur les autres cartes.</p>
      </div>
      <div class="stack section">
        ${GUIDES.map((g) => `<article class="card"><h2><a href="${guideUrl(g)}">${esc(g.title)}</a></h2><p class="prose">${esc(g.description)}</p><p><a href="${guideUrl(g)}">Lire le guide ${ic('arrow', 'icon--arrow')}</a></p></article>`).join('\n        ')}
        <article class="card"><h2><a href="/methodologie/">Méthodologie de Vigi-FR</a></h2><p class="prose">Données d’entrée, calcul du FWI, seuils des niveaux et limites de la méthode utilisée par le site.</p><p><a href="/methodologie/">Lire la méthodologie ${ic('arrow', 'icon--arrow')}</a></p></article>
        <article class="card"><h2><a href="/donnees/">Données ouvertes</a></h2><p class="prose">Le dernier calcul au format JSON, avec la description de chaque champ, la licence et la citation recommandée.</p><p><a href="/donnees/">Voir la documentation ${ic('arrow', 'icon--arrow')}</a></p></article>
      </div>
    </div>
  </main>`;
  return page(head({ title, description, path, jsonld }), 'guides', body);
}

/* ------------------------------------------------------------------ */
/* Documentation des données ouvertes                                   */
/* ------------------------------------------------------------------ */
function dataPage() {
  const path = '/donnees/';
  const title = 'Données ouvertes : risque d’incendie de forêt par département (JSON) | Vigi-FR';
  const description = 'Le dernier calcul Vigi-FR en JSON : champs, unités, fréquence de mise à jour, licence CC BY 4.0 et citation recommandée pour les 96 départements.';
  const dsId = `${SITE}donnees/#dataset`;
  const prop = (name, description, unitText) => ({ '@type': 'PropertyValue', name, description, ...(unitText ? { unitText } : {}) });
  const dataset = {
    '@type': 'Dataset', '@id': dsId, name: 'Niveaux de risque d’incendie de forêt par département (France métropolitaine) — Vigi-FR',
    description: 'Niveau de risque (1 à 4) et indice forêt-météo (FWI) calculés chaque jour pour les 96 départements de France métropolitaine, au chef-lieu, à partir de prévisions Open-Meteo. Le fichier contient le dernier calcul uniquement ; il est remplacé à chaque mise à jour.',
    url: `${SITE}donnees/`, inLanguage: 'fr-FR', isAccessibleForFree: true,
    license: 'https://creativecommons.org/licenses/by/4.0/', creator: { '@id': ORG_ID }, publisher: { '@id': ORG_ID },
    keywords: ['risque incendie de forêt', 'indice forêt-météo', 'Fire Weather Index', 'FWI', 'IFM', 'départements français', 'prévision'],
    spatialCoverage: { '@type': 'Place', name: 'France métropolitaine' },
    isBasedOn: { '@type': 'Dataset', name: 'Open-Meteo.com — prévisions météo horaires', url: 'https://open-meteo.com/', license: 'https://creativecommons.org/licenses/by/4.0/' },
    measurementTechnique: 'Indice forêt-météo canadien (Van Wagner, 1987) calculé à 12 h (heure de Paris) au chef-lieu de chaque département, avec 30 jours d’amorçage ; niveaux dérivés des seuils 11,2 / 21,3 / 38.',
    variableMeasured: [
      prop('j0, j1, j2', 'Niveau de risque de 1 (faible) à 4 (très élevé) pour l’échéance 0, 1 ou 2 jours après dataDate.'),
      prop('fwi0, fwi1, fwi2', 'Indice forêt-météo (FWI) de l’échéance, sans dimension.'),
      prop('m0, m1, m2.t', 'Température de l’air à midi', '°C'), prop('m0, m1, m2.h', 'Humidité relative à midi', '%'),
      prop('m0, m1, m2.w', 'Vitesse du vent à 10 m, à midi', 'km/h'), prop('m0, m1, m2.r', 'Pluie cumulée sur les 24 h précédant midi', 'mm'),
      prop('m0, m1, m2.ffmc / dmc / dc', 'Codes d’humidité du combustible (FFMC, DMC) et de sécheresse (DC)'),
    ],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}data/fwi.json`, name: 'fwi.json' }, { '@type': 'DataDownload', encodingFormat: 'application/json', contentUrl: `${SITE}assets/data/departements.json`, name: 'departements.json (référentiel des départements)' }],
    ...(snap.ok ? { dateModified: snap.fileDate, temporalCoverage: `${isoDay(Math.min(...snap.days))}/${isoDay(Math.max(...snap.days))}`, version: String(snap.schemaVersion ?? '') } : {}),
    citation: 'Vigi-FR, niveaux de risque d’incendie de forêt par département, d’après Open-Meteo.com (CC BY 4.0), https://vigi-fr.vercel.app/donnees/',
  };
  const jsonld = graph(
    webPage({ path, title, description, modified: PAGE_DATES.donnees, extra: { mainEntity: { '@id': dsId } } }),
    dataset,
    breadcrumb(path, [['Accueil', '/'], ['Données ouvertes', path]]),
  );
  const row = (a, b, c) => `<tr><td class="mono">${a}</td><td>${b}</td><td>${c}</td></tr>`;
  const body = `  <main id="contenu">
    <div class="container">
      <nav class="crumbs" aria-label="Fil d’Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Données ouvertes</li></ol></nav>
      <div class="page-head">
        <div class="eyebrow eyebrow--ember">Données ouvertes</div>
        <h1 class="display">Les niveaux de risque, <em>en JSON</em></h1>
        <p class="lead">Le dernier calcul de Vigi-FR est publié dans un fichier ouvert, réutilisable librement avec mention de la source. Cette page décrit son contenu.</p>
      </div>
      <div class="stack section">
        <div class="prose">
          <h2>Accès</h2>
          <ul>
            <li>Dernier calcul : <a href="/data/fwi.json">/data/fwi.json</a> (JSON, UTF-8, accessible depuis d’autres sites : CORS ouvert).</li>
            <li>Référentiel des départements (code, nom, adresse de la fiche, région, préfecture) : <a href="/assets/data/departements.json">/assets/data/departements.json</a>.</li>
          </ul>
          <p>Le fichier contient <strong>le dernier calcul uniquement</strong> : il est remplacé à chaque mise à jour et ne constitue pas un historique.${snap.ok ? ` Au moment de la génération de cette page, il porte la date de calcul du <time datetime="${snap.fileDate}">${formatDateTime(snap.fileDate)}</time>, la date de référence ${dayFull(0)}, la version de schéma ${snap.schemaVersion} et ${snap.count} départements.` : ''}</p>
          <h2>Mise à jour</h2>
          <p>Le calcul est refait chaque jour par une tâche automatique (GitHub Actions), toute l’année. La date exacte figure dans le champ <code>fileDate</code>. Si le calcul échoue, le fichier précédent reste en ligne : vérifiez toujours <code>fileDate</code> avant d’utiliser les niveaux.</p>
          <h2>Structure du fichier</h2>
        </div>
        <div class="table-scroll"><table class="lvtable">
          <caption class="sr-only">Champs de premier niveau de fwi.json</caption>
          <thead><tr><th scope="col">Champ</th><th scope="col">Type</th><th scope="col">Signification</th></tr></thead>
          <tbody>
            ${row('schemaVersion', 'entier', 'Version du format. Des champs peuvent être ajoutés ; ceux existants ne changent pas de sens au sein d’une même version.')}
            ${row('fileDate', 'date-heure ISO 8601 (UTC)', 'Instant du calcul.')}
            ${row('dataDate', 'AAAA-MM-JJ', 'Date de référence : l’échéance 0 correspond à ce jour, l’échéance 1 au lendemain, l’échéance 2 au surlendemain.')}
            ${row('source, licence, api, method', 'texte', 'Origine des données, licence, description de l’API et de la méthode.')}
            ${row('departments', 'tableau', 'Un objet par département (voir ci-dessous).')}
          </tbody>
        </table></div>
        <div class="table-scroll"><table class="lvtable">
          <caption class="sr-only">Champs de chaque département</caption>
          <thead><tr><th scope="col">Champ</th><th scope="col">Type</th><th scope="col">Signification</th></tr></thead>
          <tbody>
            ${row('code, name', 'texte', 'Code du département (01 à 95, 2A, 2B) et nom.')}
            ${row('j0, j1, j2', 'entier 1 à 4', 'Niveau de risque : 1 faible, 2 modéré, 3 élevé, 4 très élevé. <code>j0</code> n’existe qu’à partir de la version 3 du schéma.')}
            ${row('fwi0, fwi1, fwi2', 'nombre', 'Indice forêt-météo (FWI) de l’échéance, sans dimension.')}
            ${row('m0, m1, m2', 'objet (version 3)', 'Conditions de l’échéance : <code>t</code> température (°C), <code>h</code> humidité relative (%), <code>w</code> vent à 10 m (km/h), <code>r</code> pluie sur 24 h (mm), <code>ffmc</code>, <code>dmc</code>, <code>dc</code> (codes du système canadien).')}
          </tbody>
        </table></div>
        <div class="prose">
          <h2>Licence et citation</h2>
          <p>Les prévisions météo viennent d’${ext('https://open-meteo.com/', 'Open-Meteo.com')} (${ext('https://creativecommons.org/licenses/by/4.0/deed.fr', 'licence CC BY 4.0')}). Les niveaux et indices publiés par Vigi-FR sont proposés sous la même licence : vous pouvez les copier, les redistribuer et les adapter en citant la source.</p>
          <p><strong>Citation recommandée :</strong> « Vigi-FR, niveaux de risque d’incendie de forêt par département, d’après Open-Meteo.com (CC BY 4.0), https://vigi-fr.vercel.app/donnees/ ».</p>
          <h2>Exemple d’utilisation</h2>
          <pre class="code-block"><code>curl -s https://vigi-fr.vercel.app/data/fwi.json | jq '.departments[] | select(.code=="33")'</code></pre>
          <h2>Précautions d’usage</h2>
          <ul>
            <li>Les niveaux sont calculés <strong>au chef-lieu</strong> de chaque département, pas sur l’ensemble de son territoire.</li>
            <li>Ils constituent un outil d’information et ne remplacent pas les arrêtés préfectoraux ni les consignes des autorités. Voir la <a href="/methodologie/">méthodologie</a> et le guide <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux</a>.</li>
            <li>Un défaut ou une erreur dans les données ? <a href="${ISSUES}" rel="noopener noreferrer" target="_blank">Signalez-le sur GitHub<span class="sr-only"> (s’ouvre dans un nouvel onglet)</span></a>.</li>
          </ul>
        </div>
      </div>
    </div>
  </main>`;
  return page(head({ title, description, path, jsonld }), 'guides', body);
}

function notFoundPage() {
  const body = `  <main id="contenu">
    <div class="container nf">
      <p class="num" aria-hidden="true">404</p>
      <h1 class="display">Page <em>introuvable</em></h1>
      <p class="lead">Cette page n’existe pas ou a été déplacée.</p>
      <a class="btn btn--primary" href="/">Retourner à l’accueil de Vigi-FR ${ic('arrow', 'icon--arrow')}</a>
      <div class="chips nf__links"><a href="/#departements">Les 96 départements</a><a href="/guide/">Guides</a><a href="/methodologie/">Méthodologie</a><a href="/donnees/">Données ouvertes</a></div>
    </div>
  </main>`;
  return page(head({ title: 'Page introuvable | Vigi-FR', description: 'Cette page n’existe pas ou a été déplacée.', path: '/404.html', robots: 'noindex' }), '', body);
}

/* ------------------------------------------------------------------ */
/* Écriture                                                             */
/* ------------------------------------------------------------------ */
const INDEXNOW_KEY = '08a4fcda14bc102750914e5413976a93'; // clé publique par conception (protocole IndexNow) : le fichier <clé>.txt prouve la propriété du site.

write('index.html', homePage());
for (const d of depts) write(`departement/${d.slug}/index.html`, deptPage(d));
for (const r of regionNames) write(`region/${regionSlug(r)}/index.html`, regionPage(r));
write('guide/index.html', guidesHubPage());
for (const g of GUIDES) write(`guide/${g.slug}/index.html`, guidePage(g));
write('donnees/index.html', dataPage());
write('methodologie/index.html', methodPage());
write('a-propos/index.html', aboutPage());
write('politique-de-confidentialite/index.html', privacyPage());
write('conditions-d-utilisation/index.html', termsPage());
write('404.html', notFoundPage());

write('assets/data/departements.json', `${JSON.stringify(depts.map(({ code, name, slug, region, prefecture }) => ({ code, name, slug, region, prefecture })))}\n`);

// Sitemap : lastmod = date du dernier calcul pour les pages alimentées par les données, date d’édition pour les pages éditoriales.
const dataDay = snap.ok ? snap.fileDate.slice(0, 10) : null;
const entries = [
  [SITE, dataDay],
  ...regionNames.map((r) => [`${SITE}region/${regionSlug(r)}/`, dataDay]),
  ...depts.map((d) => [`${SITE}departement/${d.slug}/`, dataDay]),
  [`${SITE}guide/`, PAGE_DATES.guides],
  ...GUIDES.map((g) => [`${SITE}guide/${g.slug}/`, GUIDE_DATES.modified]),
  [`${SITE}donnees/`, PAGE_DATES.donnees],
  [`${SITE}methodologie/`, PAGE_DATES.methodologie],
  [`${SITE}a-propos/`, PAGE_DATES.apropos],
  [`${SITE}politique-de-confidentialite/`, PAGE_DATES.legal],
  [`${SITE}conditions-d-utilisation/`, PAGE_DATES.legal],
];
write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(([u, m]) => `  <url><loc>${u}</loc>${m ? `<lastmod>${m}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`);

// robots.txt : tout est explorable. Les robots d’assistants IA sont nommés pour documenter la politique du site ;
// l’autorisation d’explorer n’implique ni indexation ni citation dans leurs réponses.
write('robots.txt', `# Vigi-FR : toutes les pages sont publiques et explorables.
User-agent: *
Allow: /

# Robots de recherche et d'assistants IA (autorisation explicite, identique à la règle générale)
User-agent: OAI-SearchBot
User-agent: ChatGPT-User
User-agent: GPTBot
User-agent: PerplexityBot
User-agent: Perplexity-User
User-agent: Claude-SearchBot
User-agent: Claude-User
User-agent: ClaudeBot
User-agent: Google-Extended
User-agent: Applebot-Extended
Allow: /

Sitemap: ${SITE}sitemap.xml
`);

// llms.txt : index lisible par les modèles (proposition llmstxt.org). Aucune garantie d’effet sur le classement ou les citations.
write('llms.txt', `# Vigi-FR

> Site indépendant et open source qui publie, pour les 96 départements de France métropolitaine, le niveau de risque d’incendie de forêt (de 1 à 4) calculé chaque jour avec l’indice forêt-météo (FWI) à partir de prévisions Open-Meteo. Ce n’est pas un bulletin officiel : les arrêtés préfectoraux et les consignes des autorités font foi. En cas d’urgence : 18 ou 112.

Points utiles pour citer ou résumer le site :
- Chaque niveau est calculé au chef-lieu du département (pas sur tout son territoire), à midi heure de Paris, et recalculé chaque jour de l’année. La date du dernier calcul est affichée sur chaque page.
- Les seuils (FWI 11,2 ; 21,3 ; 38) sont ceux des classes EFFIS, regroupées en quatre niveaux. Les niveaux de Vigi-FR peuvent différer de la Météo des forêts de Météo-France.
- Données sous licence CC BY 4.0 : citer Vigi-FR et Open-Meteo.com.

## Pages principales
- [Accueil : carte nationale des niveaux](${SITE}): niveau du jour pour chaque département, carte, tableau, questions fréquentes.
- [Méthodologie](${SITE}methodologie/): données d’entrée, calcul du FWI, niveaux, limites.
- [Données ouvertes](${SITE}donnees/): description du fichier JSON, champs, licence, citation.
- [À propos](${SITE}a-propos/): ce que fait le site, sources, licences, vie privée, corrections.
- [Politique de confidentialité](${SITE}politique-de-confidentialite/): aucune donnée personnelle collectée, hébergement, liens sortants.
- [Conditions d’utilisation](${SITE}conditions-d-utilisation/): usage libre, information sans valeur réglementaire, licences.
- [Flux Atom](${SITE}feed.xml): situation nationale du dernier calcul et guides.

## Guides
${GUIDES.map((g) => `- [${g.title}](${SITE}guide/${g.slug}/): ${g.description}`).join('\n')}

## Régions
${regionNames.map((r) => `- [Risque d’incendie de forêt ${REGION_LOC[r]}](${SITE}region/${regionSlug(r)}/): niveaux des départements de la région.`).join('\n')}

## Fichiers pour assistants IA
- [Résumé du site (JSON)](${SITE}ai/summary.json): description, niveaux, seuils, limites, licence, points d’accès.
- [Questions fréquentes (JSON)](${SITE}ai/faq.json): les réponses de la FAQ de l’accueil.
- [Informations IA (texte)](${SITE}.well-known/ai.txt): usage autorisé et liens utiles.

## Données
- [Dernier calcul (JSON)](${SITE}data/fwi.json): niveaux et indices FWI de tous les départements.
- [Référentiel des départements (JSON)](${SITE}assets/data/departements.json): code, nom, région, préfecture.

## Optional
${depts.map((d) => `- [${d.name} (${d.code})](${SITE}departement/${d.slug}/): risque d’incendie de forêt ${LOC[d.code]}.`).join('\n')}
`);
// Fichiers de découverte pour assistants et moteurs de réponse IA (pratique émergente, sans standard unique ni garantie d’effet).
const AI_LIMITS = [
  'Indicateur d’information, sans valeur réglementaire : seuls les arrêtés préfectoraux fixent les restrictions.',
  'Niveau calculé au chef-lieu du département, pas sur tout son territoire.',
  'Ne mesure que le danger météorologique, pas la présence d’habitations ni l’état réel des massifs.',
  'Les niveaux peuvent différer de la Météo des forêts de Météo-France.',
];
write('ai/summary.json', `${JSON.stringify({
  name: 'Vigi-FR', url: SITE, language: 'fr-FR', description: HOME_DESC,
  topic: 'Niveau quotidien de risque d’incendie de forêt par département, France métropolitaine',
  dateModified: snap.ok ? snap.fileDate : null,
  coverage: { departments: depts.length, regions: regionNames.length },
  update: 'Recalculé chaque jour de l’année, à midi heure de Paris, au chef-lieu de chaque département',
  method: 'Indice forêt-météo canadien (FWI) calculé à partir de prévisions Open-Meteo',
  levels: [1, 2, 3, 4].map((l) => ({ level: l, label: LEVELS[l].label, fwi: LEVELS[l].range, meaning: LEVELS[l].hint })),
  thresholds: { fwi: THRESHOLDS, source: 'Classes de danger EFFIS regroupées en quatre niveaux' },
  limits: AI_LIMITS,
  emergency: 'En cas d’urgence, appeler le 18 ou le 112',
  license: { data: 'CC BY 4.0', attribution: 'Citer Vigi-FR et Open-Meteo.com', url: 'https://creativecommons.org/licenses/by/4.0/deed.fr' },
  endpoints: { data: `${SITE}data/fwi.json`, departments: `${SITE}assets/data/departements.json`, faq: `${SITE}ai/faq.json`, llms: `${SITE}llms.txt`, sitemap: `${SITE}sitemap.xml` },
  guides: GUIDES.map((g) => ({ title: g.title, url: `${SITE}guide/${g.slug}/`, description: g.description })),
  contact: { issues: ISSUES },
  citation: `Vigi-FR, niveau de risque d’incendie de forêt par département, ${SITE}`,
}, null, 2)}\n`);
write('ai/faq.json', `${JSON.stringify({
  name: 'Vigi-FR : questions fréquentes', url: SITE, language: 'fr-FR', dateModified: snap.ok ? snap.fileDate : null,
  questions: FAQ.map(([q, a]) => ({ question: q, answer: plain(a.map((x) => `<p>${x}</p>`).join(' ')) })),
}, null, 2)}\n`);
write('.well-known/ai.txt', `# Vigi-FR : informations pour assistants et moteurs de réponse IA
# Fichier informatif (pas de standard unique). Voir aussi /llms.txt, /ai/summary.json et /ai/faq.json.

Site: Vigi-FR
URL: ${SITE}
Langue: fr-FR
Sujet: niveau quotidien de risque d’incendie de forêt par département (France métropolitaine)
Mise a jour: quotidienne
Utilisation: citation et réutilisation des données autorisées avec attribution (CC BY 4.0) : citer Vigi-FR et Open-Meteo.com
Limite: indicateur d’information sans valeur réglementaire ; en cas d’urgence, appeler le 18 ou le 112
Donnees: ${SITE}data/fwi.json
Resume: ${SITE}ai/summary.json
FAQ: ${SITE}ai/faq.json
Contact: ${ISSUES}
`);

// Flux Atom : une entrée par échéance du dernier calcul (situation nationale) et une par guide. Les identifiants sont stables (date visée, slug).
{
  const host = new URL(SITE).host;
  const atomDate = (iso) => (iso.length === 10 ? `${iso}T00:00:00Z` : iso);
  const feedUpdated = snap.ok ? snap.fileDate : atomDate(GUIDE_DATES.modified);
  const dayEntries = snap.ok ? snap.days.map((k) => {
    const { counts, total, max } = countsFor(snap, k);
    return `  <entry>
    <id>tag:${host},${isoDay(k)}:situation</id>
    <title>Risque incendie de forêt : situation du ${esc(dayFull(k))}</title>
    <link rel="alternate" type="text/html" href="${SITE}#carte"/>
    <updated>${snap.fileDate}</updated>
    <summary>${esc(`Sur les ${total} départements suivis, ${statesLine(counts)}. Le niveau le plus élevé du pays est le niveau ${max} (${LEVELS[max].label.toLowerCase()}). Calcul à midi, heure de Paris, au chef-lieu de chaque département.`)}</summary>
  </entry>`;
  }) : [];
  const guideEntries = GUIDES.map((g) => `  <entry>
    <id>tag:${host},${GUIDE_DATES.published}:guide-${g.slug}</id>
    <title>${esc(g.title)}</title>
    <link rel="alternate" type="text/html" href="${SITE}guide/${g.slug}/"/>
    <published>${atomDate(GUIDE_DATES.published)}</published>
    <updated>${atomDate(GUIDE_DATES.modified)}</updated>
    <summary>${esc(g.description)}</summary>
  </entry>`);
  write('feed.xml', `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="fr">
  <id>${SITE}</id>
  <title>Vigi-FR : risque incendie de forêt par département</title>
  <subtitle>Situation nationale du dernier calcul et guides pédagogiques. Indicateur d’information, sans valeur réglementaire.</subtitle>
  <link rel="self" type="application/atom+xml" href="${SITE}feed.xml"/>
  <link rel="alternate" type="text/html" href="${SITE}"/>
  <updated>${feedUpdated}</updated>
  <author><name>Vigi-FR</name><uri>${SITE}</uri></author>
  <rights>Données sous licence CC BY 4.0 : citer Vigi-FR et Open-Meteo.com.</rights>
${[...dayEntries, ...guideEntries].join('\n')}
</feed>
`);
}
write(`${INDEXNOW_KEY}.txt`, `${INDEXNOW_KEY}\n`);

write('manifest.webmanifest', `${JSON.stringify({
  name: 'Vigi-FR — Risque d’incendie de forêt', short_name: 'Vigi-FR', lang: 'fr-FR', start_url: '/', scope: '/', display: 'standalone',
  background_color: '#0B0A08', theme_color: '#0B0A08',
  icons: [
    { src: '/assets/img/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: '/assets/img/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: '/assets/img/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}, null, 2)}\n`);

const NOINDEX = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }];
write('vercel.json', `${JSON.stringify({
  $schema: 'https://openapi.vercel.sh/vercel.json',
  framework: null, buildCommand: null, installCommand: null, outputDirectory: '.', trailingSlash: true,
  headers: [
    { source: '/(.*)', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Content-Security-Policy', value: CSP_HEADER },
    ] },
    { source: '/assets/fonts/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
    { source: '/assets/img/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    // Données ouvertes : lisibles depuis d’autres sites (aucune donnée personnelle ni secret).
    { source: '/data/(.*)', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
    { source: '/assets/data/(.*)', headers: [{ key: 'Access-Control-Allow-Origin', value: '*' }] },
    { source: '/sitemap.xml', headers: [{ key: 'Content-Type', value: 'application/xml; charset=utf-8' }] },
    { source: '/feed.xml', headers: [{ key: 'Content-Type', value: 'application/atom+xml; charset=utf-8' }] },
    { source: '/robots.txt', headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }] },
    { source: '/llms.txt', headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }] },
    { source: '/.well-known/ai.txt', headers: [{ key: 'Content-Type', value: 'text/plain; charset=utf-8' }] },
    { source: '/ai/(.*)', headers: [{ key: 'Content-Type', value: 'application/json; charset=utf-8' }, { key: 'Access-Control-Allow-Origin', value: '*' }] },
    // Fichiers du dépôt servis tels quels par l’hébergeur : utiles au développement, sans intérêt pour la recherche.
    { source: '/tools/(.*)', headers: NOINDEX },
    { source: '/scripts/(.*)', headers: NOINDEX },
    { source: '/.github/(.*)', headers: NOINDEX },
    { source: '/seo/(.*)', headers: NOINDEX },
    { source: '/README.md', headers: NOINDEX },
    { source: '/package.json', headers: NOINDEX },
  ],
}, null, 2)}\n`);

flush();
console.log(`Pages générées : accueil, ${depts.length} départements, ${regionNames.length} régions, ${GUIDES.length} guides + index, données, méthodologie, à propos, 404 (site : ${SITE}). Données : ${snap.ok ? `calcul du ${snap.fileDate}, schéma ${snap.schemaVersion}` : 'absentes (pages sans chiffres)'}.`);
