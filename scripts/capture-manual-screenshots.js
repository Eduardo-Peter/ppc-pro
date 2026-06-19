const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const OUT_DIR = path.join(__dirname, '..', 'docs', 'manual-assets');
const BASE_URL = process.env.PPC_MANUAL_URL || 'http://127.0.0.1:3000';
const EDGE_PATHS = [
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];

function findBrowser() {
  const found = EDGE_PATHS.find((item) => fs.existsSync(item));
  if (!found) throw new Error('Nenhum navegador compatível encontrado para capturar telas.');
  return found;
}

function ensureOutDir() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function safeClick(page, selector) {
  await page.waitForSelector(selector, { visible: true, timeout: 15000 });
  await page.click(selector);
}

async function setCheckedAndClick(page, radioSelector, buttonSelector) {
  await page.waitForSelector(radioSelector, { timeout: 15000 });
  await page.waitForSelector(buttonSelector, { timeout: 15000 });
  await page.evaluate(({ radioSelector: radio, buttonSelector: button }) => {
    const radioEl = document.querySelector(radio);
    const buttonEl = document.querySelector(button);
    if (!radioEl || !buttonEl) throw new Error('Elemento não encontrado no gateway.');
    radioEl.checked = true;
    radioEl.dispatchEvent(new Event('change', { bubbles: true }));
    buttonEl.click();
  }, { radioSelector, buttonSelector });
}

async function screenshot(page, fileName, opts = {}) {
  await wait(opts.wait || 1200);
  await page.screenshot({
    path: path.join(OUT_DIR, fileName),
    fullPage: false,
  });
}

async function main() {
  ensureOutDir();
  const browser = await puppeteer.launch({
    executablePath: findBrowser(),
    headless: true,
    defaultViewport: { width: 1600, height: 1400, deviceScaleFactor: 1 },
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(BASE_URL, { waitUntil: 'networkidle2' });

  await screenshot(page, '01-login.png', { wait: 500 });

  await page.type('#email', 'admin@ppc.local');
  await page.type('#password', 'admin123');
  await safeClick(page, '#loginForm button[type="submit"]');
  await page.waitForSelector('#gatewayView:not(.hidden)', { timeout: 15000 });

  await setCheckedAndClick(page, 'input[name="adminStartChoice"][value="work"]', '#proceedAdminStart');
  await page.waitForSelector('#adminWorkChoiceStep:not(.hidden)', { timeout: 15000 });
  await setCheckedAndClick(page, 'input[name="adminEntryChoice"][value="select"]', '#proceedAdminWorkChoice');
  await page.waitForSelector('#gatewayAdminWorkSelect option', { timeout: 15000 });
  await page.evaluate(() => {
    const select = document.querySelector('#gatewayAdminWorkSelect');
    if (!select) return;
    const options = Array.from(select.options).filter((item) => item.value);
    if (options[0]) select.value = options[0].value;
  });
  await safeClick(page, '#proceedFromSelectWork');
  await page.waitForSelector('#appView:not(.hidden)', { timeout: 15000 });
  await page.waitForSelector('[data-tab-panel="obrahome"].active', { timeout: 15000 });

  await screenshot(page, '02-tela-inicial.png');

  const shots = [
    { selector: '[data-side-main="preprogramacao"]', file: '03-pre-programacao.png', wait: 3500 },
    { selector: '[data-side-main="reuniaoppc"]', file: '04-reuniao-ppc.png', wait: 3500 },
    { selector: '[data-side-main="programacao"]', file: '05-programacao.png', wait: 3500 },
    { selector: '[data-side-main="atividades"]', file: '06-atividades-previstas.png', wait: 3500 },
    { selector: '[data-side-main="feedback"]', file: '07-feedback.png', wait: 3500 },
    { selector: '[data-side-main="qualidade"]', file: '08-qualidade-percebida.png', wait: 3500 },
    { selector: '[data-side-main="gestao"][data-side-dashboard="relatorio"]', file: '09-relatorio-semanal.png', wait: 3500 },
    { selector: '[data-side-main="cadastros"][data-side-cadastro="works"]', file: '10-cadastro-obra.png', wait: 2000 },
    { selector: '[data-side-main="cadastrosObra"][data-side-obra="zoneamento"]', file: '11-zoneamento.png', wait: 2000 },
  ];

  for (const shot of shots) {
    try {
      console.log(`Capturando ${shot.file}...`);
      await safeClick(page, shot.selector);
      await screenshot(page, shot.file, { wait: shot.wait });
    } catch (error) {
      console.warn(`Falha em ${shot.file}: ${error.message}`);
    }
  }

  await browser.close();
  console.log(`Capturas salvas em: ${OUT_DIR}`);
}

main().catch((error) => {
  console.error('Falha ao capturar telas:', error);
  process.exitCode = 1;
});
