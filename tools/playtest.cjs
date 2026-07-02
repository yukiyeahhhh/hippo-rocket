// 自動プレイテスト Phase 1（要件定義: yukiya-private/projects/game-dev-flow/08-自動プレイテスト要件定義.md §7）
// 方策1〈安全優先〉botで stub 実行し、クリア率などを機械計測する。
// 土台は tools/validate.cjs と同じ「ブラウザstub＋New Functionでindex.html内蔵scriptを実行」方式。
// 使い方: node tools/playtest.cjs [試行数=100] [ステージキー=A] [--all-veh]
//   --all-veh を付けると、退役機体を除く全機体×指定ステージも走らせる（要件§7の「余裕があれば」対応）。
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

// --- ブラウザ最小スタブ（validate.cjsを踏襲。loopは自分で回すのでrequestAnimationFrameはno-op）---
const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'canvas') return { width:432, height:768 };
  if (k === 'createLinearGradient' || k === 'createRadialGradient')
    return () => ({ addColorStop(){} });
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}});
const fakeCanvas = { getContext: () => ctxProxy, width:432, height:768, style:{},
  getBoundingClientRect: () => ({ left:0, top:0, width:432, height:768 }) };
function elStub(){ return { classList:{toggle(){},add(){},remove(){},contains(){return false;}}, addEventListener(){}, appendChild(){}, dataset:{}, style:{}, blur(){} }; }
const documentStub = {
  getElementById: () => fakeCanvas,
  querySelectorAll: () => { const a=[]; a.forEach=Array.prototype.forEach.bind(a); return a; },
  querySelector: () => elStub(),
  createElement: () => fakeCanvas,
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
// index.html内蔵scriptをそのまま実行し、botを動かすのに要る内部状態/関数だけ出口で返してもらう。
const exported = code + `
;return { reset, launch, loop, setStage(k){ stageKey=k; }, setVeh(i){ vehIdx=i; },
  get vehIdx(){return vehIdx}, get stageTop(){return stageTop},
  get birds(){return birds},
  get hippoY(){return hippoY}, set hippoY(v){hippoY=v},
  get hipX(){return hipX},
  set pressed(v){pressed=v}, get pressed(){return pressed},
  set steerL(v){steerL=v}, get steerL(){return steerL},
  set steerR(v){steerR=v}, get steerR(){return steerR},
  get hp(){return hp}, get dead(){return dead}, get cleared(){return cleared},
  get alt(){return alt}, get scene(){return scene},
  START_Y, PXPM, W, H, HIPPO_R, MAX_HP, VEHICLES, VEH_META, STAGES };`;
const factory = new Function(...argNames, exported);
const G = factory(...argVals);

// ===== 方策1〈安全優先〉：最近傍の脅威から離れる方向へ横移動、コインは無視。縦は常時上昇（押しっぱなし）=====
// 常時上昇にしたのは「上げ続けを罰す」ゲート系(上かぶり/フロート)への耐性はbotに期待せず、
// まず方策間・機体間の相対差が出る最小実装にするため（要件§8：絶対値でなく相対差を見る道具）。
function decideInputs(G){
  const birds = G.birds;
  const hipX = G.hipX, hippoY = G.hippoY;
  let nearest = null, nd = Infinity;
  for (const b of birds) {
    const by = (b.cy != null ? b.cy : b.y);
    const dx = b.x - hipX, dy = by - hippoY;
    const d = dx*dx + dy*dy;
    if (d < nd) { nd = d; nearest = b; }
  }
  G.pressed = true; // 常時上昇（登り続けることが前提。方策1は横回避だけを担当）
  if (nearest) {
    const dx = nearest.x - hipX;
    if (Math.abs(dx) < 2) { G.steerL = false; G.steerR = false; }
    else if (dx > 0) { G.steerL = true; G.steerR = false; } // 脅威が右→左へ離れる
    else { G.steerL = false; G.steerR = true; }             // 脅威が左→右へ離れる
  } else {
    G.steerL = false; G.steerR = false;
  }
}

const DT_MS = 1000/60;
const MAX_STEPS = 60*180; // 3分ぶん。これを超えたら詰み扱い(timeout)にする安全弁

function runTrial(vehIdx, stageKey) {
  G.setStage(stageKey);
  G.launch();
  G.setVeh(vehIdx);
  let now = 0, steps = 0, hits = 0, prevHp = G.hp;
  while (true) {
    steps++;
    now += DT_MS;
    decideInputs(G);
    G.loop(now);
    if (G.hp < prevHp) hits += (prevHp - G.hp);
    prevHp = G.hp;
    if (G.dead || G.cleared) break;
    if (steps >= MAX_STEPS) return { cleared:false, timeout:true, altM:G.alt, hits, steps };
  }
  return { cleared: G.cleared, timeout:false, altM: G.alt, hits, steps };
}

function runN(vehIdx, stageKey, n) {
  let clears = 0, altSum = 0, hitSum = 0, timeouts = 0;
  for (let i = 0; i < n; i++) {
    const r = runTrial(vehIdx, stageKey);
    if (r.cleared) clears++;
    if (r.timeout) timeouts++;
    altSum += r.altM;
    hitSum += r.hits;
  }
  return {
    n, clears, clearRate: clears / n,
    avgAlt: altSum / n,
    avgHits: hitSum / n,
    timeouts,
  };
}

// ===== CLI引数 =====
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const N = positional[0] ? parseInt(positional[0], 10) : 100;
const stageKey = positional[1] || 'A';
const allVeh = args.includes('--all-veh');

console.log('=== hippo-rocket 自動プレイテスト Phase 1（方策1: 安全優先） ===');
console.log('※このツールはstub環境の相対差を見るもの。絶対値（クリア率そのもの等）は実ブラウザと一致しない前提で、機体間・方策間の"差"だけを判断材料にすること（要件§8）。');
console.log('');

const vehName = G.VEHICLES[0].name;
console.log(`--- 機体=${vehName}（既定/index0） ステージ=${stageKey} N=${N} ---`);
const main = runN(0, stageKey, N);
console.log(`試行数: ${main.n}`);
console.log(`クリア率: ${(main.clearRate*100).toFixed(1)}% (${main.clears}/${main.n})`);
console.log(`平均到達高度: ${main.avgAlt.toFixed(1)} m`);
console.log(`平均被弾数: ${main.avgHits.toFixed(2)} 回`);
if (main.timeouts) console.log(`(タイムアウト扱い: ${main.timeouts}件 ※${MAX_STEPS}フレーム=3分相当で頂上未到達・生存)`);

if (allVeh) {
  console.log('');
  console.log(`--- 全機体 × ステージ${stageKey}（方策1のまま） ---`);
  for (let vi = 0; vi < G.VEHICLES.length; vi++) {
    if (G.VEH_META[vi] && G.VEH_META[vi].retired) continue; // こつぶ=廃止枠はスキップ
    const r = runN(vi, stageKey, N);
    const name = G.VEHICLES[vi].name;
    console.log(`${name.padEnd(6,'　')}: クリア率 ${(r.clearRate*100).toFixed(1)}%  平均到達高度 ${r.avgAlt.toFixed(1)}m  平均被弾 ${r.avgHits.toFixed(2)}回${r.timeouts?`  (timeout:${r.timeouts})`:''}`);
  }
}
