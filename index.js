import puppeteer from "puppeteer";
import dotenv from "dotenv";
import pino from "pino";
import pinoPretty from "pino-pretty";

dotenv.config();

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

logger.info("Starting script...");

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: false, // Show the browser window
    slowMo: 100, // Add 100ms delay between actions
    devtools: false, // Open DevTools automatically
  });

  // Open a the actual page
  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(
    "https://www.credit-agricole.fr/ca-centreloire/particulier/acceder-a-mes-comptes.html"
  );

  // Set screen size, 1920xfull height
  await page.setViewport({
    width: 1920,
    height: await page.evaluate(() => document.body.scrollHeight),
  });

  // Type into id box
  logger.info("Typing account number...");
  await page.type("#Login-account", process.env.ACCOUNT_NUMBER);

  // Click on .Login-button
  logger.info("Clicking login button...");
  await page.click(".Login-button");

  logger.info("Starting password entry...");

  // click on each character of the password in .Login-keypad
  // Since digits order is random, we need to find each digit dynamically
  for (let i = 0; i < process.env.PASSWORD.length; i++) {
    const digit = process.env.PASSWORD[i];
    logger.info(
      `Clicking digit: ${digit} (${i + 1}/${process.env.PASSWORD.length})`
    );

    // Find and click the button that contains this digit
    await page.evaluate((targetDigit) => {
      const keypadButtons = document.querySelectorAll(".Login-keypad a");
      for (const button of keypadButtons) {
        const digitDiv = button.querySelector("div");
        if (digitDiv && digitDiv.textContent.trim() === targetDigit) {
          button.click();
          break;
        }
      }
    }, digit);
  }

  // Submit the form
  logger.info("Submitting form...");
  await page.click("#validation");

  await new Promise((resolve) => setTimeout(resolve, 2500)); // Wait to see the result

  logger.info("Accepting privacy policy...");
  // Accept privacy policy
  await page.click("#popin_tc_privacy_button_2");

  logger.info("Clicking on Documents...");
  // Click on Documents on menu
  await page.goto(
    "https://www.credit-agricole.fr/ca-centreloire/particulier/operations/operations-courantes/telechargement.html"
  );

  logger.info("Clicking on the first DownloadAccount-main...");
  // Click on the first DownloadAccount-main
  await page.evaluate(() => {
    const buttons = document.querySelectorAll(".DownloadAccount-main");
    buttons[1].click();
  });

  logger.info("Choosing csv on the select input1...");
  // Choose csv on the select input1
  await page.select("select#input1", "string:csv");

  logger.info("Selecting optradio2...");
  // Select optradio2
  await page.click("#optradio2");

  // set the actual date
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  // choose the date range
  logger.info("Selecting start date (first day of month)...");
  await page.click("#dateFrom");
  await page.evaluate(() => {
    // Find the first available day of the current month (not old, not disabled)
    const availableDays = document.querySelectorAll(
      "td.day:not(.old):not(.disabled):not(.new)"
    );
    if (availableDays.length > 0) {
      availableDays[0].click();
    } else {
      // Fallback: find first day that's just "day" class
      const firstDay = document.querySelector("td.day");
      if (firstDay) firstDay.click();
    }
  });

  logger.info("Selecting end date (last available day)...");
  await page.click("#dateTo");
  await page.evaluate(() => {
    // Find the last available day of the current month (not disabled, not new)
    const availableDays = document.querySelectorAll(
      "td.day:not(.disabled):not(.new):not(.old)"
    );
    if (availableDays.length > 0) {
      availableDays[availableDays.length - 1].click();
    } else {
      // Fallback: find the last day before disabled days
      const allDays = document.querySelectorAll("td.day");
      for (let i = allDays.length - 1; i >= 0; i--) {
        if (
          !allDays[i].classList.contains("disabled") &&
          !allDays[i].classList.contains("new")
        ) {
          allDays[i].click();
          break;
        }
      }
    }
  });

  logger.info("Clicking on Download button...");
  // Click on Download button
  await page.click("#validation-button");

  logger.info("Waiting for download...");
  await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait to see the result

  logger.info("Download ended, closing browser...");
  await browser.close();
})();
