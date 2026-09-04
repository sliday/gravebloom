const { webkit, devices } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

function startServer(dir, port = 8088) {
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.woff2': 'font/woff2',
    '.woff': 'font/woff',
    '.ttf': 'font/ttf',
    '.svg': 'image/svg+xml',
    '.png': 'image/png'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0];

    // Mock API endpoints for local verification
    if (reqPath === '/api/presence') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ count: 1, ok: true }));
      return;
    }
    if (reqPath === '/api/lobby') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ role: 'host', room: 'mock123' }));
      return;
    }

    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.join(dir, reqPath);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  });

  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

async function verify() {
  const distDir = path.join(__dirname, '..', 'dist');
  const port = 8088;
  const server = await startServer(distDir, port);
  console.log(`Test server running at http://localhost:${port}`);

  const browser = await webkit.launch({ headless: true });
  const context = await browser.newContext({
    ...devices['iPhone 14'],
    hasTouch: true
  });

  const page = await context.newPage();
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => {
    consoleErrors.push(err.toString());
  });
  page.on('response', (res) => {
    if (res.status() >= 400) {
      console.log(`Resource 404: ${res.url()}`);
    }
  });

  await page.goto(`http://localhost:${port}`);
  await page.waitForLoadState('networkidle');

  console.log('Page loaded successfully');

  // Verify layout on iPhone 14 (390x844)
  const ip14LayoutCheck = await page.evaluate(() => {
    const restartBtn = document.getElementById('btn-restart');
    const rRect = restartBtn.getBoundingClientRect();
    const app = document.getElementById('app');
    const aRect = app.getBoundingClientRect();
    const cards = document.querySelectorAll('.card-item');
    const lastCard = cards[cards.length - 1].getBoundingClientRect();

    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      restartRight: rRect.right,
      appRight: aRect.right,
      restartFits: rRect.right <= aRect.right + 1,
      lastCardBottom: lastCard.bottom,
      lastCardFits: lastCard.bottom <= window.innerHeight + 1
    };
  });
  console.log('iPhone 14 Layout check:', ip14LayoutCheck);

  // Select Pawn
  const pawnCard = page.locator('.card-item').first();
  await pawnCard.dispatchEvent('pointerdown');
  console.log('Selected Pawn card');

  // Deploy on row 7, col 4 (directly charging enemy King's file!)
  await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    // Col 4, Row 7 (trench)
    const ev = new PointerEvent('pointerdown', {
      clientX: rect.left + rect.width * 0.55,
      clientY: rect.top + rect.height * 0.52,
      bubbles: true
    });
    canvas.dispatchEvent(ev);
  });
  console.log('Deployed Pawn on Trench');

  // Wait 1.5s
  await page.waitForTimeout(1500);

  // Select Knight (index 1)
  const knightCard = page.locator('.card-item').nth(1);
  await knightCard.dispatchEvent('pointerdown');
  console.log('Selected Knight card');

  // Deploy Knight on row 7, col 3
  await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const rect = canvas.getBoundingClientRect();
    const ev = new PointerEvent('pointerdown', {
      clientX: rect.left + rect.width * 0.42,
      clientY: rect.top + rect.height * 0.52,
      bubbles: true
    });
    canvas.dispatchEvent(ev);
  });
  console.log('Deployed Knight on Trench');

  // Wait 3 seconds for combat and targeting tethers to engage
  console.log('Watching moves and combat animations unfold...');
  await page.waitForTimeout(3000);

  // Take screenshot of animated combat and targeting
  const combatScreenshotPath = path.join(__dirname, '..', 'mobile-combat-effects.png');
  await page.screenshot({ path: combatScreenshotPath });
  console.log(`Combat effects screenshot saved to ${combatScreenshotPath}`);

  // Test 1v1 P2P Lobby Modal
  console.log('Testing 1v1 P2P Lobby Modal...');
  await page.locator('#btn-mode-hotseat').click();
  await page.waitForTimeout(600);

  const p2pVisible = await page.locator('#p2p-modal').isVisible();
  console.log(`P2P Lobby Modal opened: ${p2pVisible}`);

  const p2pScreenshotPath = path.join(__dirname, '..', 'mobile-chess-p2p.png');
  await page.screenshot({ path: p2pScreenshotPath });
  console.log(`P2P lobby screenshot saved to ${p2pScreenshotPath}`);

  await page.locator('#btn-close-p2p').click();

  // Verify layout on iPhone SE (375x667)
  console.log('Testing iPhone SE (375x667) layout...');
  const seContext = await browser.newContext({
    ...devices['iPhone SE'],
    hasTouch: true
  });
  const sePage = await seContext.newPage();
  await sePage.goto(`http://localhost:${port}`);
  await sePage.waitForLoadState('networkidle');

  const seLayoutCheck = await sePage.evaluate(() => {
    const restartBtn = document.getElementById('btn-restart');
    const rRect = restartBtn.getBoundingClientRect();
    const app = document.getElementById('app');
    const aRect = app.getBoundingClientRect();
    const cards = document.querySelectorAll('.card-item');
    const lastCard = cards[cards.length - 1].getBoundingClientRect();

    const brand = document.querySelector('.brand-title').getBoundingClientRect();
    const online = document.querySelector('.online-badge').getBoundingClientRect();
    const diff = document.querySelector('.diff-badge').getBoundingClientRect();
    const mode = document.querySelector('.mode-selector').getBoundingClientRect();

    return {
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      brandW: brand.width,
      onlineW: online.width,
      diffW: diff.width,
      modeW: mode.width,
      restartW: rRect.width,
      restartRight: rRect.right,
      appRight: aRect.right,
      restartFits: rRect.right <= aRect.right + 1,
      lastCardBottom: lastCard.bottom,
      lastCardFits: lastCard.bottom <= window.innerHeight + 1
    };
  });
  console.log('iPhone SE Layout check:', seLayoutCheck);
  await sePage.screenshot({ path: path.join(__dirname, '..', 'iphone-se-layout.png') });
  await seContext.close();

  if (consoleErrors.length > 0) {
    console.error('Console errors:', consoleErrors);
  } else {
    console.log('Verification PASSED: 0 console errors!');
  }

  await browser.close();
  server.close();
}

verify().catch((e) => {
  console.error('Verification failed:', e);
  process.exit(1);
});
