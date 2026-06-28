// Draw representative placement slices for visual review.
// Output is intentionally SVG so it can be opened directly from .shots.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'canvas') return { width: 432, height: 768 };
  if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} });
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}});
const fakeCanvas = {
  getContext: () => ctxProxy,
  width: 432,
  height: 768,
  style: {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 432, height: 768 }),
};
function elStub(){ return { classList:{toggle(){},add(){},remove(){}}, addEventListener(){}, dataset:{}, style:{}, blur(){} }; }
const documentStub = {
  getElementById: () => fakeCanvas,
  querySelectorAll: () => { const a=[]; a.forEach=Array.prototype.forEach.bind(a); return a; },
  querySelector: () => elStub(),
};
class ImageStub { constructor(){ this.complete=false; this.naturalWidth=0; this.naturalHeight=0; } set src(v){} get src(){ return ''; } }

const sandbox = {
  document: documentStub,
  Image: ImageStub,
  window: {},
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  addEventListener: () => {},
  location: { search: '' },
  Math, Date, console, URLSearchParams,
};
sandbox.window = sandbox;
const argNames = Object.keys(sandbox);
const argVals = argNames.map(k => sandbox[k]);
const exported = code + `
;return {
  reset, spawnAhead,
  get birds(){ return birds; },
  get coins(){ return coins; },
  setStage(k){ stageKey=k; },
  get stageTop(){ return stageTop; },
  START_Y, PXPM, STAGES, W, H, HIPPO_SCR_Y,
  PULSAR_R_MAX, SHUTTER_BASE, SHUTTER_TH,
};`;
const G = new Function(...argNames, exported)(...argVals);

const OUT_DIR = path.join(root, '.shots');
fs.mkdirSync(OUT_DIR, { recursive: true });

