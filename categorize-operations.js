import fs from "fs";
import path from "path";
import pino from "pino";
import pinoPretty from "pino-pretty";

const logger = pino(
  pinoPretty({
    transport: {
      target: "pino-pretty",
      options: {
        colorize: true,
        ignore: "pid,hostname",
        translateTime: "SYS:dd-mm-yyyy HH:MM:ss",
      },
    },
  })
);

// Categories configuration - customize these based on your needs
const CATEGORIES = {
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
  ],
  Transport: [
    "SNCF",
    "RATP",
    "UBER",
    "TAXI",
    "ESSENCE",
    "STATION SERVICE",
    "AUTOROUTE",
    "PARKING",
    "PEAGE",
    "TOTAL",
    "BP",
    "SHELL",
    "ESSO",
  ],
  Santé: [
    "PHARMACIE",
    "MEDECIN",
    "DENTISTE",
    "HOPITAL",
    "CLINIQUE",
    "LABORATOIRE",
    "MUTUELLE",
    "SECU",
    "CPAM",
  ],
  Logement: [
    "LOYER",
    "EDF",
    "GDF",
    "ENGIE",
    "VEOLIA",
    "SUEZ",
    "FREE",
    "ORANGE",
    "SFR",
    "BOUYGUES",
    "ASSURANCE HABITATION",
    "SYNDIC",
    "CHARGES",
  ],
  Loisirs: [
    "CINEMA",
    "RESTAURANT",
    "CAFE",
    "BAR",
    "NETFLIX",
    "SPOTIFY",
    "AMAZON PRIME",
    "FNAC",
    "CULTURA",
    "SPORT",
    "SALLE DE SPORT",
  ],
  Banque: [
    "FRAIS",
    "COMMISSION",
    "COTISATION",
    "AGIOS",
    "VIREMENT",
    "CHEQUE",
    "RETRAIT",
    "DEPOT",
  ],
  Salaire: ["SALAIRE", "PAIE", "REMUNERATION", "PRIME", "INDEMNITE"],
  Impôts: ["IMPOT", "TAXE", "TRESOR PUBLIC", "DGFIP", "URSSAF"],
  Shopping: [
    "AMAZON",
    "CDISCOUNT",
    "ZALANDO",
    "VENTE-PRIVEE",
    "EBAY",
    "DECATHLON",
    "IKEA",
    "LEROY MERLIN",
    "CASTORAMA",
  ],
  Jeux: ["STEAM", "GOG", "EPIC", "DISCORD", "DISCORD GAMES", "PAYPAL"],
};

/**
 * Parse CSV content and extract operations
 * @param {string} csvContent - Raw CSV content
 * @returns {Array} Array of operation objects
 */
function parseCSV(csvContent) {
  const lines = csvContent.split("\n");
  const operations = [];

  // Extract account balance from line 7 (A7)
  let accountBalance = null;
  if (lines.length > 6) {
    const balanceLine = lines[6]; // Line 7 (0-indexed)
    // Handle encoding issues with special characters
    const balanceMatch = balanceLine.match(
      /Solde au \d{2}\/\d{2}\/\d{4}\s+([\d\s�]+),(\d{2})\s*[€�]/
    );
    if (balanceMatch) {
      const balanceStr =
        balanceMatch[1].replace(/[\s�]/g, "") + "." + balanceMatch[2];
      accountBalance = parseFloat(balanceStr);
      logger.info(`Account balance extracted: ${accountBalance}€`);
    } else {
      logger.warn(
        `Could not extract account balance from line 7: "${balanceLine}"`
      );
    }
  }

  // Find the header row (contains "Date;Libellé;Débit euros;Crédit euros;")
  let headerIndex = -1;
  for (let i = 0; i < Math.min(25, lines.length); i++) {
    const line = lines[i];
    // Check for header patterns with various encodings
    if (
      (line.includes("Date;") &&
        line.includes("Libell") &&
        line.includes("bit euros")) ||
      (line.includes("Date;") &&
        line.includes("euros;") &&
        line.includes("dit euros"))
    ) {
      headerIndex = i;
      logger.info(`Found header at line ${headerIndex + 1}: "${line}"`);
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error(
      'Header row not found. Expected format: "Date;Libellé;Débit euros;Crédit euros;"'
    );
  }

  // Parse multi-line transactions starting from headerIndex + 1
  let i = headerIndex + 1;
  while (i < lines.length) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      i++;
      continue;
    }

    // Check if this line starts a new transaction (starts with a date)
    const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4});/);
    if (dateMatch) {
      const date = dateMatch[1];

      // Collect all lines for this transaction until we find the amounts
      let transactionLines = [line];
      let j = i + 1;
      let foundAmounts = false;

      // Keep reading lines until we find one that ends with amounts (;number;;)
      while (j < lines.length && !foundAmounts) {
        const nextLine = lines[j].trim();
        if (!nextLine) {
          j++;
          continue;
        }

        transactionLines.push(nextLine);

        // Check if this line contains the amounts (ends with ;amount;; or ;amount;amount;)
        if (
          nextLine.match(/;\d+,\d+;;$/) ||
          nextLine.match(/;;\d+,\d+;$/) ||
          nextLine.match(/;\d+,\d+;\d+,\d+;$/)
        ) {
          foundAmounts = true;
        }

        j++;
      }

      if (foundAmounts) {
        // Parse the complete transaction
        const operation = parseTransaction(date, transactionLines);
        if (operation) {
          operations.push(operation);
        }
      }

      i = j;
    } else {
      i++;
    }
  }

  return {
    operations: operations,
    accountBalance: accountBalance,
  };
}

