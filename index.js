import puppeteer from "puppeteer";
import dotenv from "dotenv";
import pino from "pino";
import pinoPretty from "pino-pretty";
import fs from "node:fs";
import path from "node:path";

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

// On any failure: save a screenshot + a dump of the page (including shadow DOM) in ./debug
let currentPage = null;
process.on("unhandledRejection", async (err) => {
  logger.error(err);
  if (currentPage) {
    try {
      fs.mkdirSync("debug", { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      logger.error(`Failed on URL: ${currentPage.url()}`);
      await currentPage.screenshot({ path: `debug/${stamp}.png`, fullPage: true });
      fs.writeFileSync(`debug/${stamp}.html`, await currentPage.content());
      const elements = await currentPage.evaluate(() => {
        const out = [];
        const walk = (root, depth) => {
          for (const el of root.querySelectorAll("*")) {
            if (el.matches("input,button,a,select,[role=button],[onclick]") || el.tagName.includes("-")) {
              out.push({
                depth,
                tag: el.tagName.toLowerCase(),
                id: el.id,
                class: String(el.className).slice(0, 80),
                attrs: [...el.attributes].map((a) => `${a.name}=${a.value.slice(0, 40)}`).join(" | "),
                text: (el.innerText || "").trim().slice(0, 40),
              });
            }
            if (el.shadowRoot) walk(el.shadowRoot, depth + 1);
          }
        };
        walk(document, 0);
        return out;
      });
      fs.writeFileSync(`debug/${stamp}.json`, JSON.stringify(elements, null, 2));
      logger.error(`Debug files written to debug/${stamp}.*`);
    } catch (e) {
      logger.error(`Could not write debug files: ${e.message}`);
    }
  }
  process.exit(1);
});

// Click the first clickable element (searching inside shadow roots too) whose text matches
async function deepClickByText(page, texts) {
  return page.evaluate((texts) => {
    const walk = (root) => {
      for (const el of root.querySelectorAll("*")) {
        if (
          el.matches("a,button,[role=button],mds-button,li,div[tabindex]") &&
          texts.includes((el.innerText || el.textContent || "").trim())
        ) {
          el.click();
          return true;
        }
        if (el.shadowRoot && walk(el.shadowRoot)) return true;
      }
      return false;
    };
    return walk(document);
  }, texts);
}

// Wait for an iframe whose URL contains `urlPart`
async function waitForFrame(page, urlPart, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const frame = page.frames().find((f) => f.url().includes(urlPart));
    if (frame) return frame;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Frame ${urlPart} not found`);
}

// Click the first element matching `selector` whose text is exactly `text`
async function clickByText(frame, selector, text) {
  const ok = await frame.evaluate(
    (selector, text) => {
      const el = [...document.querySelectorAll(selector)].find(
        (e) => (e.innerText || e.textContent || "").trim() === text
      );
      if (!el) return false;
      el.click();
      return true;
    },
    selector,
    text
  );
  if (!ok) throw new Error(`"${text}" not found`);
}

// Retry an action if the page navigated underneath it (CA's site reloads itself after load)
async function withRetry(page, label, fn, attempts = 4) {
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      const navError =
        /Execution context was destroyed|detached Frame|Cannot find context/i.test(err.message);
      if (!navError || i === attempts) throw err;
      logger.warn(`${label}: page navigated, retrying (${i}/${attempts - 1})...`);
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
    }
  }
}

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: process.env.HEADLESS === "true", // HEADLESS=true in .env to hide the browser window
    slowMo: 100, // Add 100ms delay between actions
    devtools: false, // Open DevTools automatically
    // Keep cookies between runs, otherwise CA asks to confirm the device ("Sécurisation de votre connexion") every time
    userDataDir: "./browser-profile",
  });

  // Open a the actual page
  const page = await browser.newPage();
  currentPage = page;

  // Navigate the page to a URL
  await page.goto(
    "https://www.credit-agricole.fr/ca-centreloire/particulier/acceder-a-mes-comptes.html",
    { waitUntil: "networkidle2" }
  );

  // Set screen size, 1920xfull height
  await page.setViewport({
    width: 1920,
    height: await page.evaluate(() => document.body.scrollHeight),
  });

  // Type into id box
  logger.info("Typing account number...");
  await withRetry(page, "Account number", async () => {
    // New CA Connect login page: the real <input> lives inside <mds-input>'s shadow root
    const accountInput = 'mds-input[name="identifiant"] >>> input';
    await page.waitForSelector(accountInput, { visible: true });
    await page.type(accountInput, process.env.ACCOUNT_NUMBER);
  });

  // Click on .Login-button
  logger.info("Clicking login button...");
  await withRetry(page, "Login button", () => page.click('mds-button[type="submit"]'));
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});

  logger.info("Starting password entry...");

  // click on each character of the password in .Login-keypad
  // Since digits order is random, we need to find each digit dynamically
  for (let i = 0; i < process.env.PASSWORD.length; i++) {
    const digit = process.env.PASSWORD[i];
    logger.info(
      `Clicking digit: ${digit} (${i + 1}/${process.env.PASSWORD.length})`
    );

    // Find and click the keypad key showing this digit (also searches shadow DOM)
    const clicked = await deepClickByText(page, [digit]);
    if (!clicked) throw new Error(`Keypad key "${digit}" not found`);
  }

  // Submit the form
  logger.info("Submitting form...");
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }).catch(() => {}),
    (async () => {
      if (await page.$("#validation")) return page.click("#validation");
      if (!(await deepClickByText(page, ["Valider", "Se connecter"])))
        throw new Error("Submit button not found");
    })(),
  ]);

  // Device confirmation ("Sécurisation de votre connexion") + push notification on the phone.
  // Only shows up when the browser profile isn't trusted yet (first run, expired cookies...).
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  if (await deepClickByText(page, ["Commencer"])) {
    logger.warn("Confirmation de l'appareil demandée : validez la notification sur votre téléphone (5 min max)...");
  }
  if (!page.url().includes("espace-client.credit-agricole.fr")) {
    await page.waitForFunction(
      () => location.hostname === "espace-client.credit-agricole.fr",
      { timeout: 5 * 60 * 1000, polling: 1000 }
    );
  }
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {});
  logger.info("Connecté à l'espace client.");

  // Cookie banner (same ids as before): _2 = "Accepter et fermer", _3 = "Continuer sans accepter"
  try {
    await page.waitForSelector("#popin_tc_privacy_button_3", { visible: true, timeout: 5000 });
    await page.click("#popin_tc_privacy_button_3");
    logger.info("Cookie banner closed.");
  } catch {
    logger.info("No cookie banner, skipping.");
  }

  // Files go to ./downloads (also works for downloads started inside the iframe)
  const downloadDir = path.resolve("downloads");
  fs.mkdirSync(downloadDir, { recursive: true });
  const cdp = await browser.target().createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadDir,
    eventsEnabled: true,
  });
  const filesBefore = new Set(fs.readdirSync(downloadDir));

  logger.info("Opening the download page...");
  await page.goto(
    "https://espace-client.credit-agricole.fr/ca-centreloire/particulier/operations-courantes/telechargement-operations",
    { waitUntil: "networkidle2" }
  );

  // The form lives in a cross-origin iframe
  const frame = await waitForFrame(page, "telechargement-operations.credit-agricole.fr");
  const accountToDownload = process.env.DOWNLOAD_ACCOUNT || "xxxxxxxx";
  await frame.waitForFunction(
    (acc) => document.body && document.body.innerText.includes(acc),
    { timeout: 30000 },
    accountToDownload
  );

  logger.info(`Selecting account ${accountToDownload}...`);
  const accountChecked = await frame.evaluate((acc) => {
    const boxes = [...document.querySelectorAll('input[type="checkbox"]')];
    for (const box of boxes) {
      // climb up from the checkbox until we reach the card that holds the account number
      let card = box.parentElement;
      while (card && !card.innerText.includes(acc)) card = card.parentElement;
      if (!card || card.innerText.includes("Sélectionner tous")) continue;
      if (!box.checked) box.click();
      return true;
    }
    return false;
  }, accountToDownload);
  if (!accountChecked) throw new Error(`Account ${accountToDownload} checkbox not found`);

  logger.info("Choosing CSV format...");
  const csvSelected = await frame.evaluate(() => {
    for (const select of document.querySelectorAll("select")) {
      const option = [...select.options].find((o) => /csv/i.test(o.textContent));
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event("input", { bubbles: true }));
        select.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
    }
    return false;
  });
  if (!csvSelected) throw new Error("CSV option not found in the Format list");

  logger.info("Selecting custom period...");
  await clickByText(frame, "label, span, div", "Période personnalisée");

  // Last month up to yesterday, e.g. 22/09/2026 -> 22/10/2026 when run on 23/10/2026
  const fmt = (d) =>
    `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  const to = new Date();
  to.setDate(to.getDate() - 1);
  const from = new Date(to);
  from.setMonth(from.getMonth() - 1);
  logger.info(`Period: ${fmt(from)} -> ${fmt(to)}`);

  const dateInputs = await frame.$$('input[placeholder="JJ/MM/AAAA"]');
  if (dateInputs.length < 2) throw new Error("Date inputs not found");
  for (const [input, value] of [[dateInputs[0], fmt(from)], [dateInputs[1], fmt(to)]]) {
    await input.click({ clickCount: 3 });
    await input.type(value, { delay: 50 });
    await frame.evaluate((el) => el.blur(), input);
  }

  logger.info("Clicking on Download button...");
  await clickByText(frame, "button", "Télécharger mes opérations");

  await frame.waitForFunction(
    () => document.body.innerText.includes("Téléchargement terminé"),
    { timeout: 30000 }
  );

  // Wait for the file to be fully written (no more .crdownload)
  logger.info("Waiting for download...");
  let newFile = null;
  for (let t = 0; t < 30 && !newFile; t++) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    newFile = fs
      .readdirSync(downloadDir)
      .find((f) => !filesBefore.has(f) && !f.endsWith(".crdownload"));
  }
  if (!newFile) throw new Error("Download did not finish within 30s");
  logger.info(`Downloaded: ${path.join(downloadDir, newFile)}`);

  await browser.close();
})();
