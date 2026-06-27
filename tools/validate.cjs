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

// --- 固定譜面チェック（同じステージはリトライしても敵/コイン配置が同じ）---
function stageSignature(k){
  G.reset(); G.setStage(k); G.reset();
  G.spawnAhead(G.stageTop + 200);
  const birds = G.birds.map(b => [
    b.move || b.type,
    b.sprite || '',
    Math.round(b.x),
    Math.round(b.y),
    Math.round(b.cy || b.y),
    Math.round(b.r || b.hw || 0),
  ].join(':')).join('|');
  const coins = G.coins.map(c => [Math.round(c.x), Math.round(c.y), Math.round(c.r)].join(':')).join('|');
  return birds+'#'+coins;
}
console.log('\n=== 固定譜面チェック ===');
for(const k of Object.keys(G.STAGES)){
  const a=stageSignature(k), b=stageSignature(k);
  console.log(`  Stage ${k}: ${a===b ? '✓ 同一配置' : '✗ 配置が揺れる'}`);
}

// --- ステージ全体の通し（spawnAheadを高度を上げながら呼び、例外なく全ビート消化するか）---
for(const k of Object.keys(G.STAGES)){
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

// --- コイン重なり検査（実機FB「複数コインが重なって描画されるとバグっぽい」の回帰防止）---
// addCoin の単一入口ガード（既存コインと r_i+r_j+12 未満なら追加しない）が効いていれば、
// 物理的に重なる（中心間距離 < r_i+r_j）ペアは一つも出ないはず。全ステージで検証する。
console.log('\n=== コイン重なり検査 ===');
let overlapAll=true;
for(const k of Object.keys(G.STAGES)){
  G.reset(); G.setStage(k); G.reset();
  G.spawnAhead(G.stageTop + 200);
  const cs=G.coins.map(c=>({x:c.x, y:c.y, r:c.r||13}));
  let worst=Infinity, bad=0, pair=null;
  for(let i=0;i<cs.length;i++) for(let j=i+1;j<cs.length;j++){
    const dx=cs[i].x-cs[j].x, dy=cs[i].y-cs[j].y, d=Math.hypot(dx,dy), need=cs[i].r+cs[j].r;
    const slack=d-need; if(slack<worst){ worst=slack; pair=[cs[i],cs[j]]; }
    if(d<need) bad++;
  }
  const ok=bad===0; if(!ok) overlapAll=false;
  const detail = cs.length<2 ? '(コイン<2)' : `最接近の余白=${Math.round(worst)}px`;
  console.log(`  Stage ${k}: ${ok?'✓ 重なりなし':'✗ 重なり'+bad+'組'} / コイン${cs.length}個 ${detail}`);
}
console.log(overlapAll ? '  → 全ステージで重なりなし（addCoinガード有効）' : '  ★重なり検出：addCoinの距離ガードを確認');

// --- 鳥の過密スタック検査（実機FB「初期配置の鳥がめっちゃ重なってバグみたい・特に小鳥」の回帰防止）---
// 旧バグ：突入時の全コース事前配置で aheadSpawnY が画面上端へクランプし、開始付近の複数陣形が
// 同一Yへ潰れて十数体が重なった。preSpawning中は真のYに置く修正の回帰ガード。
// 判定：20px幅のYウィンドウ内の鳥数の最大値を見る。1陣形は最大6体程度＝それを大きく超えたら潰れ。
console.log('\n=== 鳥の過密スタック検査（事前配置）===');
const STACK_LIMIT=9; // 1陣形(最大6体)＋隣接の重なりを許容。これ超は同一Yへの潰れ＝バグ。
let stackAll=true;
for(const k of Object.keys(G.STAGES)){
  G.reset(); G.setStage(k); G.reset();
  G.spawnAhead(G.stageTop + 200);
  const ys=G.birds.map(b=>b.y).sort((a,b)=>a-b);
  let maxIn=0, atY=0;
  for(let i=0;i<ys.length;i++){ let c=0; for(let j=i;j<ys.length && ys[j]-ys[i]<=20;j++) c++; if(c>maxIn){ maxIn=c; atY=Math.round(ys[i]); } }
  const ok=maxIn<=STACK_LIMIT; if(!ok) stackAll=false;
  console.log(`  Stage ${k}: ${ok?'✓ 潰れなし':'✗ 過密'} / 鳥${ys.length}体 最大同帯=${maxIn}体(Y≈${atY})`);
}
console.log(stackAll ? '  → 全ステージで同一Yへの潰れなし（事前配置は真のYに展開）' : '  ★過密検出：preSpawning時のクランプ除外を確認');

// --- 見た目重なり検査（導入フライオーバーで「バグっぽく見える」重なりを防ぐ）---
// 当たり判定ではなく、スプライトのおおよその見た目半径で、敵同士・敵とコイン・コイン同士が
// 近すぎないかを見る。危険側コインも「敵にめり込んで見える」配置はNG。
function enemyY(b){ return b.y; }
function enemyVisualBoxes(b){
  const y=enemyY(b);
  if (b.move === 'shutter') {
    const gap=b.gapHalf || 46, hh=15+16, W=G.W;
    return [
      { x:(b.x-gap)/2, y, hw:Math.max(0,(b.x-gap)/2), hh },
      { x:(W+b.x+gap)/2, y, hw:Math.max(0,(W-b.x-gap)/2), hh },
    ];
  }
  if (b.cap) return [{ x:b.x, y, hw:(b.hw || 46)*1.75, hh:34 }];
  if (b.move === 'float') return [{ x:b.x, y, hw:(b.r || 23)*1.05, hh:(b.r || 23)*1.85 }];
  if (b.move === 'pulsar') return [{ x:b.x, y, hw:48*1.22, hh:48*1.22 }];
  if (b.sprite === 'storm') return [{ x:b.x, y, hw:72, hh:72 }];
  if (b.sprite === 'hawk' || b.move === 'diver') return [{ x:b.x, y, hw:66, hh:70 }];
  if (b.type === 'large') return [{ x:b.x, y, hw:66, hh:54 }];
  return [{ x:b.x, y, hw:40, hh:30 }];
}
function boxTouchesCircle(box,x,y,r,pad=0){
  const dx=Math.max(Math.abs(x-box.x)-box.hw,0);
  const dy=Math.max(Math.abs(y-box.y)-box.hh,0);
  return dx*dx+dy*dy < (r+pad)*(r+pad);
}
function boxesTouch(a,b,pad=0){
  return Math.abs(a.x-b.x) < a.hw+b.hw+pad && Math.abs(a.y-b.y) < a.hh+b.hh+pad;
}
console.log('\n=== 見た目重なり検査（敵/コイン）===');
let visualAll=true;
for(const k of Object.keys(G.STAGES)){
  G.reset(); G.setStage(k); G.reset();
  G.spawnAhead(G.stageTop + 200);
  const birds=G.birds.map((b,i)=>({ ...b, i, boxes:enemyVisualBoxes(b) }));
  const cs=G.coins.map((c,i)=>({ ...c, i, r:c.r||13 }));
  let ec=0, ee=0, cc=0, first='';
  for(const c of cs) for(const b of birds){
    if(b.boxes.some(box=>boxTouchesCircle(box,c.x,c.y,c.r,14))){
      ec++; if(!first) first=`敵-コイン c${c.i}/b${b.i}`;
    }
  }
  for(let i=0;i<birds.length;i++) for(let j=i+1;j<birds.length;j++){
    const a=birds[i], b=birds[j];
    if(a.boxes.some(ab=>b.boxes.some(bb=>boxesTouch(ab,bb,6)))){
      ee++; if(!first) first=`敵-敵 b${a.i}/b${b.i}`;
    }
  }
  for(let i=0;i<cs.length;i++) for(let j=i+1;j<cs.length;j++){
    const a=cs[i], b=cs[j], d=Math.hypot(a.x-b.x, a.y-b.y), need=a.r+b.r+1;
    if(d<need){ cc++; if(!first) first=`コイン-コイン c${a.i}/c${b.i} d=${Math.round(d)}<${Math.round(need)}`; }
  }
  const ok=ec===0 && ee===0 && cc===0;
  if(!ok) visualAll=false;
  console.log(`  Stage ${k}: ${ok?'✓ 重なりなし':'✗ 重なりあり'} / 敵-コイン${ec} 敵-敵${ee} コイン-コイン${cc}`+(first?` (${first})`:''));
}
console.log(visualAll ? '  → 全ステージで導入表示の見た目重なりなし' : '  ★見た目重なり検出：スポーン/コイン配置を確認');
