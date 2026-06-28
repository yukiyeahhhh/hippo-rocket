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
  return {
    stageKey: stage.stageKey,
    alt: r((slice.cameraY-G.START_Y)/G.PXPM),
    enemies: slice.enemies.flatMap(b => b.boxes.map(box => ({
      label: box.label,
      x: box.x - box.hw,
      y: screenY(box.y, slice.cameraY) - box.hh,
      w: box.hw * 2,
      h: box.hh * 2,
    }))),
    coins: slice.coins.map(c => ({ x: c.x, y: screenY(c.y, slice.cameraY), r: c.r })),
  };
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
