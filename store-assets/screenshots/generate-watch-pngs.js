/**
 * generate-watch-pngs.js
 * 
 * Generates individual PNG screenshots of each LinkLoop Watch mockup
 * using Puppeteer. Saves to store-assets/screenshots/watch/
 * 
 * Usage:  node generate-watch-pngs.js
 * Deps:   npm install puppeteer (one-time)
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const HTML_PATH = path.join(__dirname, 'generate-watch-pngs.html');
const OUT_DIR = path.join(__dirname, 'watch');

const SHOTS = [
  { id: 'shot-1',  name: 'watchface-modular-compact' },
  { id: 'shot-2',  name: 'watchface-infograph' },
  { id: 'shot-3',  name: 'glucose-in-range' },
  { id: 'shot-4',  name: 'glucose-high' },
  { id: 'shot-5',  name: 'glucose-low' },
  { id: 'shot-6',  name: 'graph-3hour' },
  { id: 'shot-7',  name: 'alerts-active' },
  { id: 'shot-8',  name: 'pairing-screen' },
  { id: 'shot-9',  name: 'complication-styles' },
  { id: 'shot-10', name: 'watchface-california-high' },
];

(async () => {
  // Ensure output directory
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1200, deviceScaleFactor: 3 });

  const fileUrl = `file://${HTML_PATH}`;
  console.log(`📄 Loading ${fileUrl}`);
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Wait for fonts to settle
  await new Promise(r => setTimeout(r, 500));

  for (const shot of SHOTS) {
    const outFile = path.join(OUT_DIR, `linkloop-watch-${shot.name}.png`);

    // Get bounding box of the .watch-capture element
    const el = await page.$(`#${shot.id}`);
    if (!el) {
      console.warn(`⚠️  Element #${shot.id} not found, skipping`);
      continue;
    }

    await el.screenshot({
      path: outFile,
      omitBackground: true, // transparent background
    });

    const stats = fs.statSync(outFile);
    const kb = (stats.size / 1024).toFixed(0);
    console.log(`  ✅ ${shot.name}.png  (${kb} KB)`);
  }

  await browser.close();
  console.log(`\n🎉 Done! ${SHOTS.length} PNGs saved to ${OUT_DIR}/`);
})();
