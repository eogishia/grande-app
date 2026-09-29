#!/usr/bin/env node
/*
 * Grande 인스타 초안함 페이지 만들기
 *
 *   node insta/inbox.mjs             → insta/drafts/inbox.html
 *
 * insta/drafts/ 아래 최근 초안 3편(1.jpg~5.jpg · caption.txt · memo.md · post.json)을
 * 한 장짜리 HTML에 담는다. 이미지는 파일 안에 들어가므로 이 파일 하나만 Claude 아티팩트로
 * 게시하면 휴대폰의 Claude 앱에서 바로 보고, 저장하고, 캡션을 복사할 수 있다.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUOTES_JS = path.resolve(HERE, '..', 'www', 'quotes.js');   // 앱의 원본
const DRAFTS = path.join(HERE, 'drafts');
const KEEP = Number(process.env.INBOX_KEEP || 3);

/* 본문 정보(저자 · 책) */
const qctx = { window: {} };
vm.runInNewContext(fs.readFileSync(QUOTES_JS, 'utf8') + ';window.Q=DEFAULT_QUOTES;', qctx);
const Q = Object.fromEntries((qctx.window.Q || []).map((q) => [q.id, q]));

/* 최근 초안 */
const dirs = fs.readdirSync(DRAFTS)
  .filter((d) => /^\d{4}-\d{2}-\d{2}_/.test(d) && fs.existsSync(path.join(DRAFTS, d, '1.jpg')))
  .sort().reverse().slice(0, KEEP);
if (!dirs.length) { console.error('보여줄 초안이 없습니다 (insta/drafts/<날짜>_<id>/1.jpg).'); process.exit(1); }