function esc(s){ return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function r(n){ return Math.round(n); }
function screenY(worldY, cameraY){ return G.HIPPO_SCR_Y - (worldY - cameraY); }
function enemyBoxes(b){
  const y=b.y;
  if(b.move==='shutter'){
    const gap=b.gapHalf||G.SHUTTER_BASE, hh=G.SHUTTER_TH+16;
    return [
      {x:(b.x-gap)/2, y, hw:Math.max(0,(b.x-gap)/2), hh, label:'shutter'},
      {x:(G.W+b.x+gap)/2, y, hw:Math.max(0,(G.W-b.x-gap)/2), hh, label:'shutter'},
    ];
  }
  if(b.cap) return [{x:b.x,y,hw:(b.hw||46)*1.75,hh:34,label:'pelican'}];
  if(b.move==='float') return [{x:b.x,y,hw:(b.r||23)*1.05,hh:(b.r||23)*1.85,label:'float'}];
  if(b.move==='pulsar') return [{x:b.x,y,hw:G.PULSAR_R_MAX*1.22,hh:G.PULSAR_R_MAX*1.22,label:'pulsar'}];
  if(b.sprite==='storm') return [{x:b.x,y,hw:72,hh:72,label:'storm'}];
  if(b.sprite==='hawk'||b.move==='diver') return [{x:b.x,y,hw:66,hh:70,label:'hawk'}];
  if(b.type==='large') return [{x:b.x,y,hw:66,hh:54,label:'large'}];
  return [{x:b.x,y,hw:40,hh:30,label:b.move||b.type||'enemy'}];
}
function buildStage(stageKey){
  G.setStage(stageKey);
  G.reset();
  G.spawnAhead(G.stageTop + 200);
  return {
    stageKey,
    stageTop: G.stageTop,
    enemies: G.birds.map((b,i)=>({...b,i,boxes:enemyBoxes(b)})),
    coins: G.coins.map((c,i)=>({...c,i,r:c.r||13})),
  };
}
function visibleY(y, cameraY, pad=80){
  const sy=screenY(y,cameraY);
  return sy>=-pad && sy<=G.H+pad;
}
function scoreSlice(stage, cameraY){
  const enemies=stage.enemies.filter(b=>b.boxes.some(box=>visibleY(box.y,cameraY,box.hh+70)));
  const coins=stage.coins.filter(c=>visibleY(c.y,cameraY,c.r+70));
  const pulsars=enemies.filter(b=>b.move==='pulsar').length;
  const score=enemies.length*5 + coins.length*3 + pulsars*6;
  return {cameraY, enemies, coins, score};
}
function pickSlices(stage){
  const slices=[];
  for(let y=G.START_Y; y<=stage.stageTop; y+=120){
    const s=scoreSlice(stage,y);
    if(s.enemies.length || s.coins.length) slices.push(s);
  }
  slices.sort((a,b)=>b.score-a.score);
  const picked=[];
  for(const s of slices){
    if(picked.every(p=>Math.abs(p.cameraY-s.cameraY)>520)) picked.push(s);
    if(picked.length>=3) break;
  }
  picked.sort((a,b)=>a.cameraY-b.cameraY);
  return picked;
}
function drawSlice(stage, slice, x, y, scale=0.44){
  const sw=G.W*scale, sh=G.H*scale;
  let out=`<g transform="translate(${x},${y})">`;
  out+=`<rect x="0" y="0" width="${sw}" height="${sh}" rx="8" fill="#ddecff" stroke="#b7c4dc"/>`;
  out+=`<line x1="0" x2="${sw}" y1="${G.HIPPO_SCR_Y*scale}" y2="${G.HIPPO_SCR_Y*scale}" stroke="#2f9e65" stroke-width="1.5" stroke-dasharray="5 5"/>`;
  out+=`<text x="10" y="20" font-size="13" font-weight="700" fill="#1d2738">${esc(stage.stageKey)} / ${r((slice.cameraY-G.START_Y)/G.PXPM)}m</text>`;
  for(const b of slice.enemies){
    for(const box of b.boxes){
      const sx=(box.x-box.hw)*scale, sy=(screenY(box.y,slice.cameraY)-box.hh)*scale;
      const bw=box.hw*2*scale, bh=box.hh*2*scale;
      out+=`<rect x="${r(sx)}" y="${r(sy)}" width="${r(bw)}" height="${r(bh)}" fill="rgba(218,62,84,.22)" stroke="rgba(150,20,40,.62)" stroke-width="1.4"/>`;
      out+=`<text x="${r(sx+3)}" y="${r(sy+12)}" font-size="9" fill="#8a1230">${esc(box.label)}</text>`;
    }
  }
  for(const c of slice.coins){
    const cx=c.x*scale, cy=screenY(c.y,slice.cameraY)*scale, cr=c.r*scale;
    out+=`<circle cx="${r(cx)}" cy="${r(cy)}" r="${Math.max(3,r(cr))}" fill="rgba(255,210,63,.78)" stroke="rgba(145,86,0,.62)" stroke-width="1.2"/>`;
  }
  for(const issue of sliceData(stage, slice).issues){
    out+=`<rect x="${r(issue.x*scale)}" y="${r(issue.y*scale)}" width="${r(issue.w*scale)}" height="${r(issue.h*scale)}" rx="10" fill="rgba(185,43,163,.08)" stroke="#b92ba3" stroke-width="3" stroke-dasharray="8 5"/>`;
    out+=`<text x="${r(issue.x*scale+4)}" y="${r(issue.y*scale-4)}" font-size="12" font-weight="800" fill="#8a1478">${esc(issue.label)}</text>`;
  }
  out+=`</g>`;
  return out;
}
function pageSvg(stages, pageNo){
  const scale=0.44, sw=G.W*scale, sh=G.H*scale;
  const gapX=26, gapY=58, left=28, top=82;
  const width=left*2+sw*3+gapX*2;
  const height=top+stages.length*(sh+gapY)+34;
  let out=`<svg xmlns="http://www.w3.org/2000/svg" width="${r(width)}" height="${r(height)}" viewBox="0 0 ${r(width)} ${r(height)}">`;
  out+=`<rect width="100%" height="100%" fill="#f6f8fb"/>`;
  out+=`<text x="28" y="34" font-size="24" font-weight="800" fill="#202636">Placement contact sheet ${pageNo}</text>`;
  out+=`<text x="28" y="58" font-size="14" fill="#667085">Yellow=coins / Red=enemy visual boxes / dashed green=player height. Three dense representative play-view slices per stage.</text>`;
  stages.forEach((stageKey,row)=>{
    const stage=buildStage(stageKey);
    const slices=pickSlices(stage);
    out+=`<text x="28" y="${r(top+row*(sh+gapY)-14)}" font-size="18" font-weight="800" fill="#202636">Stage ${esc(stageKey)}</text>`;
    slices.forEach((slice,col)=>{
      out+=drawSlice(stage, slice, left+col*(sw+gapX), top+row*(sh+gapY), scale);
    });
  });
  out+=`</svg>`;
  return out;
}
function sliceData(stage, slice){
  const enemies = slice.enemies.flatMap(b => b.boxes.map(box => ({
    label: box.label,
    x: box.x - box.hw,
    y: screenY(box.y, slice.cameraY) - box.hh,
    w: box.hw * 2,
    h: box.hh * 2,
  })));
  const coins = slice.coins.map(c => ({ x: c.x, y: screenY(c.y, slice.cameraY), r: c.r }));
  return {
    stageKey: stage.stageKey,
    alt: r((slice.cameraY-G.START_Y)/G.PXPM),
    enemies,
    coins,
    issues: detectIssues(enemies, coins),
  };
}
function bboxOf(items){
  const xs=[], ys=[];
  for(const it of items){
    if(it.r != null){
      xs.push(it.x-it.r, it.x+it.r);
      ys.push(it.y-it.r, it.y+it.r);
    }else{
      xs.push(it.x, it.x+it.w);
      ys.push(it.y, it.y+it.h);
    }
  }
  return {
    x: Math.min(...xs),
    y: Math.min(...ys),
    w: Math.max(...xs)-Math.min(...xs),
    h: Math.max(...ys)-Math.min(...ys),
  };
}
function expandBox(b,pad){
  return { x:b.x-pad, y:b.y-pad, w:b.w+pad*2, h:b.h+pad*2 };
}
function pointInBox(x,y,b,pad=0){
  return x>b.x-pad && x<b.x+b.w+pad && y>b.y-pad && y<b.y+b.h+pad;
}
function segmentHitsBox(a,b,box,pad=14){
  const steps=Math.max(4, Math.ceil(Math.hypot(a.x-b.x,a.y-b.y)/20));
  for(let i=0;i<=steps;i++){
    const t=i/steps, x=a.x+(b.x-a.x)*t, y=a.y+(b.y-a.y)*t;
    if(pointInBox(x,y,box,pad)) return true;
  }
  return false;
}
function lineLikeBox(b){
  return b.w<32 || b.h<32 || b.w/b.h>2.8 || b.h/b.w>2.8;
}
function coinGroupLineIntent(group){
  if(group.length<3) return false;
  let a=group[0], b=group[1], best=0;
  for(let i=0;i<group.length;i++){
    for(let j=i+1;j<group.length;j++){
      const d=Math.hypot(group[i].x-group[j].x,group[i].y-group[j].y);
      if(d>best){ best=d; a=group[i]; b=group[j]; }
    }
  }
  if(best<78) return false;
  const vx=b.x-a.x, vy=b.y-a.y, len=Math.hypot(vx,vy);
  const ts=[];
  let maxPerp=0;
  for(const p of group){
    const t=((p.x-a.x)*vx+(p.y-a.y)*vy)/(len*len);
    const px=a.x+vx*t, py=a.y+vy*t;
    maxPerp=Math.max(maxPerp,Math.hypot(p.x-px,p.y-py));
    ts.push(t*len);
  }
  ts.sort((x,y)=>x-y);
  const gaps=[];
  for(let i=1;i<ts.length;i++) gaps.push(ts[i]-ts[i-1]);
  const avg=gaps.reduce((x,y)=>x+y,0)/gaps.length;
  const variance=gaps.reduce((x,y)=>x+Math.abs(y-avg),0)/gaps.length;
  return maxPerp<24 && avg>=30 && avg<=86 && variance<Math.max(14,avg*0.32);
}
function coinGroupArcIntent(group){
  if(group.length<4 || group.length>8) return false;
  if(coinGroupLineIntent(group)) return false;
  const b=bboxOf(group);
  if(b.w<50 || b.h<38 || b.w>180 || b.h>210) return false;
  const cx=group.reduce((a,c)=>a+c.x,0)/group.length;
  const cy=group.reduce((a,c)=>a+c.y,0)/group.length;
  const ds=group.map(c=>Math.hypot(c.x-cx,c.y-cy));
  const avg=ds.reduce((a,d)=>a+d,0)/ds.length;
  if(avg<28) return false;
  const dev=ds.reduce((a,d)=>a+Math.abs(d-avg),0)/ds.length;
  const angles=group.map(c=>Math.atan2(c.y-cy,c.x-cx)).sort((a,b)=>a-b);
  const gaps=[];
  for(let i=1;i<angles.length;i++) gaps.push(angles[i]-angles[i-1]);
  gaps.push((angles[0]+Math.PI*2)-angles[angles.length-1]);
  const span=Math.PI*2-Math.max(...gaps);
  return dev<avg*0.38 && span>1.15 && span<5.7;
}
function coinGroupShallowArcIntent(group){
  if(group.length<4 || group.length>6) return false;
  if(coinGroupLineIntent(group)) return false;
  const b=bboxOf(group);
  if(b.w<64 || b.w>170 || b.h<18 || b.h>92) return false;
  const sorted=group.slice().sort((a,b)=>a.x-b.x);
  const gaps=[];
  for(let i=1;i<sorted.length;i++) gaps.push(sorted[i].x-sorted[i-1].x);
  const avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;
  const gapVar=gaps.reduce((a,b)=>a+Math.abs(b-avgGap),0)/gaps.length;
  const mid=sorted[Math.floor(sorted.length/2)];
  const ends=(sorted[0].y+sorted[sorted.length-1].y)/2;
  return gapVar<Math.max(14,avgGap*0.36) && Math.abs(mid.y-ends)>10 && Math.abs(mid.y-ends)<76;
}
function coinGroupTriangleIntent(group){
  if(group.length<4 || group.length>6) return false;
  if(coinGroupLineIntent(group) || coinGroupArcIntent(group)) return false;
  const b=bboxOf(group);
  if(b.w<58 || b.h<58 || b.w>170 || b.h>190) return false;
  const top=group.some(c=>c.y<b.y+b.h*0.32 && c.x>b.x+b.w*0.28 && c.x<b.x+b.w*0.72);
  const left=group.some(c=>c.x<b.x+b.w*0.35 && c.y>b.y+b.h*0.55);
  const right=group.some(c=>c.x>b.x+b.w*0.65 && c.y>b.y+b.h*0.55);
  return top && left && right;
}
function coinGroupIntentionalShape(group){
  return coinGroupLineIntent(group) || coinGroupArcIntent(group) || coinGroupShallowArcIntent(group) || coinGroupTriangleIntent(group);
}
function coinInIntentionalLocalShape(c, coins){
  const groups=[
    coins.filter(o=>Math.abs(o.x-c.x)<96 && Math.abs(o.y-c.y)<130),
    coins.filter(o=>Math.abs(o.x-c.x)<122 && Math.abs(o.y-c.y)<190),
  ];
  return groups.some(g=>g.includes(c) && g.length>=4 && g.length<=8 && coinGroupIntentionalShape(g));
}
function addUniqueIssue(issues, issue){
  const dup=issues.some(o=>Math.abs(o.x-issue.x)<18 && Math.abs(o.y-issue.y)<18 && o.kind===issue.kind);
  if(!dup) issues.push(issue);
}
function detectIssues(enemies, coins){
  const issues=[];
  const visibleCoins=coins.filter(c=>c.y>-35&&c.y<G.H+35);
  const visibleEnemies=enemies.filter(e=>e.y+e.h>-35&&e.y<G.H+35);
  const pulsars=visibleEnemies.filter(e=>e.label==='pulsar');
  if(pulsars.length>=6){
    issues.push({ kind:'enemy-density', label:'敵密度', ...expandBox(bboxOf(pulsars), 10) });
  }
  for(const c of visibleCoins){
    if(coinInIntentionalLocalShape(c, visibleCoins)) continue;
    const nearCoins=visibleCoins.filter(o=>o!==c && Math.hypot(o.x-c.x,o.y-c.y)<74);
    const nearEnemy=visibleEnemies.some(e=>c.x>e.x-18 && c.x<e.x+e.w+18 && c.y>e.y-28 && c.y<e.y+e.h+76);
    if(nearCoins.length===0 && nearEnemy){
      issues.push({ kind:'isolated-coin', label:'孤立', x:c.x-24, y:c.y-24, w:48, h:48 });
    }
  }
  for(const c of visibleCoins){
    if(coinInIntentionalLocalShape(c, visibleCoins)) continue;
    const left=visibleEnemies.some(e=>e.x+e.w<c.x && c.x-(e.x+e.w)<86 && c.y>e.y-36 && c.y<e.y+e.h+62);
    const right=visibleEnemies.some(e=>e.x>c.x && e.x-c.x<86 && c.y>e.y-36 && c.y<e.y+e.h+62);
    if(left && right){
      issues.push({ kind:'between-enemies', label:'敵間', x:c.x-26, y:c.y-26, w:52, h:52 });
    }
  }
  const pathUsed=new Set();
  for(let i=0;i<visibleCoins.length;i++){
    const a=visibleCoins[i];
    const next=visibleCoins
      .filter((b,j)=>j!==i && Math.hypot(b.x-a.x,b.y-a.y)<112)
      .sort((p,q)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(q.x-a.x,q.y-a.y))[0];
    if(!next) continue;
    const hit=visibleEnemies.some(e=>segmentHitsBox(a,next,e,12));
    if(hit){
      const b=expandBox(bboxOf([a,next]), 14);
      addUniqueIssue(issues, {kind:'guide-enemy', label:'敵誘導', ...b});
    }
  }
  const used=new Set();
  for(let i=0;i<visibleCoins.length;i++){
    if(used.has(i)) continue;
    const group=[visibleCoins[i]];
    for(let j=0;j<visibleCoins.length;j++){
      if(i===j) continue;
      if(Math.abs(visibleCoins[j].x-visibleCoins[i].x)<92 && Math.abs(visibleCoins[j].y-visibleCoins[i].y)<100) group.push(visibleCoins[j]);
    }
    if(group.length>=6){
      const b=bboxOf(group);
      const lineLike=lineLikeBox(b);
      if(!lineLike && !coinGroupIntentionalShape(group)){
        for(const c of group) used.add(visibleCoins.indexOf(c));
        issues.push({ kind:'messy-cluster', label:'雑密集', ...expandBox(b, 14) });
      }
    }
  }
  for(let i=0;i<visibleCoins.length;i++){
    if(pathUsed.has(i)) continue;
    const c=visibleCoins[i];
    const group=visibleCoins.filter(o=>Math.abs(o.x-c.x)<112 && Math.abs(o.y-c.y)<190);
    if(group.length>=4 && group.length<=6){
      const b=bboxOf(group);
      const nearLine=b.w<36 || b.h<36 || b.w/b.h>3.2 || b.h/b.w>3.2;
      const compact=b.w<118 && b.h<190;
      if(compact && !nearLine && !coinGroupIntentionalShape(group)){
        group.forEach(o=>pathUsed.add(visibleCoins.indexOf(o)));
        addUniqueIssue(issues, {kind:'path-kink', label:'折れ線', ...expandBox(b, 12)});
      }
    }
  }
  return issues.slice(0,4);
}
function pageData(stages, pageNo){
  return {
    pageNo,
    W: G.W,
    H: G.H,
    hippoY: G.HIPPO_SCR_Y,
    stages: stages.map(stageKey => {
      const stage = buildStage(stageKey);
      return { stageKey, slices: pickSlices(stage).map(slice => sliceData(stage, slice)) };
    }),
  };
}

const page1=path.join(OUT_DIR,'placement-contact-sheet-1.svg');
const page2=path.join(OUT_DIR,'placement-contact-sheet-2.svg');
fs.writeFileSync(page1, pageSvg(['A','A2','B','B2'], 1));
fs.writeFileSync(page2, pageSvg(['C','C2','D','D2'], 2));
fs.writeFileSync(path.join(OUT_DIR,'placement-contact-sheet-1.json'), JSON.stringify(pageData(['A','A2','B','B2'], 1), null, 2));
fs.writeFileSync(path.join(OUT_DIR,'placement-contact-sheet-2.json'), JSON.stringify(pageData(['C','C2','D','D2'], 2), null, 2));
console.log(page1);
console.log(page2);
