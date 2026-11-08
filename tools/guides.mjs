/**
 * Guides éditoriaux de Vigi-FR. Chaque affirmation factuelle renvoie à une source publique citée en bas de page.
 * Les textes sont rédigés pour les lecteurs ; ils ne contiennent aucune statistique propre au site ni donnée inventée.
 *
 * Sources consultées (novembre 2026) :
 *  - Ministère de la Transition écologique, fiche presse « Obligations légales de débroussaillement », 6 janvier 2026.
 *  - Copernicus / ECMWF / EFFIS : classes de danger du FWI (https://cds.climate.copernicus.eu, https://climate.copernicus.eu).
 *  - Communiqués de préfecture (Lozère ; Bouches-du-Rhône) sur la Météo des forêts de Météo-France.
 *  - Van Wagner, C.E. (1987), Forestry Technical Report 35, Canadian Forestry Service.
 */

export const GUIDE_DATES = { published: '2026-11-07', modified: '2026-11-07' };

export function buildGuides({ ext }) {
  const ministere = { name: 'Ministère de la Transition écologique, fiche presse « Obligations légales de débroussaillement » (6 janvier 2026)', url: 'https://www.ecologie.gouv.fr/sites/default/files/documents/06.01.2026_OLD_Fiche-Presse-2026_0.pdf' };
  const copernicusCds = { name: 'Copernicus Climate Change Service, indicateurs de danger d’incendie (classes de danger du FWI selon EFFIS)', url: 'https://cds.climate.copernicus.eu/datasets/sis-tourism-fire-danger-indicators' };
  const copernicusEsotc = { name: 'Copernicus, « European State of the Climate 2022 », chapitre feux de forêt (origine et calibrage du FWI, classes de danger)', url: 'https://climate.copernicus.eu/esotc/2022/wildfires' };
  const vanWagner = { name: 'Van Wagner, C.E. (1987), Development and structure of the Canadian Forest Fire Weather Index System, Forestry Technical Report 35, Canadian Forestry Service, Ottawa' };
  const effis = { name: 'EFFIS, système européen d’information sur les feux de forêt', url: 'https://effis.jrc.ec.europa.eu/' };
  const prefLozere = { name: 'Préfecture de la Lozère, communiqué « Météo des forêts – Incendies » (Météo-France)', url: encodeURI('https://www.lozere.gouv.fr/index.php/contenu/telechargement/29657/259507/file/CP - Météo des Forêts -Incendies.pdf') };
  const futura = { name: 'Futura Sciences, « Météo France lance la Météo des forêts » (juin 2023)', url: 'https://www.futura-sciences.com/planete/actualites/incendie-meteo-france-lance-meteo-forets-informer-risque-incendie-durant-ete-104991/' };
  const rtbf = { name: 'RTBF, « France : une météo des forêts quotidienne pour lutter contre les incendies »', url: 'https://www.rtbf.be/article/france-une-meteo-des-forets-quotidienne-pour-lutter-contre-les-incendies-11188635' };
  const allodocteurs = { name: 'Allodocteurs, « Risque d’incendie : découvrez la nouvelle carte météo des feux de forêt »', url: 'https://www.allodocteurs.fr/risque-dincendie-decouvrez-la-nouvelle-carte-meteo-des-feux-de-foret-35090.html' };
  const prefBdr = { name: 'Préfecture des Bouches-du-Rhône, communiqué « Prévention feux de forêt » (Météo des forêts)', url: encodeURI('https://www.bouches-du-rhone.gouv.fr/index.php/contenu/telechargement/52418/381161/file/CP - Prévention feux de forêt.pdf') };

  /* ------------------------------------------------------------------ */
  const fwi = {
    slug: 'indice-foret-meteo-fwi',
    title: 'Indice forêt-météo (FWI ou IFM) : définition, niveaux, limites',
    description: 'Définition de l’indice forêt-météo (FWI, appelé IFM en France) : origine canadienne, six composantes, classes de danger EFFIS et limites d’interprétation.',
    h1: 'L’indice forêt-météo, <em>FWI ou IFM</em>',
    lead: 'L’indice forêt-météo résume en un seul nombre les conditions météo qui rendent un feu de végétation plus facile à démarrer et à propager. C’est la référence au Canada et en Europe ; en France, Météo-France l’appelle IFM.',
    breadcrumbName: 'Indice forêt-météo (FWI)',
    sources: [vanWagner, copernicusCds, copernicusEsotc, effis, prefLozere],
    body: () => `
          <h2>Une définition en trois phrases</h2>
          <p>Le <strong>FWI</strong> (<em>Fire Weather Index</em>) est un indice de <strong>danger météorologique</strong> : il estime à quel point la météo récente et prévue favorise l’éclosion et la propagation d’un feu de végétation. En France, le même indice est désigné par <strong>IFM</strong> (indice forêt-météo) ; les deux sigles renvoient au même système de calcul, d’origine canadienne.</p>
          <p>Il ne mesure ni la présence d’un feu, ni la quantité de végétation, ni la cause d’un départ de feu. Il répond à une seule question : « les conditions du moment sont-elles favorables aux incendies ? »</p>
          <p>Les équations actuelles sont décrites par Van Wagner (1987). Le système a été adopté par le système européen d’information sur les feux de forêt (EFFIS) pour évaluer le danger de façon homogène en Europe. Il avait été calibré pour les forêts boréales canadiennes, mais s’est révélé pertinent dans d’autres régions, selon Copernicus.</p>

          <h2>Les six composantes du système</h2>
          <p>Le FWI est le dernier maillon d’une chaîne de calcul. Trois codes suivent l’humidité de trois couches de combustible, deux indices en tirent la propagation et le combustible disponible, puis le FWI les combine.</p>
          <div class="table-scroll"><table class="lvtable">
            <thead><tr><th scope="col">Sigle</th><th scope="col">Ce qu’il représente</th><th scope="col">Rapidité de réaction</th></tr></thead>
            <tbody>
              <tr><td class="mono">FFMC</td><td>Humidité des combustibles fins de surface : feuilles et brindilles mortes.</td><td>Quelques heures (constante de temps d’environ deux tiers de jour).</td></tr>
              <tr><td class="mono">DMC</td><td>Humidité de la couche d’humus, de profondeur moyenne.</td><td>Quelques jours à quelques semaines (environ 12 jours).</td></tr>
              <tr><td class="mono">DC</td><td>Sécheresse des couches profondes, qui s’installe sur la durée.</td><td>Plusieurs semaines (environ 52 jours).</td></tr>
              <tr><td class="mono">ISI</td><td>Vitesse de propagation initiale : combine le FFMC et le vent.</td><td>Suit la météo du jour.</td></tr>
              <tr><td class="mono">BUI</td><td>Quantité de combustible disponible : combine le DMC et le DC.</td><td>Évolue lentement.</td></tr>
              <tr><td class="mono">FWI</td><td>Intensité potentielle d’un feu : combine l’ISI et le BUI.</td><td>Résultat final, recalculé chaque jour.</td></tr>
            </tbody>
          </table></div>
          <p class="fine-print">Les temps de réaction sont des ordres de grandeur issus des constantes de la méthode canadienne (Van Wagner, 1987).</p>

          <h2>Données d’entrée</h2>
          <p>Le calcul utilise quatre mesures ou prévisions, prises à midi (heure locale) : la <strong>température</strong>, l’<strong>humidité relative</strong> de l’air, la <strong>vitesse du vent</strong> et la <strong>pluie</strong> des 24 dernières heures. Les codes FFMC, DMC et DC gardent la mémoire des jours précédents : une série de jours secs fait monter l’indice, une pluie importante le fait baisser.</p>

          <h2>Lire la valeur : les classes de danger</h2>
          <p>EFFIS range les valeurs du FWI en six classes de danger. Vigi-FR en tire quatre niveaux en reprenant les mêmes seuils (11,2 ; 21,3 ; 38) : les deux classes les plus basses forment le niveau 1, les deux plus hautes le niveau 4.</p>
          <div class="table-scroll"><table class="lvtable">
            <thead><tr><th scope="col">Classe EFFIS</th><th scope="col">Valeur du FWI</th><th scope="col">Niveau Vigi-FR</th></tr></thead>
            <tbody>
              <tr><td>Très faible</td><td class="mono">moins de 5,2</td><td rowspan="2">1 — Faible</td></tr>
              <tr><td>Faible</td><td class="mono">5,2 à 11,2</td></tr>
              <tr><td>Modéré</td><td class="mono">11,2 à 21,3</td><td>2 — Modéré</td></tr>
              <tr><td>Élevé</td><td class="mono">21,3 à 38</td><td>3 — Élevé</td></tr>
              <tr><td>Très élevé</td><td class="mono">38 à 50</td><td rowspan="2">4 — Très élevé</td></tr>
              <tr><td>Extrême</td><td class="mono">50 et plus</td></tr>
            </tbody>
          </table></div>
          <p>Les seuils d’EFFIS sont publiés par Copernicus. Ils sont communs à tous les pays européens, ce qui permet de comparer des régions entre elles, mais ils ne sont pas calés sur la végétation de chaque département.</p>

          <h2>Ce que l’indice ne dit pas</h2>
          <ul>
            <li><strong>Il ne signale aucun incendie en cours.</strong> Un niveau bas ne garantit pas l’absence de feu, un niveau haut ne signifie pas qu’un feu est en cours.</li>
            <li><strong>Il ne décrit pas la végétation locale.</strong> La même valeur n’a pas la même signification dans une pinède, une garrigue ou une prairie.</li>
            <li><strong>Il est calculé en un point.</strong> Pour un département, la valeur d’un point peut différer de celle d’un massif éloigné, d’un littoral ou d’un relief.</li>
            <li><strong>Il ne remplace pas la réglementation.</strong> Seuls les arrêtés préfectoraux fixent les restrictions d’accès et d’usage du feu. Voir le guide <a href="/guide/comparer-sources-risque-incendie/">Météo des forêts, Vigi-FR, arrêtés préfectoraux</a>.</li>
          </ul>

          <h2>FWI et IFM : qui l’utilise en France ?</h2>
          <p>Météo-France évalue chaque jour l’IFM sur le territoire. Selon les communiqués de préfecture qui relaient son dispositif « Météo des forêts », cet indice permet d’estimer le danger météorologique en tenant compte de la probabilité d’éclosion d’un feu et de son potentiel de propagation. Vigi-FR calcule de son côté le FWI selon la méthode canadienne à partir de prévisions Open-Meteo : la démarche est comparable, mais les niveaux ne sont pas ceux de Météo-France. La méthode de Vigi-FR est détaillée sur la page <a href="/methodologie/">Méthodologie</a>.</p>

          <h2>Questions fréquentes</h2>
          <h3>FWI et IFM, est-ce la même chose ?</h3>
          <p>Oui : FWI est le sigle anglais (<em>Fire Weather Index</em>), IFM le sigle français (indice forêt-météo). Les deux désignent l’indice du système canadien.</p>
          <h3>À partir de quelle valeur le danger est-il « élevé » ?</h3>
          <p>Dans les classes d’EFFIS, le danger est dit élevé de 21,3 à 38, très élevé de 38 à 50 et extrême à partir de 50.</p>
          <h3>Pourquoi l’indice peut-il rester élevé après un jour de pluie ?</h3>
          <p>Parce que les couches profondes (DMC, DC) sèchent et se rééquilibrent lentement : une pluie courte humidifie surtout la surface (FFMC).</p>
          <p>Retrouvez le niveau du jour de chaque département sur <a href="/#carte">la carte nationale</a>.</p>`,
  };

  /* ------------------------------------------------------------------ */
  const compare = {
    slug: 'comparer-sources-risque-incendie',
    title: 'Météo des forêts, Vigi-FR, arrêtés préfectoraux : qui dit quoi ?',
    description: 'Ce que mesurent la Météo des forêts de Météo-France, les niveaux Vigi-FR et les arrêtés préfectoraux, leurs différences et la source qui fait foi.',
    h1: 'Météo des forêts, Vigi-FR, arrêtés : <em>qui dit quoi ?</em>',
    lead: 'Trois types d’informations circulent quand le risque d’incendie monte : une carte de danger de Météo-France, des niveaux calculés par des sites comme Vigi-FR, et les arrêtés des préfectures. Ils ne répondent pas à la même question.',
    breadcrumbName: 'Comparer les sources',
    sources: [prefLozere, prefBdr, futura, rtbf, allodocteurs, effis],
    body: () => `
          <h2>Le tableau en un coup d’œil</h2>
          <div class="table-scroll"><table class="lvtable">
            <thead><tr><th scope="col">Source</th><th scope="col">Ce qu’elle dit</th><th scope="col">Valeur réglementaire</th></tr></thead>
            <tbody>
              <tr><th scope="row">Météo des forêts (Météo-France)</th><td>Un niveau de danger météorologique de feux par département, en quatre couleurs : vert (faible), jaune (modéré), orange (élevé), rouge (très élevé). Carte diffusée en fin d’après-midi, avec le lendemain et le surlendemain.</td><td>Aucune : elle informe et sensibilise, elle ne réglemente pas l’accès ni les travaux.</td></tr>
              <tr><th scope="row">Vigi-FR</th><td>Un niveau de 1 à 4 calculé par le site à partir du FWI, au chef-lieu de chaque département, recalculé chaque jour toute l’année.</td><td>Aucune : calcul indépendant, non officiel.</td></tr>
              <tr><th scope="row">Arrêtés préfectoraux et municipaux</th><td>Les règles applicables : accès aux massifs, usage du feu, travaux, selon le département et la période.</td><td><strong>Oui :</strong> ce sont les seuls textes qui font foi.</td></tr>
            </tbody>
          </table></div>

          <h2>La Météo des forêts, en pratique</h2>
          <p>Météo-France diffuse la Météo des forêts depuis juin 2023 sur son site et son application, sous forme d’une carte par département. D’après les communiqués de préfecture qui la présentent, elle s’appuie sur l’indice forêt-météo (IFM) que Météo-France évalue chaque jour sur le territoire, et son niveau est précisé par département sur une échelle à quatre niveaux. Selon la presse qui a relayé son lancement, elle est élaborée avec l’Office national des forêts (ONF) et tient compte de la sécheresse de la végétation.</p>
          <p>Les informations publiques disponibles la présentent comme un dispositif de saison, diffusé de juin à septembre : consultez le site de Météo-France pour savoir s’il est en service à la date où vous lisez ces lignes. Vigi-FR, lui, est recalculé tous les jours de l’année.</p>

          <h2>Pourquoi deux niveaux peuvent différer</h2>
          <ul>
            <li><strong>La méthode n’est pas la même.</strong> Vigi-FR applique des seuils fixes (ceux d’EFFIS) à un indice calculé en un point, le chef-lieu. La Météo des forêts s’appuie sur l’IFM et sur d’autres informations, comme l’état de sécheresse de la végétation. Vigi-FR ne cherche pas à reproduire ses couleurs : ses seuils ne sont pas ceux de Météo-France.</li>
            <li><strong>Le point de calcul diffère.</strong> Un département étendu ou contrasté (littoral et relief, plaine et massif) peut avoir des conditions très variées. Le niveau de Vigi-FR décrit le chef-lieu.</li>
            <li><strong>Les échéances ne sont pas alignées.</strong> Les cartes de Météo-France sont diffusées à heure fixe, celles de Vigi-FR dépendent du dernier calcul indiqué sur chaque page.</li>
          </ul>
          <p>En cas de désaccord, ni l’une ni l’autre de ces informations n’est un document réglementaire. Pour savoir ce qui est autorisé, reportez-vous à l’arrêté de votre préfecture.</p>

          <h2>Quelle source pour quelle question ?</h2>
          <ul>
            <li><strong>« Puis-je faire un feu, accéder au massif, effectuer des travaux ? »</strong> Arrêtés de la préfecture et de la mairie.</li>
            <li><strong>« Les conditions météo sont-elles dangereuses demain ? »</strong> Météo des forêts de Météo-France (si elle est publiée) et, en complément, le niveau Vigi-FR de votre département.</li>
            <li><strong>« Comment le danger évolue-t-il hors de l’été ? »</strong> Le niveau Vigi-FR, recalculé toute l’année ; un épisode chaud, sec et venteux peut faire monter l’indice à toute saison.</li>
            <li><strong>« Y a-t-il un feu en cours près de chez moi ? »</strong> Aucune des trois : suivez les consignes des sapeurs-pompiers et des autorités, et appelez le 18 ou le 112 en cas de départ de feu.</li>
          </ul>
          <p>Pour comprendre le calcul, lisez <a href="/guide/indice-foret-meteo-fwi/">le guide sur l’indice forêt-météo</a> ou la page <a href="/methodologie/">Méthodologie</a>.</p>`,
  };

  /* ------------------------------------------------------------------ */
  const old = {
    slug: 'debroussaillement-obligatoire',
    title: 'Débroussaillement obligatoire : qui, où, quand, quelles sanctions',
    description: 'Obligations légales de débroussaillement (OLD) : qui est concerné, sur quelle surface, à quelle période, quelles sanctions et comment vérifier sa situation.',
    h1: 'Débroussaillement obligatoire : <em>l’essentiel</em>',
    lead: 'Débroussailler autour de sa maison est une obligation légale dans les territoires exposés aux feux de forêt. Ce guide résume les règles publiées par le ministère de la Transition écologique en janvier 2026.',
    breadcrumbName: 'Débroussaillement obligatoire',
    sources: [ministere],
    body: () => `
          <p class="fine-print">Ce guide reprend la fiche presse du ministère de la Transition écologique du 6 janvier 2026. Les règles précises (périodes, interdictions) sont fixées par arrêté préfectoral : renseignez-vous auprès de votre mairie ou de votre préfecture.</p>
          <h2>En quoi consiste le débroussaillement ?</h2>
          <p>Il s’agit de réduire la quantité de végétaux dans une zone de <strong>50 mètres</strong> autour des constructions, chantiers et installations de toute nature, zone qui peut être portée à 100 mètres lorsque les enjeux le justifient. Ce n’est <strong>ni une coupe rase ni un défrichement</strong> : on crée des discontinuités dans la végétation pour ralentir un feu et faciliter le travail des secours.</p>
          <p>Selon le ministère, la majorité des feux se déclenche à proximité d’un espace habité ou aménagé (habitation, infrastructure de transport, zone industrielle ou commerciale) situé à moins de 200 mètres d’un espace boisé, et 90 % des maisons détruites lors des feux de forêt ne sont pas, ou sont mal, débroussaillées.</p>

          <h2>Qui est concerné ?</h2>
          <ul>
            <li>Tout propriétaire de bâtiments, d’installations ou d’équipements situés <strong>dans un territoire exposé</strong> au risque d’incendie de forêt, ou à moins de 200 mètres de celui-ci.</li>
            <li>Sont considérés comme exposés les bois, forêts, landes, maquis et garrigues identifiés par arrêté ministériel. Le ministère indique que près de 7 400 communes comportent de tels territoires.</li>
            <li>La responsabilité pèse sur le propriétaire de la construction à protéger, y compris lorsque la zone à débroussailler déborde sur le terrain d’un voisin.</li>
          </ul>

          <h2>Comment savoir si l’on est concerné ?</h2>
          <p>Contactez la mairie ou la préfecture, ou consultez le service ${ext('https://jedebroussaille.gouv.fr/', 'jedebroussaille.gouv.fr')} indiqué par le ministère. Le zonage informatif des obligations est aussi publié sur ${ext('https://www.georisques.gouv.fr/', 'Géorisques')}. Depuis le 1er janvier 2025, l’information acquéreur-locataire (IAL) mentionne l’obligation de débroussaillement en cas de vente ou de location d’un bien immobilier.</p>

          <h2>Quand débroussailler ?</h2>
          <ul>
            <li><strong>D’octobre à février :</strong> les gros travaux (coupe d’arbustes, suppression des broussailles sous les arbres), quand la végétation a perdu ses feuilles.</li>
            <li><strong>Au printemps :</strong> l’entretien et le nettoyage (tonte, repousses, gouttières, éloignement des réserves de bois).</li>
            <li><strong>Chaque année :</strong> le débroussaillement doit être refait et entretenu.</li>
            <li><strong>Pas en plein été, parfois :</strong> les travaux peuvent provoquer des étincelles et être interdits pendant l’été. Les périodes d’interdiction sont à vérifier en mairie ou sur le site de la préfecture.</li>
          </ul>

          <h2>Et si la zone empiète sur le terrain d’un voisin ?</h2>
          <p>Le propriétaire du bien à protéger doit demander l’accès à son voisin ; le ministère recommande de le faire par courrier avec accusé de réception, en précisant les travaux prévus. Le voisin peut débroussailler lui-même. S’il refuse l’accès sans le faire, ou ne répond pas dans le mois qui suit la notification, la responsabilité du débroussaillement lui revient (sur les plans pénal et administratif) et le maire doit en être informé.</p>

          <h2>Quelles sanctions en cas de non-respect ?</h2>
          <p>Le ministère mentionne des sanctions pénales et financières : une amende contraventionnelle de 5e classe pouvant aller jusqu’à 1 500 €, ou une amende de 50 € par mètre carré non débroussaillé. S’y ajoutent la mise en demeure avec astreinte, l’exécution d’office par la commune aux frais du propriétaire, et la possibilité d’une franchise d’assurance en cas de sinistre. Le maire contrôle le respect des obligations ; les agents assermentés, notamment ceux de l’ONF, peuvent verbaliser.</p>

          <h2>Quelles sont les actions essentielles ?</h2>
          <ul>
            <li><strong>À l’automne et en hiver :</strong> supprimer les arbustes situés sous les arbres, couper les branches en contact avec la maison.</li>
            <li><strong>Entretenir :</strong> tondre l’herbe, couper les broussailles et les branches basses.</li>
            <li><strong>Nettoyer :</strong> évacuer les résidus (broyage, compostage, déchetterie), éloigner les réserves de bois, retirer feuilles et aiguilles de la toiture et des gouttières.</li>
          </ul>

          <h2>Lien avec le niveau de risque du jour</h2>
          <p>Le débroussaillement est une mesure permanente : il ne dépend pas du niveau de risque affiché un jour donné. Le niveau de risque, lui, aide à décider ce qu’il est prudent de faire ce jour-là (feu, barbecue, travaux produisant des étincelles). Consultez la fiche de votre département sur la <a href="/#departements">liste des 96 départements</a>, et rappelez-vous qu’en cas de départ de feu, il faut appeler le 18 ou le 112.</p>`,
  };

  return [fwi, compare, old];
}
