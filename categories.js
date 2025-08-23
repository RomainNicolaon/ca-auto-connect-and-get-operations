/**
 * Transaction Categories Configuration
 *
 * This file contains the keyword-based categorization rules for banking transactions.
 * Each category contains an array of keywords that will be matched against transaction descriptions.
 *
 * Categories are organized by:
 * - Income vs Expenses
 * - Essential vs Discretionary spending
 * - Logical groupings (housing, food, transport, etc.)
 *
 * To customize: Add or modify keywords in the appropriate category arrays.
 * Keywords are case-insensitive and use substring matching.
 */

// Categories configuration - optimized for French banking transactions
export const CATEGORIES = {
  // Income categories
  Revenus: [
    "SALAIRE",
    "REMUNERATION",
    "PRIME",
    "INDEMNITE",
    "VIREMENT RECU",
    "VERSEMENT",
    "ALLOCATION",
    "PENSION",
    "DEPOT",
    "CREDIT",
  ],

  // Essential expenses
  Logement: [
    "LOYER",
    "MIALLET", // Rent and property management
    "EDF",
    "ELECTRICITE",
    "GDF",
    "ENGIE",
    "GAZ", // Utilities
    "ORANGE",
    "SFR",
    "FREE",
    "BOUYGUES",
    "INTERNET",
    "MOBILE",
    "FIBRE", // Telecom
    "ASSURANCE HABITATION",
    "SYNDIC",
    "CHARGES",
    "COPROPRIETE",
    "HOTEL",
    "APPART CITY",
    "IBIS",
    "BOOKING",
    "AIRBNB",
    "TRIPADVISOR",
    "TRIVAGO",
  ],

  Alimentation: [
    "CARREFOUR",
    "LECLERC",
    "AUCHAN",
    "INTERMARCHE",
    "SUPER U",
    "CASINO",
    "MONOPRIX",
    "FRANPRIX",
    "PICARD",
    "LIDL",
    "ALDI",
    "BIOCOOP",
    "BOULANGERIE",
    "BOUCHERIE",
    "EPICERIE",
    "MARCHE",
    "COURSES",
    "MCDONALDS",
    "QUICK",
    "KFC",
    "BURGER",
    "PATAPAIN",
    "PAUL",
  ],

  Transport: [
    "SNCF",
    "RATP",
    "UBER",
    "TAXI",
    "BLABLACAR",
    "TOTAL",
    "BP",
    "SHELL",
    "ESSO",
    "ESSENCE",
    "CARBURANT",
    "AUTOROUTE",
    "PEAGE",
    "COFIROUTE",
    "PARKING",
    "STATIONNEMENT",
    "ASSURANCE AUTO",
    "GARAGE",
    "REPARATION",
  ],

  Santé: [
    "PHARMACIE",
    "MEDECIN",
    "DENTISTE",
    "HOPITAL",
    "CLINIQUE",
    "LABORATOIRE",
    "MUTUELLE",
    "HARMONIE",
    "MGEN",
    "MAAF",
    "SECU",
    "CPAM",
    "OPTIQUE",
    "LUNETTES",
  ],

  // Discretionary spending
  Loisirs: [
    "RESTAURANT",
    "CAFE",
    "BAR",
    "BRASSERIE",
    "PIZZERIA",
    "CINEMA",
    "THEATRE",
    "CONCERT",
    "SPECTACLE",
    "NETFLIX",
    "AMAZON PRIME",
    "CRUNCHYROLL",
    "ANIMEDIGITALNETWORK",
    "DISNEY",
    "SPOTIFY",
    "DEEZER",
    "FNAC",
    "CULTURA",
    "LIVRE",
    "MUSIQUE",
    "SPORT",
    "SALLE DE SPORT",
    "FITNESS",
    "PISCINE",
    "TENNIS",
  ],

  Shopping: [
    "AMAZON",
    "CDISCOUNT",
    "ZALANDO",
    "VENTE-PRIVEE",
    "EBAY",
    "LEBONCOIN",
    "DECATHLON",
    "IKEA",
    "LEROY MERLIN",
    "CASTORAMA",
    "BRICORAMA",
    "ZARA",
    "H&M",
    "UNIQLO",
    "VETEMENT",
    "MODE",
    "DARTY",
    "BOULANGER",
    "ELECTROMENAGER",
  ],

  Divertissement: [
    "STEAM",
    "GOG",
    "EPIC",
    "DISCORD",
    "PLAYSTATION",
    "XBOX",
    "NINTENDO",
    "CRUNCHYROLL",
    "TWITCH",
    "YOUTUBE",
    "PATREON",
    "JEUX",
    "GAMING",
    "CONSOLE",
  ],

  // Financial and administrative
  Banque: [
    "FRAIS",
    "COMMISSION",
    "COTISATION",
    "AGIOS",
    "CARTE",
    "COMPTE",
    "VIREMENT EMIS",
    "CHEQUE",
    "RETRAIT",
    "DEPOT",
    "TRANSFER",
  ],

  Impôts: [
    "IMPOT",
    "TAXE",
    "TRESOR PUBLIC",
    "DGFIP",
    "URSSAF",
    "POLE EMPLOI",
    "CAF",
    "PREFECTURE",
    "AMENDES",
  ],

  // Catch-all for unmatched transactions
  Divers: ["PAYPAL", "WESTERN UNION", "MANDAT", "ESPECES"],
};

/**
 * Get all available category names
 * @returns {string[]} Array of category names
 */
export function getCategoryNames() {
  return Object.keys(CATEGORIES);
}

/**
 * Get keywords for a specific category
 * @param {string} categoryName - Name of the category
 * @returns {string[]} Array of keywords for the category
 */
export function getCategoryKeywords(categoryName) {
  return CATEGORIES[categoryName] || [];
}

/**
 * Add a keyword to a category
 * @param {string} categoryName - Name of the category
 * @param {string} keyword - Keyword to add
 */
export function addKeywordToCategory(categoryName, keyword) {
  if (CATEGORIES[categoryName]) {
    CATEGORIES[categoryName].push(keyword.toUpperCase());
  }
}

/**
 * Remove a keyword from a category
 * @param {string} categoryName - Name of the category
 * @param {string} keyword - Keyword to remove
 */
export function removeKeywordFromCategory(categoryName, keyword) {
  if (CATEGORIES[categoryName]) {
    const index = CATEGORIES[categoryName].indexOf(keyword.toUpperCase());
    if (index > -1) {
      CATEGORIES[categoryName].splice(index, 1);
    }
  }
}
