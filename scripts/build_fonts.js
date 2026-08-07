#!/usr/bin/env node
/**
 * 웹폰트를 www/fonts/ 에 내려받아 오프라인에서도 쓸 수 있게 만든다.
 *
 * 왜 필요한가: 예전에는 index.html이 Google Fonts와 jsDelivr에서 @import로
 * 서체를 받아왔다. 타이포그래피가 곧 정체성인 앱인데 네트워크가 없으면 본문이
 * 시스템 명조로 떨어졌고, 인스타 공유 이미지(buildStoryCanvas)까지 같은 서체를
 * 쓰기 때문에 브랜드가 통째로 무너졌다.
 *
 * 방식: 두 서체 모두 unicode-range로 잘게 쪼갠 subset을 제공한다. 전부 번들해도
 * 브라우저는 필요한 조각만 읽으므로 런타임 비용은 없고, 비용은 APK 용량뿐이다.
 * 일부만 담으면 사용자가 서랍에 쓴 글에서 글자가 깨지는데, 그건 지금 고치려는
 * 버그의 드문 버전일 뿐이라 전량을 담는다.
 *
 * 쓰는 웨이트는 실제 사용처에서 확인한 것만 담는다.
 *   Noto Serif KR 300  — 본문 전용 (--serif 사용처 전부와 캔버스가 300)
 *   Pretendard 300/400 — UI·저자·출처
 *
 * 사용법:  node scripts/build_fonts.js
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'www', 'fonts');
const CACHE = path.join(require('os').tmpdir(), 'grande-font-cache');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
           '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const NSK_CSS = 'https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@300&display=swap';
const PRE_CSS = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.css';
const PRE_BASE = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/woff2-dynamic-subset';
const PRE_WEIGHTS = [['Light', 300], ['Regular', 400]];

function get(url, binary) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': UA } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume(); return get(res.headers.location, binary).then(resolve, reject);
      }
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(url + ' → HTTP ' + res.statusCode)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(binary ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
    }).on('error', reject);
  });
}

// 같은 파일을 여러 번 받지 않도록 캐시한다. 폰트는 버전이 고정돼 있어 안전하다.
async function cached(url, name) {
  const p = path.join(CACHE, name);
  if (fs.existsSync(p) && fs.statSync(p).size > 0) return fs.readFileSync(p);
  const buf = await get(url, true);
  fs.writeFileSync(p, buf);
  return buf;
}

// @font-face 블록에서 (woff2 URL, unicode-range) 쌍을 뽑는다
function parseFaces(css) {
  const out = [];
  for (const block of css.split('@font-face').slice(1)) {
    const url = (block.match(/url\(([^)]*\.woff2)\)/) || [])[1];
    const range = (block.match(/unicode-range:\s*([^;]+);/) || [])[1];
    if (url && range) out.push({ url: url.trim(), range: range.trim() });
  }
  return out;
}

async function pool(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0, done = 0, lastPct = -1;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
      const pct = Math.floor(++done / items.length * 100);
      if (pct >= lastPct + 10) { lastPct = pct; process.stdout.write('  ' + pct + '%\r'); }
    }
  }));
  return results;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(CACHE, { recursive: true });

  let css = '/* 이 파일은 scripts/build_fonts.js가 생성합니다. 직접 고치지 마세요. */\n';
  let bytes = 0, files = 0;

  // ── Noto Serif KR 300 (본문) ──
  console.log('Noto Serif KR 300 …');
  const nskFaces = parseFaces(await get(NSK_CSS, false));
  console.log('  subset ' + nskFaces.length + '개');
  const nsk = await pool(nskFaces, 12, async (f, i) => {
    const name = 'noto-serif-kr-300-' + i + '.woff2';
    const buf = await cached(f.url, name);
    fs.writeFileSync(path.join(OUT, name), buf);
    return { name, size: buf.length, range: f.range };
  });
  for (const f of nsk) {
    css += '@font-face{font-family:"Noto Serif KR";font-style:normal;font-weight:300;' +
           'font-display:swap;src:url(' + f.name + ') format("woff2");unicode-range:' + f.range + ';}\n';
    bytes += f.size; files++;
  }

  // ── Pretendard 300 / 400 (UI) ──
  const preCss = await get(PRE_CSS, false);
  for (const [style, weight] of PRE_WEIGHTS) {
    console.log('Pretendard ' + weight + ' …');
    // 공용 CSS에는 9종 웨이트가 다 들어 있으므로 쓰는 것만 골라낸다
    const faces = parseFaces(preCss).filter(f => f.url.includes('Pretendard-' + style + '.subset.'));
    console.log('  subset ' + faces.length + '개');
    const got = await pool(faces, 12, async (f, i) => {
      const src = PRE_BASE + '/' + path.basename(f.url);
      const name = 'pretendard-' + weight + '-' + i + '.woff2';
      const buf = await cached(src, name);
      fs.writeFileSync(path.join(OUT, name), buf);
      return { name, size: buf.length, range: f.range };
    });
    for (const f of got) {
      css += '@font-face{font-family:"Pretendard";font-style:normal;font-weight:' + weight + ';' +
             'font-display:swap;src:url(' + f.name + ') format("woff2");unicode-range:' + f.range + ';}\n';
      bytes += f.size; files++;
    }
  }

  fs.writeFileSync(path.join(OUT, 'fonts.css'), css);
  console.log('\nwww/fonts/ : ' + files + '개 파일, ' + (bytes / 1024 / 1024).toFixed(1) + 'MB');
  console.log('fonts.css  : ' + (fs.statSync(path.join(OUT, 'fonts.css')).size / 1024).toFixed(0) + 'KB');
})().catch(e => { console.error('실패:', e.message); process.exit(1); });
