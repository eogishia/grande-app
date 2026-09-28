#!/usr/bin/env node
/*
 * Grande 인스타 카드 렌더러
 *
 *   node render/render.mjs drafts/2026-09-30_p59/post.json
 *
 * 카드 도구(cards/www/index.html)를 브라우저 없이(headless) 열어, 편집 화면과
 * 똑같은 코드(twist.js)로 반전 카루셀을 그린다. 결과는 post.json이 있는 폴더에 저장된다.
 * 먼저 node scripts/build_cards.js 로 cards/www에 quotes.js·서체를 채워 둬야 한다.
 *   1.jpg … 5.jpg   게시용 이미지 (1080×1350, JPEG 품질 93 · 인스타가 어차피 JPEG로 다시 압축함)
 *   preview.jpg     한눈에 보는 시안
 *   caption.txt     캡션
 *
 * 서체는 도구에 번들된 것(fonts/ · twist-fonts/)만 쓴다. 네트워크에 접속하지 않는다.
 * 종료 코드: 0 정상 · 2 경고 있음(밑줄을 못 찾음 등) · 1 실패
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', 'cards', 'www');   // 카드 도구 (build_cards.js로 quotes.js·서체를 채운 상태)
const PAGE = 'index.html';
const HANDLE = process.env.GRANDE_HANDLE || 'grande_book';

const postPath = process.argv[2];
if (!postPath) { console.error('사용법: node insta/render.mjs <post.json>'); process.exit(1); }
const post = JSON.parse(fs.readFileSync(postPath, 'utf8'));
if (!post.id || !post.hook) { console.error('post.json에는 id와 hook이 있어야 합니다.'); process.exit(1); }
const OUT = path.dirname(path.resolve(postPath));

/* ── 정적 서버: 카드 도구(cards/www)를 그대로 띄운다 ── */
const TYPES = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css',
  '.woff2':'font/woff2', '.woff':'font/woff', '.png':'image/png', '.json':'application/json' };
for (const need of ['quotes.js', 'circle.png', 'fonts/fonts.css']) {
  if (!fs.existsSync(path.join(ROOT, need))) {
    console.error(`cards/www/${need}가 없습니다. 먼저 node scripts/build_cards.js 를 실행하세요.`);
    process.exit(1);
  }
}
const server = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const file = path.join(ROOT, decodeURIComponent(u.pathname.slice(1) || PAGE));
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const ORIGIN = `http://127.0.0.1:${server.address().port}`;

/* ── 크로미움 찾기: 환경변수 → playwright 기본 → 시스템 → @sparticuz/chromium ── */
async function launch() {
  const { chromium } = await import('playwright-core');
  const tries = [];
  if (process.env.CHROME_PATH) tries.push({ executablePath: process.env.CHROME_PATH });
  tries.push({});                                     // npx playwright install chromium 으로 받은 것
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
                   '/usr/bin/google-chrome-stable'])
    if (fs.existsSync(p)) tries.push({ executablePath: p });
  const errors = [];
  for (const opt of tries) {
    try { return await chromium.launch({ headless: true, ...opt }); }
    catch (e) { errors.push(String(e.message || e).split('\n')[0]); }
  }
  try {
    const sp = (await import('@sparticuz/chromium')).default;
    return await chromium.launch({ headless: true, executablePath: await sp.executablePath(), args: sp.args });
  } catch (e) { errors.push('sparticuz: ' + String(e.message || e).split('\n')[0]); }
  throw new Error('크로미움을 실행하지 못했습니다:\n  ' + errors.join('\n  '));
}

let browser, code = 0;
try {
  browser = await launch();
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('페이지 오류: ' + e.message));

  // 도구는 전부 로컬 파일로 돈다. 바깥 요청은 막는다.
  await page.route('**/*', (route) => route.request().url().startsWith(ORIGIN) ? route.continue() : route.abort());

  // 초안 문구는 생성기의 '기기 저장 초안'으로 넣는다. posts.js는 건드리지 않는다.
  const drafts = { [post.id]: post };
  await page.addInitScript(([d, h]) => {
    localStorage.setItem('grande_ig_twist', d);
    localStorage.setItem('grande_ig_handle', h);
  }, [JSON.stringify(drafts), HANDLE]);

  await page.goto(`${ORIGIN}/${PAGE}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.GRANDE && window.GRANDE.ready, null, { timeout: 60000 });

  const r = await page.evaluate((id) => window.GRANDE.render(id), post.id);

  // PNG는 장당 1MB가 넘어 저장소가 금방 무거워진다. 게시용은 고품질 JPEG로 충분하다.
  const jpgs = await page.evaluate(async (pngs) => Promise.all(pngs.map((src) => new Promise((ok) => {
    const im = new Image();
    im.onload = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0); ok(c.toDataURL('image/jpeg', 0.93)); };
    im.src = src;
  }))), r.pngs);
  jpgs.forEach((d, i) => fs.writeFileSync(path.join(OUT, `${i + 1}.jpg`), Buffer.from(d.split(',')[1], 'base64')));
  fs.writeFileSync(path.join(OUT, 'caption.txt'), r.caption + '\n');

  // 한눈에 보는 시안 (가로로 이어 붙인 JPG)
  const preview = await page.evaluate(async (pngs) => {
    const imgs = await Promise.all(pngs.map((src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; })));
    const w = 432, h = 540, gap = 12;
    const c = document.createElement('canvas');
    c.width = imgs.length * (w + gap) - gap; c.height = h;
    const x = c.getContext('2d'); x.fillStyle = '#EDEAE3'; x.fillRect(0, 0, c.width, c.height);
    imgs.forEach((im, i) => x.drawImage(im, i * (w + gap), 0, w, h));
    return c.toDataURL('image/jpeg', 0.9);
  }, r.pngs);
  fs.writeFileSync(path.join(OUT, 'preview.jpg'), Buffer.from(preview.split(',')[1], 'base64'));

  console.log(`카드 ${r.pngs.length}장: ${r.names.join(' · ')}`);
  console.log(`저장: ${path.relative(process.cwd(), OUT)}`);
  const problems = [...logs];
  if (r.warn) problems.push('생성기 경고: ' + r.warn);
  if (r.pngs.length < 4) problems.push(`카드가 ${r.pngs.length}장뿐입니다. hook이나 본문이 빠졌는지 확인하세요.`);
  if (problems.length) { console.log('\n⚠ ' + problems.join('\n⚠ ')); code = 2; }
} catch (e) {
  console.error('렌더 실패: ' + (e.stack || e));
  code = 1;
} finally {
  if (browser) await browser.close();
  server.close();
}
process.exit(code);