/**
 * Parse a complete multi-line transaction
 * @param {string} date - Transaction date
 * @param {Array} lines - All lines for this transaction
 * @returns {Object|null} Parsed operation or null if invalid
 */
function parseTransaction(date, lines) {
  try {
    // Join all lines and extract the libellé (description)
    const fullText = lines.join(" ").replace(/;/g, " ").trim();

    // Extract amounts from the last line
    const lastLine = lines[lines.length - 1];
    const amountMatch = lastLine.match(/;(\d+,\d+|);(\d+,\d+|);$/);

    if (!amountMatch) {
      logger.warn(`Could not parse amounts from: "${lastLine}"`);
      return null;
    }

    const debitStr = amountMatch[1] || "0";
    const creditStr = amountMatch[2] || "0";

    const debit = debitStr ? parseFloat(debitStr.replace(",", ".")) : 0;
    const credit = creditStr ? parseFloat(creditStr.replace(",", ".")) : 0;

    // Extract meaningful description (remove the date and amounts)
    let libelle = fullText
      .replace(date, "")
      .replace(/\d+,\d+/g, "")
      .replace(/\s+/g, " ")
      .trim();

    // Clean up common patterns
    libelle = libelle
      .replace(/^[;\s]+/, "")
      .replace(/[;\s]+$/, "")
      .replace(/\s+/g, " ")
      .trim();

    const operation = {
      date: date,
      libelle: libelle,
      debit: debit,
      credit: credit,
      amount: credit - debit,
      type: credit - debit >= 0 ? "CREDIT" : "DEBIT",
    };

    return operation;
  } catch (error) {
    logger.warn(`Error parsing transaction: ${error.message}`);
    return null;
  }
}

/**
 * Categorize an operation based on its libellé
 * @param {string} libelle - Operation description
 * @returns {string} Category name
 */
function categorizeOperation(libelle) {
  const upperLibelle = libelle.toUpperCase();

  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (upperLibelle.includes(keyword)) {
        return category;
      }
    }
  }

  return "Autres";
}

/**
 * Fix encoding issues in CSV content
 * @param {string} content - CSV content with potential encoding issues
 * @returns {string} Fixed content
 */
