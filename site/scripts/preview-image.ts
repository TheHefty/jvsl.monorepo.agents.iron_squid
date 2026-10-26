// Renders site/public/preview.png, the image a posted link previews with (FR-72): 1200×630, the
// logo and the wordmark on the ink ground, all our own drawing. Run by a person when the logo
// changes, never by the build: the image is committed, and scripts/preview-image.source.json records
// the logo it was made from, which a scenario holds to the current one.
//
//   npx tsx scripts/preview-image.ts
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const logo = readFileSync('public/logo.svg', 'utf8');
// Embedded: a page set from a string cannot load a file:// font, and would fall back silently.
const font = `data:font/woff2;base64,${readFileSync('src/fonts/InterVariable.woff2').toString('base64')}`;
const page = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: Inter; src: url('${font}') format('woff2'); font-weight: 100 900; }
html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
body { position: relative; background: #262a60; font-family: Inter, sans-serif; color: #f3f5fe; }
.splat { position: absolute; background: #353b80; }
.mark { position: absolute; left: 96px; top: 165px; width: 300px; height: 300px; }
.mark svg { width: 100%; height: 100%; }
.name { position: absolute; left: 440px; top: 230px; font-size: 112px; font-weight: 500;
  letter-spacing: -0.02em; line-height: 1; text-transform: uppercase; }
.tag { position: absolute; left: 446px; top: 372px; transform: rotate(-2deg); background: #9184d9;
  color: #161826; font-size: 26px; font-weight: 600; letter-spacing: 0.14em; padding: 8px 18px;
  border-radius: 6px; text-transform: uppercase; }
</style></head><body>
<div class="splat" style="width:520px;height:520px;right:-140px;top:-190px;border-radius:58% 42% 39% 61% / 47% 55% 45% 53%"></div>
<div class="splat" style="width:150px;height:150px;right:300px;bottom:40px;border-radius:52% 48% 61% 39% / 44% 62% 38% 56%"></div>
<div class="splat" style="width:240px;height:240px;left:-90px;bottom:-110px;background:#1e2150;border-radius:47% 53% 62% 38% / 58% 41% 59% 42%"></div>
<div class="mark">${logo}</div>
<div class="name">Iron Squid</div>
<div class="tag">Splatoon 3 challenge</div>
</body></html>`;

const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await tab.setContent(page, { waitUntil: 'load' });
await tab.evaluate(() => document.fonts.ready);
if (!(await tab.evaluate(() => document.fonts.check('500 112px Inter'))))
  throw new Error('preview-image: Inter did not load; the image would use another font');
const png = await tab.screenshot({ type: 'png' });
await browser.close();

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
writeFileSync('public/preview.png', png);
writeFileSync(
  'scripts/preview-image.source.json',
  JSON.stringify({ logo: sha(logo), image: sha(png) }, null, 2) + '\n',
);
console.log(
  `preview-image: public/preview.png written, 1200×630, from logo ${sha(logo).slice(0, 12)}`,
);
