/**
 * Données éditoriales statiques utilisées par le générateur de pages (tools/generate-pages.mjs).
 * Aucune statistique ici : uniquement de la grammaire (prépositions) et des identifiants de pages.
 */

/** « dans l’Ain », « en Gironde », « à Paris »… clé = code du département. */
export const LOC = {
  '01': 'dans l’Ain', '02': 'dans l’Aisne', '03': 'dans l’Allier', '04': 'dans les Alpes-de-Haute-Provence',
  '05': 'dans les Hautes-Alpes', '06': 'dans les Alpes-Maritimes', '07': 'en Ardèche', '08': 'dans les Ardennes',
  '09': 'en Ariège', '10': 'dans l’Aube', '11': 'dans l’Aude', '12': 'dans l’Aveyron',
  '13': 'dans les Bouches-du-Rhône', '14': 'dans le Calvados', '15': 'dans le Cantal', '16': 'en Charente',
  '17': 'en Charente-Maritime', '18': 'dans le Cher', '19': 'en Corrèze', '2A': 'en Corse-du-Sud',
  '2B': 'en Haute-Corse', '21': 'en Côte-d’Or', '22': 'dans les Côtes-d’Armor', '23': 'dans la Creuse',
  '24': 'en Dordogne', '25': 'dans le Doubs', '26': 'dans la Drôme', '27': 'dans l’Eure',
  '28': 'en Eure-et-Loir', '29': 'dans le Finistère', '30': 'dans le Gard', '31': 'en Haute-Garonne',
  '32': 'dans le Gers', '33': 'en Gironde', '34': 'dans l’Hérault', '35': 'en Ille-et-Vilaine',
  '36': 'dans l’Indre', '37': 'en Indre-et-Loire', '38': 'en Isère', '39': 'dans le Jura',
  '40': 'dans les Landes', '41': 'dans le Loir-et-Cher', '42': 'dans la Loire', '43': 'en Haute-Loire',
  '44': 'en Loire-Atlantique', '45': 'dans le Loiret', '46': 'dans le Lot', '47': 'dans le Lot-et-Garonne',
  '48': 'en Lozère', '49': 'en Maine-et-Loire', '50': 'dans la Manche', '51': 'dans la Marne',
  '52': 'en Haute-Marne', '53': 'en Mayenne', '54': 'en Meurthe-et-Moselle', '55': 'dans la Meuse',
  '56': 'dans le Morbihan', '57': 'en Moselle', '58': 'dans la Nièvre', '59': 'dans le Nord',
  '60': 'dans l’Oise', '61': 'dans l’Orne', '62': 'dans le Pas-de-Calais', '63': 'dans le Puy-de-Dôme',
  '64': 'dans les Pyrénées-Atlantiques', '65': 'dans les Hautes-Pyrénées', '66': 'dans les Pyrénées-Orientales',
  '67': 'dans le Bas-Rhin', '68': 'dans le Haut-Rhin', '69': 'dans le Rhône', '70': 'en Haute-Saône',
  '71': 'en Saône-et-Loire', '72': 'dans la Sarthe', '73': 'en Savoie', '74': 'en Haute-Savoie',
  '75': 'à Paris', '76': 'en Seine-Maritime', '77': 'en Seine-et-Marne', '78': 'dans les Yvelines',
  '79': 'dans les Deux-Sèvres', '80': 'dans la Somme', '81': 'dans le Tarn', '82': 'dans le Tarn-et-Garonne',
  '83': 'dans le Var', '84': 'dans le Vaucluse', '85': 'en Vendée', '86': 'dans la Vienne',
  '87': 'en Haute-Vienne', '88': 'dans les Vosges', '89': 'dans l’Yonne', '90': 'dans le Territoire de Belfort',
  '91': 'dans l’Essonne', '92': 'dans les Hauts-de-Seine', '93': 'en Seine-Saint-Denis', '94': 'dans le Val-de-Marne',
  '95': 'dans le Val-d’Oise',
};

/** « en Occitanie », « dans le Grand Est »… clé = nom de région tel qu’écrit dans tools/out/depts.json. */
export const REGION_LOC = {
  'Auvergne-Rhône-Alpes': 'en Auvergne-Rhône-Alpes',
  'Bourgogne-Franche-Comté': 'en Bourgogne-Franche-Comté',
  'Bretagne': 'en Bretagne',
  'Centre-Val de Loire': 'en Centre-Val de Loire',
  'Corse': 'en Corse',
  'Grand Est': 'dans le Grand Est',
  'Hauts-de-France': 'dans les Hauts-de-France',
  'Île-de-France': 'en Île-de-France',
  'Normandie': 'en Normandie',
  'Nouvelle-Aquitaine': 'en Nouvelle-Aquitaine',
  'Occitanie': 'en Occitanie',
  'Pays de la Loire': 'dans les Pays de la Loire',
  'Provence-Alpes-Côte d’Azur': 'en Provence-Alpes-Côte d’Azur',
};

/** Slug d’URL d’une région : minuscules, sans accents, tirets. « Provence-Alpes-Côte d’Azur » → provence-alpes-cote-d-azur. */
export const regionSlug = (name) => name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Majuscule initiale (les prépositions « dans le Var » commencent une phrase dans certains gabarits). */
export const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
