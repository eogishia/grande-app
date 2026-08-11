#!/usr/bin/env node
/**
 * 카드 도구(cards/)에 앱의 자산을 복사한다.
 *
 * 카드 도구는 인스타 게시물을 만드는 내부용 편집기라 사용자 앱과 별도 APK로
 * 나간다. 다만 결과물은 앱과 같은 서체·로고·데이터로 그려져야 하므로,
 * www/ 의 것을 원본으로 삼아 여기서 복사해 온다. cards/ 쪽을 직접 고치지 말 것.
 *
 * 글을 추가한 뒤 카드 APK를 다시 만들 때는 이 스크립트를 먼저 돌린다.
 *
 * 사용법:  node scripts/build_cards.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'www');
const DST = path.join(ROOT, 'cards', 'www');

function copyFile(rel) {
  const from = path.join(SRC, rel), to = path.join(DST, rel);
  if (!fs.existsSync(from)) throw new Error('원본이 없습니다: ' + from);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  return fs.statSync(to).size;
}

function copyDir(rel) {
  const from = path.join(SRC, rel), to = path.join(DST, rel);
  if (!fs.existsSync(from)) throw new Error('원본이 없습니다: ' + from);
  fs.rmSync(to, { recursive: true, force: true });
  fs.cpSync(from, to, { recursive: true });
  let n = 0, bytes = 0;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else { n++; bytes += fs.statSync(p).size; }
    }
  })(to);
  return { n, bytes };
}

const kb = b => (b / 1024).toFixed(0) + 'KB';
const mb = b => (b / 1024 / 1024).toFixed(1) + 'MB';

const q = copyFile('quotes.js');
const logo = copyFile('circle.png');
const f = copyDir('fonts');

// 글 편수를 세어 실제로 최신 데이터가 복사됐는지 눈으로 확인할 수 있게 한다
let count = '?';
try {
  count = new Function(fs.readFileSync(path.join(DST, 'quotes.js'), 'utf8') +
    '; return DEFAULT_QUOTES.length;')();
} catch (e) {}

console.log('cards/www/ 갱신');
console.log('  quotes.js  ' + kb(q) + '  (' + count + '편)');
console.log('  circle.png ' + kb(logo));
console.log('  fonts/     ' + f.n + '개 ' + mb(f.bytes));
