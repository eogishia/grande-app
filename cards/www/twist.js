/*
 * Grande 인스타 · 반전 카루셀 조판 (twist.js)
 *
 * 2026-09-28에 확정한 반전 형식 디자인을 그대로 그린다.
 *   훅(어두운 장) · 맥락 · 본문(밑줄) · 해설 · 마무리(서명)
 * 기본 형식(index.html)과 서체 굵기·여백이 달라서, 조판 코드를 따로 둔다.
 *   본문 명조 400 · 훅 명조 600 · 저자 Pretendard 500 · 상단 표기 Pretendard 600 34px
 * 서체: 앱 번들(fonts/, 명조 300 · Pretendard 300/400) + twist-fonts/(명조 400/600 · Pretendard 500/600)
 *
 * index.html이 편집 화면에서, insta/render.mjs가 자동화에서 같은 함수를 쓴다.
 */
window.GrandeTwist=(function(){
/* ═══════════════ 카드 조판 ═══════════════ */
var W=1080, H=1350;
var PADX=112, TOP_LABEL=112, TEXT_TOP=228, TEXT_BOT=1038, SRC_TOP=1112;
var RULE_LIFT=36;   // 가로선만 저자명에서 36px 더 띄운다
var SIZES=[62,58,54,50,47,44,42,40,38,36,34,32,30,28];

var COMFORT=40;   // 인스타에서 읽히는 최소 크기. 이보다 작아지면 장수를 늘린다.

function paras(t){ return t.split(/\n{2,}/).map(function(s){return s.trim()}).filter(Boolean) }

function sentences(p){
  return p.replace(/([.!?…?][\u201d\u2019"'\u300d\u300f]?)\s+/g,'$1\u0001')
          .split('\u0001').map(function(x){return x.trim()}).filter(Boolean);
}

/* 조각(unit) = {t:본문, p:원래 문단 번호}
   같은 문단에서 나온 조각들은 한 카드 안에서 다시 한 문단으로 합쳐진다. */
function units(text,av){
  var out=[];
  paras(text).forEach(function(p,pi){
    if(fitsParas([p],COMFORT,av) || sentences(p).length<2){ out.push({t:p,p:pi}); return }
    sentences(p).forEach(function(sen){ out.push({t:sen,p:pi}) });
  });
  return out;
}
function toParas(group){
  var out=[],last=null;
  group.forEach(function(u){
    if(last!==null && u.p===last) out[out.length-1]+=' '+u.t;
    else out.push(u.t);
    last=u.p;
  });
  return out;
}

function wrap(ctx,s,maxW){
  var lines=[],cur='';
  for(var i=0;i<s.length;i++){
    var ch=s[i], test=cur+ch;
    if(cur.length && ctx.measureText(test).width>maxW){
      var sp=cur.lastIndexOf(' ');
      if(sp>0 && cur.length-sp<=14){ lines.push(cur.slice(0,sp)); cur=cur.slice(sp+1)+ch; }
      else { lines.push(cur); cur=ch; }
    } else cur=test;
  }
  if(cur.length) lines.push(cur);
  return lines.map(function(l){ return l.replace(/^\s+/,'') });
}

var mctx=document.createElement('canvas').getContext('2d');

var _lc={};
function layoutParas(ps,fs){
  var key=fs+'\u0000'+ps.join('\u0001');
  if(_lc[key]) return _lc[key];
  mctx.font='400 '+fs+'px "Noto Serif KR", serif';
  var lh=Math.round(fs*1.78), gap=Math.round(fs*1.0), maxW=W-PADX*2;
  var out=[], h=0;
  ps.forEach(function(p,i){
    var block=[];
    p.split('\n').forEach(function(sub){
      wrap(mctx,sub.trim(),maxW).forEach(function(l){ block.push(l) });
    });
    out.push(block); h+=block.length*lh;
    if(i<ps.length-1) h+=gap;
  });
  return (_lc[key]={blocks:out,h:h,lh:lh,gap:gap,fs:fs});
}
function layout(group,fs){ return layoutParas(toParas(group),fs) }
var CARD_AVAIL=TEXT_BOT-TEXT_TOP;
function fitsParas(ps,fs,av){ return layoutParas(ps,fs).h <= (av||CARD_AVAIL) }
function fits(group,fs,av){ return layout(group,fs).h <= (av||CARD_AVAIL) }

function partitions(arr,n){
  if(n===1) return [[arr]];
  var res=[];
  if(n===2){
    for(var i=1;i<arr.length;i++) res.push([arr.slice(0,i),arr.slice(i)]);
  } else {
    for(var a=1;a<arr.length-1;a++) for(var b=a+1;b<arr.length;b++)
      res.push([arr.slice(0,a),arr.slice(a,b),arr.slice(b)]);
  }
  return res;
}

function search(us,tries,floorPx,av){
  for(var t=0;t<tries.length;t++){
    var n=tries[t];
    if(n>us.length) continue;
    var best=null;
    partitions(us,n).forEach(function(part){
      for(var s=0;s<SIZES.length;s++){
        var fs=SIZES[s];
        if(fs<floorPx) break;
        var ok=true;
        for(var g=0;g<part.length;g++) if(!fits(part[g],fs,av)){ ok=false; break }
        if(ok){
          var spread=Math.max.apply(null,part.map(function(g){
            return g.reduce(function(a,u){return a+u.t.length},0) }));
          if(!best || fs>best.fs || (fs===best.fs && spread<best.spread))
            best={part:part,fs:fs,spread:spread};
          return;
        }
      }
    });
    if(best) return best;
  }
  return null;
}

function plan(text,forceN,av){
  var us=units(text,av);
  var wanted=forceN==='auto'?null:parseInt(forceN,10);
  var tries=wanted?[wanted]:[1,2,3];
  return search(us,tries,COMFORT,av)
      || search(us,tries,0,av)
      || search(us,[1,2,3],0,av)
      || {part:[us],fs:SIZES[SIZES.length-1],spread:0};
}

/* ── 종이 질감 ── */
var grain=null;
function grainPattern(ctx){
  if(!grain){
    var c=document.createElement('canvas'); c.width=c.height=180;
    var g=c.getContext('2d'), d=g.createImageData(180,180);
    for(var i=0;i<d.data.length;i+=4){
      var v=200+Math.random()*55;
      d.data[i]=d.data[i+1]=d.data[i+2]=v; d.data[i+3]=255;
    }
    g.putImageData(d,0,0); grain=c;
  }
  return ctx.createPattern(grain,'repeat');
}

function paper(ctx,w,h){
  w=w||W; h=h||H;
  ctx.fillStyle='#F8F6F1'; ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.globalAlpha=.055; ctx.globalCompositeOperation='multiply';
  ctx.fillStyle=grainPattern(ctx); ctx.fillRect(0,0,w,h);
  ctx.restore();
}

function wordmark(ctx,label,color){
  ctx.fillStyle=color||'#A98053';
  ctx.fillRect(PADX,TOP_LABEL-17,40,2.5);
  ctx.font='600 34px "Pretendard Variable", Pretendard, sans-serif';
  ctx.textBaseline='alphabetic';
  ctx.save(); ctx.globalAlpha=.95;
  drawTracked(ctx,label,PADX+60,TOP_LABEL-4,5.5);
  ctx.restore();
}
function drawTracked(ctx,s,x,y,tr){
  for(var i=0;i<s.length;i++){ ctx.fillText(s[i],x,y); x+=ctx.measureText(s[i]).width+tr; }
}
function trackedWidth(ctx,s,tr){
  var w=0; for(var i=0;i<s.length;i++) w+=ctx.measureText(s[i]).width+tr;
  return w-tr;
}

/* 밑줄 구절이 각 줄의 어디에 걸리는지: [[ [a,b]|null, ... ], ...] (문단 × 줄) */
function hlSegments(ps,blocks,hl){
  hl=(hl||'').trim();
  return blocks.map(function(block,i){
    var p=ps[i]||'', hs=hl?p.indexOf(hl):-1, he=hs+hl.length, cursor=0;
    return block.map(function(line){
      var at=p.indexOf(line,cursor); if(at<0) at=cursor;
      cursor=at+line.length;
      if(hs<0) return null;
      var a=Math.max(hs,at)-at, b=Math.min(he,at+line.length)-at;
      return b>a ? [a,b] : null;
    });
  });
}
function marker(ctx,line,seg,x,y,fs,frac){
  if(!seg) return;
  var x0=x+ctx.measureText(line.slice(0,seg[0])).width;
  var w=ctx.measureText(line.slice(seg[0],seg[1])).width*(frac==null?1:frac);
  if(w<=0) return;
  ctx.save();
  ctx.fillStyle='rgba(201,155,99,.30)';
  ctx.fillRect(x0-2,y-fs*0.40,w+4,fs*0.56);
  ctx.restore();
}
var _hlDrawn=false;
function drawBody(ctx,L,ps,hl){
  ctx.fillStyle='#2C2A28'; ctx.textBaseline='alphabetic';
  ctx.font='400 '+L.fs+'px "Noto Serif KR", serif';
  var segs=ps&&hl ? hlSegments(ps,L.blocks,hl) : null;
  var avail=TEXT_BOT-TEXT_TOP;
  var y=TEXT_TOP+Math.max(0,Math.round((avail-L.h)*0.42))+Math.round(L.fs*1.05);
  L.blocks.forEach(function(block,i){
    block.forEach(function(line,j){
      if(segs && segs[i][j]){ marker(ctx,line,segs[i][j],PADX,y,L.fs); _hlDrawn=true; }
      ctx.fillStyle='#2C2A28';
      ctx.fillText(line,PADX,y); y+=L.lh;
    });
    if(i<L.blocks.length-1) y+=L.gap;
  });
}

function sourceLine(q){
  var t='『'+(q.bookTitle||q.source)+'』';
  if(q.volume) t+=' '+q.volume;
  var i=q.source.indexOf(',');
  var detail = i>-1 ? q.source.slice(i+1).trim() : '';
  if(!q.bookTitle && i<0) detail='';
  if(detail) t+=' · '+detail;
  return t;
}

function drawSource(ctx,q,part){
  var y=SRC_TOP;
  ctx.fillStyle='#A98053'; ctx.globalAlpha=.4;
  ctx.fillRect(PADX,y-RULE_LIFT,W-PADX*2,1.5); ctx.globalAlpha=1;
  ctx.textBaseline='alphabetic';
  ctx.fillStyle='#2C2A28';
  ctx.font='500 34px "Pretendard Variable", Pretendard, sans-serif';
  var ay=y+58;
  ctx.fillText(q.author,PADX,ay);

  var src=sourceLine(q), fs=27, avail=W-PADX*2-(part?110:0);
  while(fs>19){
    ctx.font='400 '+fs+'px "Pretendard Variable", Pretendard, sans-serif';
    if(ctx.measureText(src).width<=avail) break;
    fs-=1;
  }
  ctx.fillStyle='#A98053';
  ctx.fillText(src,PADX,ay+44);

  if(part){
    ctx.font='400 24px "Pretendard Variable", Pretendard, sans-serif';
    ctx.globalAlpha=.6;
    ctx.fillText(part,W-PADX-ctx.measureText(part).width,ay+44);
    ctx.globalAlpha=1;
  }
}

function renderText(cv,q,group,fs,part,hl){
  cv.width=W; cv.height=H;
  var ctx=cv.getContext('2d');
  paper(ctx);
  wordmark(ctx,'Grande');
  drawBody(ctx,layout(group,fs),toParas(group),hl);
  drawSource(ctx,q,part);
  return cv;
}

function renderNote(cv,q,text){
  cv.width=W; cv.height=H;
  var ctx=cv.getContext('2d');
  paper(ctx);
  wordmark(ctx,'해설');

  var NS=[46,44,42,40,38,36,34,32,30], maxW=W-PADX*2, avail=TEXT_BOT-TEXT_TOP-40;
  var fs=NS[NS.length-1], lines=[];
  for(var i=0;i<NS.length;i++){
    mctx.font='400 '+NS[i]+'px "Pretendard Variable", Pretendard, sans-serif';
    var L=wrapMulti(mctx,text||q.note||'',maxW);
    if(L.length*Math.round(NS[i]*1.85)<=avail){ fs=NS[i]; lines=L; break }
    if(i===NS.length-1) lines=L;
  }
  ctx.fillStyle='#2C2A28'; ctx.textBaseline='alphabetic';
  ctx.font='400 '+fs+'px "Pretendard Variable", Pretendard, sans-serif';
  var lh=Math.round(fs*1.85), th=lines.length*lh;
  var y=TEXT_TOP+Math.max(0,Math.round((TEXT_BOT-TEXT_TOP-th)*0.42))+fs;
  lines.forEach(function(l){ ctx.fillText(l,PADX,y); y+=lh });
  drawSource(ctx,q,'');
  return cv;
}

function wrapMulti(ctx,text,maxW){
  var out=[];
  String(text).split('\n').forEach(function(l){
    if(!l.trim()){ if(out.length && out[out.length-1]!=='') out.push(''); return }
    wrap(ctx,l.trim(),maxW).forEach(function(x){ out.push(x) });
  });
  while(out.length && out[out.length-1]==='') out.pop();
  return out;
}

/* ── 반전 형식: 훅(어두운 장) · 맥락 ── */
var DARK='#2B2825', DARK_FG='#F3EFE6', DARK_ACC='#C99B63', DARK_DIM='#8B8478';
function paperDark(ctx,w,h){
  w=w||W; h=h||H;
  ctx.fillStyle=DARK; ctx.fillRect(0,0,w,h);
  ctx.save();
  ctx.globalAlpha=.10; ctx.globalCompositeOperation='multiply';
  ctx.fillStyle=grainPattern(ctx); ctx.fillRect(0,0,w,h);
  ctx.restore();
}
/* 줄바꿈을 직접 넣은 문구는 그 줄이 다시 꺾이지 않는 가장 큰 크기를 먼저 찾는다 */
function fitLines(text,sizes,maxW,maxH,weight,lhK){
  var want=wrapMulti({measureText:function(){return {width:0}}},text,1e9).length;
  var r=null, loose=null;
  for(var i=0;i<sizes.length;i++){
    mctx.font=weight+' '+sizes[i]+'px "Noto Serif KR", serif';
    var L=wrapMulti(mctx,text,maxW), lh=Math.round(sizes[i]*lhK);
    r={fs:sizes[i],lines:L,lh:lh,h:L.length*lh};
    if(r.h>maxH) continue;
    if(L.length<=want) return r;
    if(!loose) loose=r;
  }
  return loose||r;
}
function swipeCue(ctx,x,y,color){
  ctx.save();
  ctx.strokeStyle=color; ctx.lineWidth=2.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(x-54,y); ctx.lineTo(x,y);
  ctx.moveTo(x-12,y-11); ctx.lineTo(x,y); ctx.lineTo(x-12,y+11);
  ctx.stroke(); ctx.restore();
}
function renderHook(cv,q,text){
  cv.width=W; cv.height=H;
  var ctx=cv.getContext('2d');
  paperDark(ctx);
  wordmark(ctx,'Grande',DARK_ACC);
  var F=fitLines(text,[92,86,80,74,68,62,58,54,50,46],W-PADX*2,700,'600',1.5);
  ctx.fillStyle=DARK_FG; ctx.textBaseline='alphabetic';
  ctx.font='600 '+F.fs+'px "Noto Serif KR", serif';
  var y=Math.round(H*0.47-F.h/2+F.fs*0.95);
  F.lines.forEach(function(l){ if(l) ctx.fillText(l,PADX,y); y+=F.lh });
  // 하단: 누구의 어떤 책인지만. 답은 넘겨야 나온다.
  ctx.font='500 30px "Pretendard Variable", Pretendard, sans-serif';
  ctx.fillStyle=DARK_DIM;
  ctx.fillText(q.author+'  『'+(q.bookTitle||q.source)+'』',PADX,H-150);
  swipeCue(ctx,W-PADX,H-160,DARK_ACC);
  return cv;
}
function renderSetup(cv,text){
  cv.width=W; cv.height=H;
  var ctx=cv.getContext('2d');
  paper(ctx);
  wordmark(ctx,'Grande');
  var F=fitLines(text,[60,56,52,48,44,40,36],W-PADX*2,760,'400',1.75);
  ctx.fillStyle='#2C2A28'; ctx.textBaseline='alphabetic';
  ctx.font='400 '+F.fs+'px "Noto Serif KR", serif';
  var y=Math.round(H*0.47-F.h/2+F.fs*0.95);
  F.lines.forEach(function(l){ if(l) ctx.fillText(l,PADX,y); y+=F.lh });
  swipeCue(ctx,W-PADX,H-160,'#A98053');
  return cv;
}

function renderOutro(cv,text){
  cv.width=W; cv.height=H;
  var ctx=cv.getContext('2d');
  paper(ctx);
  ctx.textBaseline='alphabetic';

  var maxW=W-PADX*2-60, fs=44, lines=[];
  for(var t=0;t<6;t++){
    mctx.font='400 '+fs+'px "Noto Serif KR", serif';
    lines=[];
    text.split('\n').forEach(function(l){
      if(!l.trim()){ lines.push(''); return }
      wrap(mctx,l.trim(),maxW).forEach(function(x){ lines.push(x) });
    });
    if(lines.length*Math.round(fs*1.9)<=560) break;
    fs-=4;
  }
  var lh=Math.round(fs*1.9);
  var sign=true;
  var cy=sign?Math.round(H*0.43):H/2;
  var y=Math.round(cy-lines.length*lh/2+fs*0.7);
  ctx.font='400 '+fs+'px "Noto Serif KR", serif';
  ctx.fillStyle='#2C2A28';
  lines.forEach(function(l){
    if(l){ ctx.fillText(l,(W-ctx.measureText(l).width)/2,y) }
    y+=lh;
  });
  if(sign){
    // 서명: 앱 이름과 스토어 이름. 계정 아이디는 게시물 상단에 이미 있으므로 넣지 않는다.
    ctx.fillStyle='#A98053';
    ctx.fillRect(W/2-24,H-318,48,2);
    ctx.font='400 46px "Pretendard Variable", Pretendard, sans-serif';
    var gw=trackedWidth(ctx,'Grande',13);
    drawTracked(ctx,'Grande',(W-gw)/2,H-236,13);
    ctx.fillStyle='#8A8580';
    ctx.font='400 28px "Pretendard Variable", Pretendard, sans-serif';
    var st='하루 한편, 고전 문장';
    ctx.fillText(st,(W-ctx.measureText(st).width)/2,H-180);
    return cv;
  }
  return cv;
}



/* ═══════════════ 바깥에서 쓰는 것 ═══════════════ */
var OUTRO='유명한 문장 뒤의 이야기,\n매일 한 편씩.\n\n프로필에 있는 링크를 통해\n앱에서 만나요.';
function mk(){ return document.createElement('canvas') }
function norm(T){
  T=T||{};
  return { hook:T.hook||'', setup:T.setup||'', highlight:T.highlight||'', reveal:T.reveal||'',
           about:T.about||'', ask:T.ask||'' };
}

/* q: quotes.js의 글 · T: 반전 문구 · o.text/o.note: 도구에서 고쳐 쓴 본문·주석(없으면 원본) */
function renderAll(q,T,o){
  T=norm(T); o=o||{};
  var text=o.text||q.text, note=o.note!=null?o.note:(q.note||'');
  var out=[], warn=[];
  if(T.hook.trim()) out.push({cv:renderHook(mk(),q,T.hook.trim()),name:'훅'});
  else warn.push('훅을 쓰면 첫 장이 생깁니다.');
  if(T.setup.trim()) out.push({cv:renderSetup(mk(),T.setup.trim()),name:'맥락'});
  var p=plan(text,o.split||'auto'), n=p.part.length, hl=T.highlight.trim();
  _hlDrawn=false;
  p.part.forEach(function(g,i){
    out.push({cv:renderText(mk(),q,g,p.fs,n>1?(i+1)+'/'+n:'',hl),name:'본문'+(n>1?' '+(i+1):'')});
  });
  if(hl){
    if(text.replace(/\s+/g,' ').indexOf(hl.replace(/\s+/g,' '))<0)
      warn.unshift('밑줄 구절을 본문에서 찾지 못했습니다. 글자 그대로 옮겨주세요.');
    else if(!_hlDrawn)
      warn.unshift('밑줄 구절이 카드 경계나 문단에 걸쳐 그려지지 않았습니다. 더 짧게 잡아주세요.');
  }
  var rv=T.reveal.trim()||note;
  if(rv) out.push({cv:renderNote(mk(),q,rv),name:'해설'});
  out.push({cv:renderOutro(mk(),OUTRO),name:'마무리'});
  return {cards:out, warn:warn.join(' '), fs:p.fs, parts:n};
}

/* ── 캡션: 답은 넣지 않는다 · 해시태그 5개 (인스타 2025-12 제한) ── */
var TAGS={'철학':'#철학','문학':'#문학','동양고전':'#동양고전','신학':'#신학','과학':'#과학'};
function tagify(s){ return s ? '#'+String(s).replace(/\(.*?\)/g,'').replace(/[^0-9A-Za-z가-힣]/g,'') : '' }
function tags5(q){
  var out=[tagify(q.author), tagify(q.bookTitle||q.source.split(',')[0]), '#고전', TAGS[q.cat], '#책스타그램'];
  var seen={};
  return out.filter(function(t){ if(!t||t==='#'||seen[t]) return false; seen[t]=1; return true }).slice(0,5);
}
var CAP_CTA='글 한 대 하러 오세요.\n앱 Grande는 프로필 링크에서 받을 수 있어요.';
function caption(q,T){
  T=norm(T);
  var about=T.about.trim() || (q.author+', 『'+(q.bookTitle||q.source)+'』의 한 대목입니다. 답은 넘겨서 확인해 보세요.');
  return [T.hook.trim().replace(/([^.!?…])\n/g,'$1 '), about, T.ask.trim(), CAP_CTA, tags5(q).join(' ')]
    .filter(function(x){return x}).join('\n\n');
}

/* ── 서체: 이 글에 쓰일 글자의 조각을 미리 싣는다 ── */
var FACES=['400 44px "Noto Serif KR"','600 44px "Noto Serif KR"',
  '400 34px "Pretendard"','500 34px "Pretendard"','600 34px "Pretendard"'];
function sample(q,T,o){
  T=norm(T); o=o||{};
  return [o.text||q.text,o.note||q.note||'',q.author,q.bookTitle||'',q.source||'',q.volume||'',
          T.hook,T.setup,T.reveal,OUTRO,'Grande 주석 하루 한편, 고전 문장 0123456789/·『』'].join(' ');
}
function fontsReady(s){
  for(var i=0;i<FACES.length;i++){ try{ if(!document.fonts.check(FACES[i],s)) return false }catch(e){} }
  return true;
}
function loadFonts(s){
  return Promise.all(FACES.map(function(f){ return document.fonts.load(f,s).catch(function(){}) }))
    .then(function(){ _lc={} });
}

return { renderAll:renderAll, caption:caption, sample:sample, fontsReady:fontsReady,
         loadFonts:loadFonts, resetCache:function(){ _lc={} }, OUTRO:OUTRO };
})();
