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

// Import categories configuration from categories.js
import { CATEGORIES } from "./categories.js";

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
      /Solde au \d{2}\/\d{2}\/\d{4}\s+(-?\s*[\d\s\u00a0\u202f.]+),(\d{2})/
    );
    if (balanceMatch) {
      const balanceStr =
        balanceMatch[1].replace(/[\s\u00a0\u202f.]/g, "") + "." + balanceMatch[2];
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

  // Parse the operations with a real CSV reader: a quoted libellé can span several lines
  const rows = parseCsvRecords(lines.slice(headerIndex + 1).join("\n"));
  for (const row of rows) {
    const operation = parseRow(row);
    if (operation) operations.push(operation);
  }

  return {
    operations,
    accountBalance,
  };
}

/**
 * Split CSV text (";" separated, '"' quoted, quotes may contain newlines) into rows of fields
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsvRecords(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ";") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * "1 817,37" -> 1817.37 (handles normal, non-breaking and thin spaces as thousands separators)
 */
function parseAmount(str) {
  if (!str || !str.trim()) return 0;
  const value = parseFloat(str.replace(/[\s\u00a0\u202f.]/g, "").replace(",", "."));
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Turn one CSV row [date, libellé, débit, crédit] into an operation
 * @returns {Object|null} Parsed operation, or null if the row is not an operation
 */
function parseRow(row) {
  const [date, rawLibelle = "", debitStr, creditStr] = row;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test((date || "").trim())) return null;

  const libelleLines = rawLibelle
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  // First line is the operation type ("PAIEMENT PAR CARTE", "Virement en votre faveur"...),
  // the rest is the actual description (same behaviour as before)
  const operationType = libelleLines.length > 1 ? libelleLines[0] : "";
  const libelle = (libelleLines.length > 1 ? libelleLines.slice(1) : libelleLines)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const debit = parseAmount(debitStr);
  const credit = parseAmount(creditStr);
  if (!debit && !credit) {
    logger.warn(`Opération sans montant ignorée : ${date.trim()} ${libelle}`);
    return null;
  }

  return {
    date: date.trim(),
    libelle,
    operationType,
    debit,
    credit,
    amount: Math.round((credit - debit) * 100) / 100,
    type: credit - debit >= 0 ? "CREDIT" : "DEBIT",
  };
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

    // Show operations for this category

    report += `   • Opérations:\n`;
    data.operations.forEach((op) => {
      report += `     - ${op.date}: ${op.libelle} (${
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
 * Decode a Windows-1252 buffer (Crédit Agricole CSV export).
 * Node's decoder treats it as Latin-1, so map the 0x80-0x9F range (€, ’, œ...) by hand.
 */
function decodeWindows1252(buffer) {
  const extra = {
    0x80: "€", 0x82: "‚", 0x83: "ƒ", 0x84: "„", 0x85: "…", 0x86: "†", 0x87: "‡",
    0x88: "ˆ", 0x89: "‰", 0x8a: "Š", 0x8b: "‹", 0x8c: "Œ", 0x8e: "Ž", 0x91: "‘",
    0x92: "’", 0x93: "“", 0x94: "”", 0x95: "•", 0x96: "–", 0x97: "—", 0x98: "˜",
    0x99: "™", 0x9a: "š", 0x9b: "›", 0x9c: "œ", 0x9e: "ž", 0x9f: "Ÿ",
  };
  let out = "";
  for (const byte of buffer) out += extra[byte] ?? String.fromCharCode(byte);
  return out;
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

    // Read CSV file
    // Crédit Agricole exports are Windows-1252 encoded (é, è, €...)
    const csvContent = decodeWindows1252(fs.readFileSync(csvFilePath));
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
