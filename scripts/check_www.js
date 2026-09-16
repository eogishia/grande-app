#!/usr/bin/env node
/**
 * www/ 에 작업용 사본이 섞여 있는지 검사한다.
 *
 * www/ 안의 것은 전부 APK에 실린다. 그런데 .gitignore로 숨긴 파일은 git status에
 * 안 보여서 멀쩡해 보인다 — 실제로 index.html.bak, index_test.html 같은 사본
 * 네 개가 360KB를 차지한 채 사용자 기기로 나가고 있었다. 작업 중인 코드가
 * 그대로 배포되는 것이기도 하다.
 *
 * Capacitor의 capacitor:copy:after 훅에 물려 두어, 복사할 때마다 자동으로 걸린다.
 * 파일 이름만 보고 판단하므로 새 자산(이미지·스크립트)을 막지는 않는다.
 *
 * 직접 실행:  node scripts/check_www.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// 검사 대상: 앱으로 나가는 웹 자산 폴더들
const TARGETS = [
  path.join(ROOT, 'www'),
  path.join(ROOT, 'cards', 'www'),
];

// 작업용 사본에서 흔한 이름들
const SUSPECT = [
  /\.bak\d*$/i,
  /\.orig$/i,
  /\.old$/i,
  /~$/,
  /[._-](back|backup|old|copy|test|temp|tmp|draft|prev|new)\d*\.[a-z0-9]+$/i,
  /\bcopy( \(\d+\))?\.[a-z0-9]+$/i,
  /\.(py|sh|ps1|zip|7z|psd|ai|sketch)$/i,   // 빌드·디자인 파일은 앱에 실릴 이유가 없다
];

const hits = [];
for (const dir of TARGETS) {
  if (!fs.existsSync(dir)) continue;
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (SUSPECT.some(re => re.test(e.name))) {
        hits.push({ rel: path.relative(ROOT, p), size: fs.statSync(p).size });
      }
    }
  })(dir);
}

if (!hits.length) process.exit(0);

const total = hits.reduce((s, h) => s + h.size, 0);
console.error('');
console.error('  ⚠  앱에 실리면 안 되는 파일이 www/ 안에 있습니다');
console.error('');
for (const h of hits) {
  console.error('     ' + h.rel.replace(/\\/g, '/') + '  ' + (h.size / 1024).toFixed(0) + 'KB');
}
console.error('');
console.error('     합계 ' + (total / 1024).toFixed(0) + 'KB — 이대로 빌드하면 사용자 기기로 나갑니다.');
console.error('     data/drafts/ 같은 www/ 밖으로 옮기고 다시 복사하세요.');
console.error('     (.gitignore는 git에서만 숨길 뿐 APK 포함은 막지 못합니다)');
console.error('');
process.exit(1);