const read = (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* 메모용 아주 작은 마크다운 변환 (제목 · 목록 · 굵게 · 링크) */
function md(src) {
  const inline = (t) => esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>');
  const out = []; let list = false;
  for (const line of src.split('\n')) {
    const h = line.match(/^(#{1,4})\s+(.*)/), li = line.match(/^\s*[-*]\s+(.*)/);
    if (!li && list) { out.push('</ul>'); list = false; }
    if (h) out.push(`<h4>${inline(h[2])}</h4>`);
    else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('\n');
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function dateLabel(d) {
  const [y, m, day] = d.split('-').map(Number);
  const w = WEEK[new Date(Date.UTC(y, m - 1, day)).getUTCDay()];
  return `${m}월 ${day}일 (${w})`;
}

const drafts = dirs.map((d) => {
  const dir = path.join(DRAFTS, d);
  const post = JSON.parse(read(path.join(dir, 'post.json')) || '{}');
  const q = Q[post.id] || {};
  const imgs = [1, 2, 3, 4, 5]
    .map((n) => path.join(dir, `${n}.jpg`)).filter((p) => fs.existsSync(p))
    .map((p) => 'data:image/jpeg;base64,' + fs.readFileSync(p).toString('base64'));
  return {
    key: d, date: d.slice(0, 10), id: post.id || d.slice(11),
    author: q.author || '', book: q.bookTitle || (q.source || '').split(',')[0],
    hook: post.hook || '', conf: post.confidence || '', rev: Number(post.revision || 0),
    caption: read(path.join(dir, 'caption.txt')).trim(),
    memo: md(read(path.join(dir, 'memo.md'))), imgs,
  };
});

const CONF = { '◎': '확실', '○': '확인 필요', '△': '불확실' };
function article(x, open) {
  const conf = x.conf ? `<span class="conf" data-c="${esc(x.conf)}">${esc(x.conf)} ${esc(CONF[x.conf] || '')}</span>` : '';
  const slides = x.imgs.map((src, i) => `
        <figure class="slide">
          <img src="${src}" alt="${i + 1}번 카드" loading="${open ? 'eager' : 'lazy'}" decoding="async">
          <figcaption><span>${i + 1} / ${x.imgs.length}</span><button class="save-one" data-draft="${x.key}" data-i="${i}" hidden>이 장 저장</button></figcaption>
        </figure>`).join('');
  const body = `
      <div class="hook">${esc(x.hook).replace(/\n/g, '<br>')}</div>
      <div class="rail" tabindex="0" aria-label="카드 5장">${slides}
      </div>
      <div class="actions">
        <button class="btn primary save-all" data-draft="${x.key}" hidden>이미지 ${x.imgs.length}장 저장</button>
        <p class="hint">이미지를 길게 눌러도 저장할 수 있어요.</p>
      </div>
      <section class="cap">
        <div class="cap-head"><h3>캡션</h3><button class="btn ghost copy" data-draft="${x.key}">캡션 복사</button></div>
        <textarea readonly rows="9" id="cap-${x.key}">${esc(x.caption)}</textarea>
      </section>
      <details class="memo"><summary>검증 메모</summary><div class="memo-body">${x.memo || '<p>메모가 없습니다.</p>'}</div></details>${open ? `
      <aside class="fb">
        <h3>고치고 싶은 곳이 있다면</h3>
        <p>Grande 프로젝트 채팅에서 그대로 말해 주세요.
        "훅을 더 짧게", "밑줄을 둘째 문단으로"처럼요. 고친 버전이 이 페이지에 다시 올라오고,
        다음 초안에도 적용할 기준은 따로 기록돼 쌓입니다.</p>
      </aside>` : ''}`;
  const rev = x.rev ? `<span class="rev">수정 ${x.rev}회</span>` : '';
  const head = `<div class="meta"><time>${dateLabel(x.date)}</time><span class="who">${esc(x.author)}${x.book ? ` 『${esc(x.book)}』` : ''}</span>${rev}${conf}</div>`;
  return open
    ? `<article class="draft latest">${head}${body}</article>`
    : `<details class="draft older"><summary>${head}<span class="peek">${esc(x.hook.split('\n')[0])}</span></summary>${body}</details>`;
}

const STATE = {
  updated: new Date().toISOString(),
  used: read(path.join(HERE, 'used.md')),
  feedback: read(path.join(HERE, 'feedback.md')),
  drafts: dirs.map((d) => ({ key: d, post: JSON.parse(read(path.join(DRAFTS, d, 'post.json')) || '{}'),
                             memo: read(path.join(DRAFTS, d, 'memo.md')) })),
};
const IMG_DATA = Object.fromEntries(drafts.map((x) => [x.key, x.imgs]));
const NAMES = Object.fromEntries(drafts.map((x) => [x.key, `grande_${x.date}_${x.id}`]));
const updated = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', dateStyle: 'medium', timeStyle: 'short' });

const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Grande 인스타 초안함</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{
  --paper:#F7F5F0; --card:#FFFFFF; --ink:#2C2A28; --muted:#8A8580; --line:#E6E1D8;
  --accent:#A98053; --accent-ink:#FFFFFF; --soft:#EFEAE0;
  --serif:"Noto Serif KR","Apple SD Gothic Neo",serif;
  --sans:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard","Noto Sans KR","Malgun Gothic",sans-serif;
  box-sizing:border-box;
  padding-top:env(safe-area-inset-top,0px); padding-bottom:env(safe-area-inset-bottom,0px);
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#1E1C1A; --card:#262320; --ink:#EDE8DF; --muted:#9A948B; --line:#38342F; --soft:#2E2A26; --accent:#C99B63; --accent-ink:#1E1C1A;
}}
:root[data-theme="dark"]{ --paper:#1E1C1A; --card:#262320; --ink:#EDE8DF; --muted:#9A948B; --line:#38342F; --soft:#2E2A26; --accent:#C99B63; --accent-ink:#1E1C1A; }
html{scroll-padding-top:env(safe-area-inset-top,0px)}
*,*::before,*::after{box-sizing:inherit}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased}
main{max-width:560px;margin:0 auto;padding:28px 20px 56px}
.brand{display:flex;align-items:center;gap:10px;color:var(--accent);font-size:13px;letter-spacing:.32em;font-weight:500}
.brand::before{content:"";width:22px;height:1.5px;background:var(--accent)}
h1{font-family:var(--serif);font-weight:600;font-size:26px;margin:14px 0 4px;letter-spacing:-.01em}
.updated{color:var(--muted);font-size:13px;margin:0 0 26px}
.draft{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:20px 0 18px;margin-bottom:16px}
.draft>*:not(.rail){margin-left:20px;margin-right:20px}
.meta{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;font-size:13px;color:var(--muted)}
.meta time{color:var(--ink);font-weight:600}
.conf{margin-left:auto;font-size:12px;padding:3px 9px;border-radius:999px;border:1px solid var(--accent);color:var(--accent)}
.conf[data-c="○"]{border-color:#C98A5A;color:#C98A5A}
.conf[data-c="△"]{border-color:#C0584A;color:#C0584A}
.hook{font-family:var(--serif);font-size:21px;line-height:1.6;font-weight:600;margin-top:14px;margin-bottom:16px}
.rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;padding:0 20px 4px;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.rail::-webkit-scrollbar{display:none}
.slide{flex:0 0 78%;max-width:340px;margin:0;scroll-snap-align:center}
.slide img{display:block;width:100%;max-width:100%;aspect-ratio:4/5;object-fit:cover;border-radius:10px;border:1px solid var(--line);background:var(--soft)}
.slide figcaption{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--muted);padding:8px 2px 0;min-height:30px}
.save-one{border:0;background:none;color:var(--accent);font:inherit;font-weight:600;padding:4px 0;cursor:pointer}
.actions{margin-top:14px}
.btn{font:inherit;font-size:15px;font-weight:600;border-radius:12px;padding:13px 16px;cursor:pointer;border:1px solid transparent}
.btn.primary{width:100%;background:var(--accent);color:var(--accent-ink)}
.btn.primary:disabled{opacity:.6}
.btn.ghost{background:none;border-color:var(--line);color:var(--ink);padding:8px 12px;font-size:13px}
.hint{font-size:12px;color:var(--muted);margin:8px 0 0;text-align:center}
.cap{margin-top:22px}
.cap-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px}
.cap h3{font-size:14px;margin:0;color:var(--muted);font-weight:600}
textarea{width:100%;font:inherit;font-size:14px;line-height:1.65;color:var(--ink);background:var(--soft);border:0;border-radius:10px;padding:14px;resize:vertical}
details.memo{margin-top:16px;border-top:1px solid var(--line);padding-top:14px}
details summary{cursor:pointer;list-style:none;font-size:14px;font-weight:600}
details summary::-webkit-details-marker{display:none}
details.memo summary::after{content:" ＋";color:var(--muted)}
details.memo[open] summary::after{content:" －"}
.memo-body{font-size:14px;line-height:1.7;overflow-wrap:anywhere}
.memo-body h4{font-size:14px;margin:16px 0 4px}
.memo-body ul{padding-left:18px;margin:4px 0}
.memo-body a{color:var(--accent)}
.memo-body code{background:var(--soft);padding:1px 5px;border-radius:4px;font-size:12.5px}
h2{font-size:14px;color:var(--muted);font-weight:600;margin:32px 0 12px}
details.older{padding:16px 0}
details.older>summary{padding:0 20px}
details.older>summary .peek{display:block;width:100%;font-family:var(--serif);color:var(--ink);font-size:15px;margin-top:6px}
details.older[open]>summary{margin-bottom:4px}
.rev{font-size:12px;color:var(--muted);border:1px dashed var(--line);border-radius:999px;padding:2px 8px}
.fb{margin-top:18px;background:var(--soft);border-radius:12px;padding:14px 16px}
.fb h3{font-size:14px;margin:0 0 6px}
.fb p{font-size:13.5px;line-height:1.7;margin:0;color:var(--ink)}
.toast{position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translate(-50%,20px);background:var(--ink);color:var(--paper);
  font-size:14px;padding:10px 16px;border-radius:999px;opacity:0;transition:.25s;pointer-events:none;max-width:88vw;text-align:center}
.toast.on{opacity:1;transform:translate(-50%,0)}
</style>
</head>
<body>
<main>
  <div class="brand">Grande</div>
  <h1>인스타 초안함</h1>
  <p class="updated">마지막 업데이트 · ${esc(updated)}</p>
  ${article(drafts[0], true)}
  ${drafts.length > 1 ? `<h2>지난 초안</h2>${drafts.slice(1).map((x) => article(x, false)).join('\n')}` : ''}
</main>
<div class="toast" role="status" aria-live="polite"></div>
<!-- 작업 상태: 사용 기록 · 피드백 기준 · 최근 초안 문구. 새 채팅에서 이어 작업할 때 읽는다. -->
<script type="application/json" id="grande-state">${JSON.stringify(STATE).replace(/</g, "\\u003c")}</script>
<script>
(function(){
  var IMGS=${JSON.stringify(IMG_DATA)};
  var NAMES=${JSON.stringify(NAMES)};
  var toastEl=document.querySelector('.toast'), tt=null;
  function toast(m){ toastEl.textContent=m; toastEl.classList.add('on'); clearTimeout(tt); tt=setTimeout(function(){toastEl.classList.remove('on')},2200); }
  function blobOf(u){ var b=atob(u.split(',')[1]), a=new Uint8Array(b.length); for(var i=0;i<b.length;i++) a[i]=b.charCodeAt(i); return new Blob([a],{type:'image/jpeg'}); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms) }) }

  var dl=null;
  function enableSave(){
    [].forEach.call(document.querySelectorAll('.save-all,.save-one'),function(b){ b.hidden=false });
    [].forEach.call(document.querySelectorAll('.hint'),function(h){ h.textContent='저장할 때마다 확인 창이 떠요. 이미지를 길게 눌러도 저장할 수 있어요.' });
  }
  async function saveOne(key,i){
    for(var t=0;t<3;t++){
      try{ await dl.save({filename:NAMES[key]+'_'+(i+1)+'.jpg', data:blobOf(IMGS[key][i])}); return 'ok'; }
      catch(e){
        var c=e&&e.code;
        if(c==='rate_limited'){ await sleep(900); continue; }
        if(c==='declined') return 'declined';
        if(c==='unavailable'||c==='not_granted'||c==='capability_disabled'||c==='capability_removed'){
          [].forEach.call(document.querySelectorAll('.save-all,.save-one'),function(b){ b.hidden=true });
          toast('여기서는 저장 기능을 쓸 수 없어요. 이미지를 길게 눌러 저장해 주세요.'); return 'stop';
        }
        toast('저장하지 못했어요'); return 'stop';
      }
    }
    return 'stop';
  }
  document.addEventListener('click',async function(e){
    var one=e.target.closest('.save-one'), all=e.target.closest('.save-all'), cp=e.target.closest('.copy');
    if(one&&dl){ var r=await saveOne(one.dataset.draft,+one.dataset.i); if(r==='ok') toast((+one.dataset.i+1)+'번 저장'); }
    if(all&&dl){
      var key=all.dataset.draft, n=IMGS[key].length; all.disabled=true;
      for(var i=0;i<n;i++){
        all.textContent=(i+1)+' / '+n+' 저장 중…';
        var r=await saveOne(key,i);
        if(r!=='ok'){ if(r==='declined') toast((i)+'장 저장하고 멈췄어요'); break; }
        if(i===n-1) toast(n+'장 모두 저장했어요');
      }
      all.disabled=false; all.textContent='이미지 '+n+'장 저장';
    }
    if(cp){
      var ta=document.getElementById('cap-'+cp.dataset.draft);
      try{ await navigator.clipboard.writeText(ta.value); toast('캡션을 복사했어요'); }
      catch(_){ ta.focus(); ta.select(); ta.setSelectionRange(0,99999);
        var ok=false; try{ ok=document.execCommand('copy') }catch(__){}
        toast(ok?'캡션을 복사했어요':'캡션이 선택됐어요. 복사를 눌러 주세요'); }
    }
  });
  if(window.claude && window.claude.use){
    window.claude.use('downloads').then(function(d){ if(d){ dl=d; enableSave(); } }).catch(function(){});
  }
})();
</script>
</body>
</html>
`;

const out = path.join(DRAFTS, 'inbox.html');
fs.writeFileSync(out, html);
console.log(`초안함: ${path.relative(process.cwd(), out)} · ${drafts.length}편 · ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MB`);
