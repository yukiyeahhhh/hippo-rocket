// 生成バリデータ（手プレイ前の機械検証）：ブラウザ環境をstubしてindex.htmlのspawnを実行し、
// 上かぶり/フロート/スイフト列が「全機体で通れる横の隙間」を必ず残すか＋全ステージが例外なく頂上まで通るかを検査。
// 使い方: node tools/validate.cjs   （手法の解説は knowledge「ゲームの自動検証」）
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

// --- ブラウザ最小スタブ（loopは走らせない：requestAnimationFrameをno-op化）---
const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'canvas') return { width:432, height:768 };
  if (k === 'createLinearGradient' || k === 'createRadialGradient')
    return () => ({ addColorStop(){} });
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}});
const fakeCanvas = { getContext: () => ctxProxy, width:432, height:768, style:{},
  getBoundingClientRect: () => ({ left:0, top:0, width:432, height:768 }) };
function elStub(){ return { classList:{toggle(){},add(){},remove(){}}, addEventListener(){}, dataset:{}, style:{}, blur(){} }; }
const documentStub = {
  getElementById: () => fakeCanvas,
  querySelectorAll: () => { const a=[]; a.forEach=Array.prototype.forEach.bind(a); return a; },
  querySelector: () => elStub(),
};
class ImageStub { constructor(){ this.complete=false; this.naturalWidth=0; this.naturalHeight=0; } set src(v){} get src(){return '';} }

const sandbox = {
  document: documentStub, Image: ImageStub,
  window: {}, performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  addEventListener: () => {}, location: { search: '' },
  Math, Date, console, URLSearchParams,
};
sandbox.window = sandbox; // self-ref

const argNames = Object.keys(sandbox);
const argVals = argNames.map(k => sandbox[k]);
// インラインJSをそのまま実行し、内部の関数/状態を返してもらう（reset()が作り直す配列はgetterで最新を読む）
const exported = code + `
;return { reset, spawnOverhang, spawnFloat, spawnBird, spawnSwoop, spawnDive, spawnPulsar, spawnAhead,
  get birds(){return birds}, get coins(){return coins},
  set hippoY(v){hippoY=v}, get hippoY(){return hippoY}, get beatI(){return beatI}, get nextSpawn(){return nextSpawn},
  setStage(k){ stageKey=k; }, get stageTop(){return stageTop}, START_Y, PXPM, STAGES,
  W, HIPPO_R, VEHICLES, CAP_DY, BIRD_DESCENT, PULSAR_R_MIN, PULSAR_R_MAX };`;
const factory = new Function(...argNames, exported);
const G = factory(...argVals);

const { W, HIPPO_R, VEHICLES } = G;
// ある世界Yで、各機体が「横位置xを選べば通れる隙間」が存在するか（理不尽=必ず通れる答えが無い、を機械で排除）。
function passableAt(birds, worldY){
  return VEHICLES.map(V => {
    const hr = HIPPO_R * V.size, hw = V.hitW || 1;
    const blocked = [];
    for (const b of birds){
      const by = b.cy != null ? b.cy : b.y;
      const dvy = Math.abs(by - worldY);
      if (b.box){
        if (dvy < b.hh + hr*0.45){ const half = b.hw + hr*0.5; blocked.push([b.x-half, b.x+half]); }
      } else {
        const ry = b.r*0.78 + hr*0.66;
        if (dvy < ry){ const half = (Math.sqrt(Math.max(0,ry*ry - dvy*dvy)))*hw; blocked.push([b.x-half, b.x+half]); }
      }
    }
    const lo = hr*0.7, hi = W - hr*0.7;
    blocked.sort((a,b)=>a[0]-b[0]);
    let widest=0, cur=lo;
    for (const [a,c] of blocked){ if (a > cur){ const gap=Math.min(a,hi)-cur; if(gap>widest)widest=gap; } cur=Math.max(cur, c); if(cur>=hi)break; }
    if (cur < hi){ const gap=hi-cur; if(gap>widest)widest=gap; }
    return { veh:V.name, ok: widest >= hr*1.4, widest:Math.round(widest), need:Math.round(hr*1.4) };
  });
}
function report(title, birds, sampleYs){
  console.log('\n=== '+title+' ===');
  console.log('  spawned: '+birds.length+' 体  (box='+birds.filter(b=>b.box).length+' / float='+birds.filter(b=>b.move==='float').length+' / pulsar='+birds.filter(b=>b.move==='pulsar').length+')');
  for (const wy of sampleYs){
    const res = passableAt(birds, wy);
    const fails = res.filter(r=>!r.ok);
    console.log('  Y='+Math.round(wy)+(fails.length? '  ✗ 通れない機体: '+fails.map(f=>f.veh+`(${f.widest}<${f.need})`).join(', ') : '  ✓ 全機体OK'));
  }
}

