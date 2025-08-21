import puppeteer from 'puppeteer';
import dotenv from 'dotenv';
dotenv.config();

(async () => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    headless: false,    // Show the browser window
    slowMo: 300,        // Add 500ms delay between actions
    devtools: false      // Open DevTools automatically
  });

  // Open a the actual page
  const page = await browser.newPage();
  
  // Listen to console logs from the page
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Navigate the page to a URL
  await page.goto('https://www.credit-agricole.fr/ca-centreloire/particulier/acceder-a-mes-comptes.html');

  // Set screen size, 1920xfull height
  await page.setViewport({width: 1920, height: await page.evaluate(() => document.body.scrollHeight)});

  // Type into id box
  console.log('Typing account number...');
  await page.type('#Login-account', process.env.ACCOUNT_NUMBER);

  // Click on .Login-button
  console.log('Clicking login button...');
  await page.click('.Login-button');

  console.log('Starting password entry...');
  
  // click on each character of the password in .Login-keypad
  // Since digits order is random, we need to find each digit dynamically
  for (let i = 0; i < process.env.PASSWORD.length; i++) {
    const digit = process.env.PASSWORD[i];
    console.log(`Clicking digit: ${digit} (${i + 1}/${process.env.PASSWORD.length})`);
    
    // Find and click the button that contains this digit
    await page.evaluate((targetDigit) => {
      const keypadButtons = document.querySelectorAll('.Login-keypad a');
      for (const button of keypadButtons) {
        const digitDiv = button.querySelector('div');
        if (digitDiv && digitDiv.textContent.trim() === targetDigit) {
          button.click();
          break;
        }
      }
    }, digit); 
  }

  // Submit the form
  console.log('Submitting form...');
  await page.click('#validation');

  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait to see the result

  // Accept privacy policy
  await page.click('#popin_tc_privacy_button_2');

  // Click on Documents on menu
  await page.goto('https://www.credit-agricole.fr/ca-centreloire/particulier/operations/operations-courantes/telechargement.html');

  // Click on the first DownloadAccount-main
  await page.evaluate(() => {
    const buttons = document.querySelectorAll('.DownloadAccount-main');
    buttons[1].click();
  });

  // Choose csv on the select input1
  await page.select('select#input1', 'string:csv');

  // Select optradio2
  await page.click('#optradio2');

  // Click on Download button
  await page.click('#validation-button');

  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait to see the result

  // await browser.close();
})();