function fixEncodingIssues(content) {
  return (
    content
      // Common French accented characters
      .replace(/\u00E0/g, "à") // à
      .replace(/\u00E1/g, "á") // á
      .replace(/\u00E2/g, "â") // â
      .replace(/\u00E4/g, "ä") // ä
      .replace(/\u00E9/g, "é") // é
      .replace(/\u00E8/g, "è") // è
      .replace(/\u00EA/g, "ê") // ê
      .replace(/\u00EB/g, "ë") // ë
      .replace(/\u00EE/g, "î") // î
      .replace(/\u00EF/g, "ï") // ï
      .replace(/\u00F4/g, "ô") // ô
      .replace(/\u00F6/g, "ö") // ö
      .replace(/\u00F9/g, "ù") // ù
      .replace(/\u00FA/g, "ú") // ú
      .replace(/\u00FB/g, "û") // û
      .replace(/\u00FC/g, "ü") // ü
      .replace(/\u00E7/g, "ç") // ç
      .replace(/\u00F1/g, "ñ") // ñ
      // Uppercase variants
      .replace(/\u00C0/g, "À") // À
      .replace(/\u00C1/g, "Á") // Á
      .replace(/\u00C2/g, "Â") // Â
      .replace(/\u00C4/g, "Ä") // Ä
      .replace(/\u00C9/g, "É") // É
      .replace(/\u00C8/g, "È") // È
      .replace(/\u00CA/g, "Ê") // Ê
      .replace(/\u00CB/g, "Ë") // Ë
      .replace(/\u00CE/g, "Î") // Î
      .replace(/\u00CF/g, "Ï") // Ï
      .replace(/\u00D4/g, "Ô") // Ô
      .replace(/\u00D6/g, "Ö") // Ö
      .replace(/\u00D9/g, "Ù") // Ù
      .replace(/\u00DA/g, "Ú") // Ú
      .replace(/\u00DB/g, "Û") // Û
      .replace(/\u00DC/g, "Ü") // Ü
      .replace(/\u00C7/g, "Ç") // Ç
      .replace(/\u00D1/g, "Ñ") // Ñ
      // Special characters
      .replace(/\u20AC/g, "€") // €
      .replace(/\u00AB/g, "«") // «
      .replace(/\u00BB/g, "»") // »
      .replace(/\u2019/g, "'") // '
      .replace(/\u2018/g, "'") // '
      .replace(/\u201C/g, '"') // "
      .replace(/\u201D/g, '"') // "
      .replace(/\u2013/g, "-") // –
      .replace(/\u2014/g, "-") // —
      .replace(/\u2026/g, "...") // …
      // Fix specific broken character patterns commonly seen in Credit Agricole CSVs
      .replace(/\u00E0/g, "à")
      .replace(/Compte \u00E0 composer/g, "Compte à composer")
      .replace(/Compte � composer/g, "Compte à composer")
      .replace(/op�ration/g, "opération")
      .replace(/cr�dit/g, "crédit")
      .replace(/d�bit/g, "débit")
      .replace(/pr�l�vement/g, "prélèvement")
      .replace(/�/g, "é")
  ); // Fallback for remaining broken characters
}

/**
 * Process operations and group by category
 * @param {Array} operations - Array of operation objects
 * @param {number} accountBalance - Current account balance
 * @returns {Object} Categorized operations
 */
function categorizeOperations(operations, accountBalance = null) {
  const categorized = {};
  let totalDebit = 0;
  let totalCredit = 0;

  operations.forEach((operation) => {
    const category = categorizeOperation(operation.libelle);

    if (!categorized[category]) {
      categorized[category] = {
        operations: [],
        totalAmount: 0,
        count: 0,
      };
    }

    categorized[category].operations.push(operation);
    categorized[category].totalAmount += operation.amount;
    categorized[category].count++;

    if (operation.amount < 0) {
      totalDebit += Math.abs(operation.amount);
    } else {
      totalCredit += operation.amount;
    }
  });

  return {
    categories: categorized,
    summary: {
      totalOperations: operations.length,
      totalDebit,
      totalCredit,
      netAmount: totalCredit - totalDebit,
      accountBalance: accountBalance,
    },
  };
}

/**
 * Generate a detailed report
 * @param {Object} categorizedData - Categorized operations data
 * @returns {string} Formatted report
 */
function generateReport(categorizedData) {
  const { categories, summary } = categorizedData;
  let report = "\n=== RAPPORT D'ANALYSE DES OPÉRATIONS ===\n\n";

  // Summary
  report += `📊 RÉSUMÉ GÉNÉRAL:\n`;
  report += `   • Nombre total d'opérations: ${summary.totalOperations}\n`;
  report += `   • Total débits: -${summary.totalDebit.toFixed(2)}€\n`;
  report += `   • Total crédits: +${summary.totalCredit.toFixed(2)}€\n`;
  report += `   • Solde net: ${
    summary.netAmount >= 0 ? "+" : ""
  }${summary.netAmount.toFixed(2)}€\n`;
  if (summary.accountBalance !== null) {
    report += `   • Solde du compte: ${summary.accountBalance.toFixed(2)}€\n`;
  }
  report += `\n`;

  // Categories breakdown
  report += `📋 RÉPARTITION PAR CATÉGORIE:\n\n`;

  // Sort categories by total amount (most negative first for expenses)
  const sortedCategories = Object.entries(categories).sort(
    ([, a], [, b]) => a.totalAmount - b.totalAmount
  );

  sortedCategories.forEach(([category, data]) => {
    const avgAmount = data.totalAmount / data.count;
    const emoji = data.totalAmount < 0 ? "💸" : "💰";

    report += `${emoji} ${category.toUpperCase()}:\n`;
    report += `   • Nombre d'opérations: ${data.count}\n`;
    report += `   • Montant total: ${
      data.totalAmount >= 0 ? "+" : ""
    }${data.totalAmount.toFixed(2)}€\n`;
    report += `   • Montant moyen: ${
      avgAmount >= 0 ? "+" : ""
    }${avgAmount.toFixed(2)}€\n`;

    // Show top 3 operations for this category
    const topOps = data.operations
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 3);

    report += `   • Principales opérations:\n`;
    topOps.forEach((op) => {
      report += `     - ${op.date}: ${op.libelle.substring(0, 40)}... (${
        op.amount >= 0 ? "+" : ""
      }${op.amount.toFixed(2)}€)\n`;
    });
    report += "\n";
  });

  return report;
}

