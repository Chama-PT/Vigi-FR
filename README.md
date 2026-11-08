# Vigi-FR

Niveau de risque d'incendie de forêt pour les 96 départements de France métropolitaine, calculé chaque jour à partir de prévisions météo (indice forêt-météo, FWI). Aujourd'hui, demain et après-demain.

Site statique, sans dépendance et sans étape de build : les fichiers du dépôt sont servis tels quels par Vercel. **Les pages HTML sont générées** par `tools/generate-pages.mjs` à partir de `data/fwi.json` : ne les modifiez pas à la main, modifiez le générateur (sinon la régénération quotidienne écrase vos changements).

## Structure

```
index.html                    accueil (carte, vigilance nationale, FAQ, index des départements)
departement/<slug>/index.html 96 pages départements
region/<slug>/index.html      13 synthèses régionales
guide/<slug>/index.html       guides éditoriaux sourcés (+ guide/index.html)
donnees/                      documentation des données ouvertes (JSON)
methodologie/, a-propos/, 404.html
sitemap.xml, robots.txt, llms.txt, <clé>.txt (IndexNow)   générés
assets/css/styles.css         thème « Vigilance Naturelle »
assets/js/                    lib.js (données, utilitaires) · site.js (menu, recherche) · home.js · dept.js · content.js
assets/fonts/                 Instrument Serif, Geist, Geist Mono (licence SIL OFL, textes inclus)
assets/data/departements.json code, nom, slug, région, préfecture
data/fwi.json                 données du jour (mises à jour par GitHub Actions)
scripts/fetch-data.js         récupération Open-Meteo + calcul du FWI
scripts/indexnow.js           signalement des pages modifiées à IndexNow (Bing et autres)
.github/workflows/update-data.yml   quotidien, 05:00 UTC : calcul → régénération des pages → contrôle → commit → IndexNow
vercel.json                   en-têtes de sécurité (CSP), cache, CORS des données, noindex des fichiers techniques (généré)
.vercelignore                 exclut tools/, scripts/, .github/, seo/ et README.md du déploiement
tools/                        générateur (generate-pages.mjs), contenus (guides.mjs, editorial.mjs, snapshot.mjs), contrôle (verify-site.mjs)
seo/rapports/                 rapports d'audit mensuels
```

## Déploiement sur Vercel

Réglages du projet Vercel : Framework Preset « Other », Build Command vide, Output Directory `.`, aucune variable d'environnement. Ils sont déjà fixés par `vercel.json`. Un `git push` sur la branche de production déclenche le déploiement.

Après la première mise en ligne, lancez une fois le workflow « Mise à jour des données » (onglet Actions de GitHub, bouton « Run workflow ») pour que `data/fwi.json` passe au schéma 3 : les onglets « Aujourd'hui » et le bloc « Conditions » apparaissent alors. Le workflow doit avoir le droit d'écrire (Settings, Actions, General, Workflow permissions : Read and write).

## Données

`data/fwi.json`, schéma 3 (ajouts compatibles avec le schéma 2) : pour chaque département `j0, fwi0, j1, fwi1, j2, fwi2` (niveau 1 à 4 et indice) et `m0, m1, m2` (`t` température, `h` humidité, `w` vent, `r` pluie, `ffmc`, `dmc`, `dc`). Si ces champs sont absents, l'interface les masque sans erreur.

Niveaux : 1 Faible (< 11,2) · 2 Modéré (11,2 à 21,3) · 3 Élevé (21,3 à 38) · 4 Très élevé (≥ 38). Ces seuils sont ceux des six classes de danger EFFIS ; Vigi-FR regroupe les deux classes les plus basses (niveau 1) et les deux plus hautes (niveau 4).

Documentation complète des champs : page `/donnees/` du site.

## Outils optionnels (non requis pour déployer)

- `npm run generate-pages` régénère toutes les pages, le sitemap, robots.txt et llms.txt. Il intègre dans le HTML les niveaux de `data/fwi.json` (lisibles sans JavaScript) ; la date du dernier calcul sert de `lastmod`. Variable `SITE_URL` pour changer le domaine (par défaut `https://vigi-fr.vercel.app/`).
- `npm run verify` contrôle le site généré : titres, descriptions et h1 uniques, canonical, JSON-LD, liens internes, pages orphelines, sitemap, cohérence avec `data/fwi.json`. Code de sortie 1 en cas d'erreur.
- `npm run indexnow -- --all` signale toutes les pages du sitemap à IndexNow (usage exceptionnel ; le workflow ne signale que les pages modifiées).
- `tools/build-map.mjs` reconstruit les tracés de la carte depuis le dépôt france-geojson.
- `npm run check` vérifie la syntaxe des scripts.

## Sources et licences

- Prévisions météo : [Open-Meteo](https://open-meteo.com/), licence CC BY 4.0 (mention conservée dans le pied de page).
- Calcul FWI : système canadien (Van Wagner, 1987) ; classes de danger EFFIS.
- Contours des départements : IGN Admin Express, version simplifiée par Grégoire David (Licence ouverte).
- Polices : Instrument Serif et Geist, SIL Open Font License 1.1.
- Code : MIT (voir `LICENSE`).

Les niveaux affichés sont indicatifs et ne remplacent pas les arrêtés préfectoraux. En cas d'incendie : 18 ou 112.