// --- 上かぶりゲート（板の片側に必ずまっすぐ登れる抜け道が残るか）---
G.reset();
const yO = 2000;
G.spawnOverhang(yO);
const ob = G.birds.slice();
const cap = ob.find(b=>b.box);
console.log('上かぶり: 入口列', ob.filter(b=>!b.box).length, '体 / ペリカン板 x='+Math.round(cap.x)+' hw='+cap.hw+' (cy='+cap.cy+', 入口cy='+yO+')');
console.log('  危険側コイン:', G.coins.map(c=>'x='+Math.round(c.x)+' y='+Math.round(c.y)));
report('上かぶり @入口列(yO)', ob, [yO]);
report('上かぶり @板の高さ(yO+CAP_DY)', ob, [yO + G.CAP_DY]);

// --- フロート ---
G.reset(); G.setStage('B'); G.spawnFloat(5000);
const fb = G.birds.slice();
console.log('\nフロート: '+fb.length+'体 x='+fb.map(b=>Math.round(b.x)).join(',')+' 近傍コイン='+G.coins.map(c=>Math.round(c.x)));
report('フロート @湧き高さ', fb, [fb.length? fb[0].cy : 0]);

// --- スイフト列(line/vee/stream) ---
for (const shape of ['line','vee','stream']){
  G.reset(); G.spawnBird(3000, { tight:true, shape });
  report('スイフト列 shape='+shape, G.birds.slice(), [3000, 3000+38, 3000-38]);
}

// --- パルサー（縮小時に全機体が通れるか。最大時は狭い=待つ意味がある）---
G.reset(); G.spawnPulsar(3000);
const pb = G.birds.slice();
for (const b of pb) b.r = G.PULSAR_R_MIN;
report('パルサー @収縮時(通過窓)', pb, [3000]);
for (const b of pb) b.r = G.PULSAR_R_MAX;
const pressure = passableAt(pb, 3000);
console.log('\n=== パルサー @膨張時(待つ圧) ===');
console.log('  widest/need: '+pressure.map(r=>r.veh+' '+r.widest+'/'+r.need).join(', ')+'  (狭いほど待つ意味あり)');
console.log('\n(注: widest=最大の空き幅 / need=自機が余裕で通る幅=半径*1.4。✓なら全機体に通路あり)');

// --- ステージ全体の通し（spawnAheadを高度を上げながら呼び、例外なく全ビート消化するか）---
for(const k of ['A','B','C']){
  G.reset(); G.setStage(k); G.reset();
  const top=G.stageTop, types={};
  let err=null, steps=0;
  try{
    for(let y=G.START_Y; y<top+200 && steps<4000; y+=120, steps++){
      G.hippoY = y; G.spawnAhead();
      for(const b of G.birds){ types[b.move||b.type]=(types[b.move||b.type]||0)+1; }
    }
  }catch(e){ err=e; }
  const comp=Object.keys(types).join(', ');
  console.log(`\nステージ${k} 通し: ${err? '✗ 例外: '+err.message : '✓ 例外なく頂上まで'} (top=${Math.round((top-G.START_Y)/G.PXPM)}m, 出現move種=[${comp}])`);
}