/**
 * Save categorized data to JSON file
 * @param {Object} categorizedData - Categorized operations data
 * @param {string} outputPath - Output file path
 */
function saveToJSON(categorizedData, outputPath) {
  const jsonData = {
    generatedAt: new Date().toISOString(),
    ...categorizedData,
  };

  fs.writeFileSync(outputPath, JSON.stringify(jsonData, null, 2), "utf8");
  logger.info(`Données sauvegardées dans: ${outputPath}`);
}

/**
 * Main function to process CSV file
 * @param {string} csvFilePath - Path to the CSV file
 */
async function processCsvFile(csvFilePath) {
  try {
    logger.info(`Traitement du fichier: ${csvFilePath}`);

    // Check if file exists
    if (!fs.existsSync(csvFilePath)) {
      throw new Error(`Fichier non trouvé: ${csvFilePath}`);
    }

    // Read CSV file with proper encoding handling
    let csvContent;
    try {
      // First try to read as UTF-8
      csvContent = fs.readFileSync(csvFilePath, "utf8");

      // Check if there are encoding issues (broken characters)
      if (csvContent.includes("�") || csvContent.includes("\uFFFD")) {
        logger.warn(
          "Détection de caractères corrompus, tentative avec l'encodage Windows-1252"
        );
        // Try reading with latin1 encoding which can handle Windows-1252
        const buffer = fs.readFileSync(csvFilePath);
        csvContent = buffer.toString("latin1");

        // Convert common Windows-1252 characters to UTF-8 equivalents
        csvContent = fixEncodingIssues(csvContent);
      }
    } catch (encodingError) {
      logger.error("Erreur lors de la lecture du fichier:", encodingError);
      throw encodingError;
    }

    logger.info("Fichier CSV lu avec succès");

    // Parse operations
    const parseResult = parseCSV(csvContent);
    const operations = parseResult.operations;
    const accountBalance = parseResult.accountBalance;

    logger.info(`${operations.length} opérations extraites`);
    if (accountBalance !== null) {
      logger.info(`Solde du compte: ${accountBalance}€`);
    }

    if (operations.length === 0) {
      logger.warn("Aucune opération trouvée dans le fichier");
      return;
    }

    // Categorize operations
    const categorizedData = categorizeOperations(operations, accountBalance);
    logger.info(
      `Opérations catégorisées en ${
        Object.keys(categorizedData.categories).length
      } catégories`
    );

    // Generate and display report
    const report = generateReport(categorizedData);
    console.log(report);

    // Save results
    const outputDir = path.dirname(csvFilePath);
    const baseName = path.basename(csvFilePath, path.extname(csvFilePath));
    const jsonOutputPath = path.join(outputDir, `${baseName}_categorized.json`);
    const reportOutputPath = path.join(outputDir, `${baseName}_report.txt`);

    saveToJSON(categorizedData, jsonOutputPath);
    fs.writeFileSync(reportOutputPath, report, "utf8");

    logger.info(`Rapport sauvegardé dans: ${reportOutputPath}`);
    logger.info("Traitement terminé avec succès!");
  } catch (error) {
    logger.error(`Erreur lors du traitement: ${error.message}`);
    process.exit(1);
  }
}

// Command line usage
if (process.argv.length < 3) {
  console.log("Usage: node categorize-operations.js <chemin-vers-fichier-csv>");
  console.log("Exemple: node categorize-operations.js ./operations.csv");
  process.exit(1);
}

const csvFilePath = process.argv[2];
processCsvFile(csvFilePath);
