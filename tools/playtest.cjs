// 自動プレイテスト Phase 2（要件定義: yukiya-private/projects/game-dev-flow/08-自動プレイテスト要件定義.md §3〜§5）
// 方策1〈安全優先〉/方策2〈欲張り〉/方策3〈直進〉の3botでstub実行し、機体×ステージ×方策のマトリクスを計測する。
// 土台は tools/validate.cjs と同じ「ブラウザstub＋New Functionでindex.html内蔵scriptを実行」方式。
// 使い方:
//   node tools/playtest.cjs [試行数=100] [ステージキー=A] [--all-veh] [--policy=1|2|3|all]
//     --policy … 方策を選ぶ(既定=1=安全優先)。all を付けると同一機体/ステージで3方策を比較。
//     --all-veh … 退役機体を除く全機体×指定ステージも走らせる。
//   node tools/playtest.cjs [試行数] --report[=出力パス.md] [--policy=1|2|3]
//     全機体×全ステージ×方策(既定=1,2,3全部。--policyで絞れる)のマトリクスを計測し、
//     コンソール表示に加えて docs/audits/ 配下(既定ファイル名は当日日付)にMarkdownレポートを書く。
//     被弾高度分布(機体×方策で全ステージ合算のテキストバー)と、要件§5「判定への接続」の自動判定を末尾に出す。
//   node tools/playtest.cjs --update-baseline / --check-baseline … バランス回帰ゲート用（pre-commitから呼ばれる。従来どおり）。
//     全機体×全ステージを方策1・N=5固定で計測し、tools/playtest_baseline.json に保存/比較する。挙動は Phase 1 と不変。
//
// v3: 決定的ジッター（要件定義§7.5・2026-07-03）
//   トライアル間汚染バグ(last未リセット)を修正した結果、全トライアルが完全に同一軌道になり、
//   クリア率が0%/100%の二値にしかならなくなった（従来見えていた中間値は汚染ノイズだった）。
//   対策として、試行番号(trialIndex)だけをシードにしたLCGで①開始X位置の±小幅オフセット②bot反応の
//   0〜数フレーム遅延を生成する（Math.randomは使わない＝同じtrialIndexなら常に同じ揺らぎ＝決定性は維持）。
//   詳細は jitterFor() 参照。
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
  get birds(){return birds}, get coins(){return coins},
  get hippoY(){return hippoY}, set hippoY(v){hippoY=v},
  get hipX(){return hipX}, set hipX(v){hipX=v},
  set pressed(v){pressed=v}, get pressed(){return pressed},
  set steerL(v){steerL=v}, get steerL(){return steerL},
  set steerR(v){steerR=v}, get steerR(){return steerR},
  set last(v){last=v}, get last(){return last},
  get hp(){return hp}, get dead(){return dead}, get cleared(){return cleared},
  get alt(){return alt}, get scene(){return scene},
  START_Y, PXPM, W, H, HIPPO_R, MAX_HP, VEHICLES, VEH_META, STAGES, STAGE_ORDER };`;
const factory = new Function(...argNames, exported);
const G = factory(...argVals);

// ===== 方策一覧（要件§3）=====
const POLICY_NAMES = { 1:'安全優先', 2:'欲張り', 3:'直進' };

// ===== 方策1〈安全優先〉：最近傍の脅威から離れる方向へ横移動、コインは無視。縦は常時上昇（押しっぱなし）=====
// 常時上昇にしたのは「上げ続けを罰す」ゲート系(上かぶり/フロート)への耐性はbotに期待せず、
// まず方策間・機体間の相対差が出る最小実装にするため（要件§8：絶対値でなく相対差を見る道具）。
// ★baseline(--check-baseline/--update-baseline)が参照する既存挙動。ロジックは1文字も変えない(数値が動くとゲートが誤検知する)。
function decideInputsPolicy1(G){
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

// ===== 方策2〈欲張り〉：最近傍コインへ向かう。脅威は接触寸前(半径+マージン圏内)のみ回避。縦は常時上昇 =====
// 「上手いAI」を作るのが目的ではなく、方策1(コイン無視)との対比でリスク/リターンの効き(経済側)の差を見えるようにする(要件§3)。
const POLICY2_MARGIN = 18; // 接触寸前とみなす追加マージン(px)。厳密な当たり判定(enemyVisualBoxes等)は複製せず、円近似の最小実装にする。
function decideInputsPolicy2(G){
  const birds = G.birds, coins = G.coins;
  const hipX = G.hipX, hippoY = G.hippoY;
  const hitW = (G.VEHICLES[G.vehIdx] && G.VEHICLES[G.vehIdx].hitW) || 1;
  const hippoR = G.HIPPO_R * hitW;
  G.pressed = true; // 常時上昇（方策1と条件を揃え、横操作の差だけを見る）

  // 接触寸前の脅威だけ検出（方策1と違い、離れた脅威は無視してコインへ向かう）
  let threat = null, td = Infinity;
  for (const b of birds) {
    const by = (b.cy != null ? b.cy : b.y);
    const dx = b.x - hipX, dy = by - hippoY;
    const d = dx*dx + dy*dy;
    const rad = (b.r || 20) + hippoR + POLICY2_MARGIN;
    if (d < rad*rad && d < td) { td = d; threat = b; }
  }
  if (threat) {
    const dx = threat.x - hipX;
    if (Math.abs(dx) < 2) { G.steerL = false; G.steerR = false; }
    else if (dx > 0) { G.steerL = true; G.steerR = false; }
    else { G.steerL = false; G.steerR = true; }
    return;
  }
  // 脅威なし→最近傍の未取得コインへ横位置を合わせる
  let nearestCoin = null, cd = Infinity;
  for (const c of coins) {
    if (c.got) continue;
    const dx = c.x - hipX, dy = c.y - hippoY;
    const d = dx*dx + dy*dy;
    if (d < cd) { cd = d; nearestCoin = c; }
  }
  if (nearestCoin) {
    const dx = nearestCoin.x - hipX;
    if (Math.abs(dx) < 2) { G.steerL = false; G.steerR = false; }
    else if (dx > 0) { G.steerL = false; G.steerR = true; } // コインが右→右へ寄る
    else { G.steerL = true; G.steerR = false; }
  } else {
    G.steerL = false; G.steerR = false;
  }
}

// ===== 方策3〈直進〉：入力を一定パターンで固定（ベースライン）。ゲーム状態は一切読まない =====
// 縦は常時上昇。横は経過フレーム数だけで決まる固定サイクル(3秒左→3秒右)。機体/ステージの中身に反応しない
// 「何もしないよりはマシな操作」を代表させ、方策1/2との比較の基準線にする(要件§3)。
const POLICY3_CYCLE = 180; // フレーム数(60fps換算で3秒)
function decideInputsPolicy3(G, steps){
  G.pressed = true;
  const pos = steps % POLICY3_CYCLE;
  if (pos < POLICY3_CYCLE/2) { G.steerL = true; G.steerR = false; }
  else { G.steerL = false; G.steerR = true; }
}

function decideInputs(G, policy, steps){
  if (policy === 2) return decideInputsPolicy2(G);
  if (policy === 3) return decideInputsPolicy3(G, steps);
  return decideInputsPolicy1(G);
}

const DT_MS = 1000/60;
const MAX_STEPS = 60*180; // 3分ぶん。これを超えたら詰み扱い(timeout)にする安全弁
const ALT_BIN = 100; // 被弾高度の分布ビン幅(m)

// ===== v3: 決定的ジッター（要件§7.5）=====
// 試行番号(trialIndex)だけをシードにする。機体/ステージ/方策には依存しない
// (要件どおり「試行番号をシードにした」ジッターなので、同じtrialIndexは全セルで同じ揺らぎになる＝
//  同条件を2回走らせれば毎回ビット単位で同じ結果になる)。
const JITTER_X_RANGE = 8;   // 開始X位置オフセットの片振幅(px)。HIPPO_R=24の1/3程度=「小幅」
const JITTER_DELAY_MAX = 3; // bot反応遅延の最大フレーム数(0〜3フレーム=60fpsで最大50ms)
function jitterRng(seed) {
  // 最小のLCG(mulberry32相当)。trialIndexそのままだと下位ビットの周期性が出やすいので軽くハッシュしてから使う。
  let state = (Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0) || 1;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296; // [0,1)
  };
}
function jitterFor(trialIndex) {
  const rng = jitterRng(trialIndex);
  const xOffset = (rng() * 2 - 1) * JITTER_X_RANGE;
  const reactionDelay = Math.floor(rng() * (JITTER_DELAY_MAX + 1));
  return { xOffset, reactionDelay };
}

function runTrial(vehIdx, stageKey, policy, trialIndex) {
  G.setStage(stageKey);
  G.launch();
  G.setVeh(vehIdx);
  // index.html側のlastはモジュール読み込み時の1回しか初期化されない設計(実ブラウザはRAFのnowが単調増加するので問題にならない)。
  // このstubは各トライアルでnowを0から再スタートするため、resetしないと1フレーム目に前トライアル分の巨大な負のdtが混入し、結果が前試行の終了状態に汚染される。
  G.last = 0;

  const { xOffset, reactionDelay } = jitterFor(trialIndex || 0);
  G.hipX = G.hipX + xOffset; // ①開始X位置の決定的ジッター
  G.pressed = false; G.steerL = false; G.steerR = false; // 遅延中はbotが無反応(=無入力)扱い

  let now = 0, steps = 0, hits = 0, prevHp = G.hp;
  const hitAlts = [];
  while (true) {
    steps++;
    now += DT_MS;
    if (steps > reactionDelay) decideInputs(G, policy, steps); // ②bot反応の決定的遅延
    G.loop(now);
    if (G.hp < prevHp) {
      const lost = prevHp - G.hp;
      hits += lost;
      for (let i = 0; i < lost; i++) hitAlts.push(G.alt);
    }
    prevHp = G.hp;
    if (G.dead || G.cleared) break;
    if (steps >= MAX_STEPS) return { cleared:false, timeout:true, altM:G.alt, hits, steps, hitAlts };
  }
  return { cleared: G.cleared, timeout:false, altM: G.alt, hits, steps, hitAlts };
}

function binOf(altM) { return Math.floor(altM / ALT_BIN) * ALT_BIN; }

function runN(vehIdx, stageKey, n, policy) {
  policy = policy || 1;
  let clears = 0, altSum = 0, hitSum = 0, timeouts = 0;
  const hitAltBins = {};
  for (let i = 0; i < n; i++) {
    const r = runTrial(vehIdx, stageKey, policy, i);
    if (r.cleared) clears++;
    if (r.timeout) timeouts++;
    altSum += r.altM;
    hitSum += r.hits;
    for (const a of r.hitAlts) {
      const b = binOf(a);
      hitAltBins[b] = (hitAltBins[b] || 0) + 1;
    }
  }
  return {
    n, clears, clearRate: clears / n,
    avgAlt: altSum / n,
    avgHits: hitSum / n,
    timeouts,
    hitAltBins,
  };
}

function peakBin(hitAltBins) {
  let best = null, bestC = -1;
  for (const k of Object.keys(hitAltBins)) {
    if (hitAltBins[k] > bestC) { bestC = hitAltBins[k]; best = k; }
  }
  return best == null ? null : parseInt(best, 10);
}

function mergeBins(target, src) {
  for (const k of Object.keys(src)) target[k] = (target[k] || 0) + src[k];
  return target;
}

// ===== 被弾高度分布のテキストバー =====
function renderHitAltBar(hitAltBins, opts) {
  opts = opts || {};
  const width = opts.width || 30;
  const keys = Object.keys(hitAltBins).map(Number).sort((a,b) => a-b);
  if (!keys.length) return ['  (被弾なし)'];
  const max = Math.max(...keys.map(k => hitAltBins[k]));
  return keys.map(k => {
    const c = hitAltBins[k];
    const barLen = max > 0 ? Math.max(1, Math.round((c / max) * width)) : 0;
    const label = `${String(k).padStart(4)}-${String(k+ALT_BIN).padStart(4)}m`;
    return `  ${label} | ${'█'.repeat(barLen)} ${c}`;
  });
}

// ===== CLI引数 =====
const args = process.argv.slice(2);
const positional = args.filter(a => !a.startsWith('--'));
const N = positional[0] ? parseInt(positional[0], 10) : 100;
const stageKey = positional[1] || 'A';
const allVeh = args.includes('--all-veh');
const updateBaseline = args.includes('--update-baseline');
const checkBaseline = args.includes('--check-baseline');
const policyArgRaw = args.find(a => a.startsWith('--policy='));
const policyArg = policyArgRaw ? policyArgRaw.slice('--policy='.length) : null; // '1'|'2'|'3'|'all'|null
const reportArgRaw = args.find(a => a === '--report' || a.startsWith('--report='));
const reportRequested = !!reportArgRaw;
const reportPath = reportArgRaw && reportArgRaw.startsWith('--report=') ? reportArgRaw.slice('--report='.length) : null;

// ===== 基準値（全機体×全ステージ・方策1固定）：バランス回帰ゲート =====
// N=5固定。実測：全120通り(6機体×20ステージ)でN=50だと約80秒/N=10でも約40秒かかり
// pre-commitの30秒枠を超えるため、要件の「超えるならNを下げる」に従い5へ下げた（約20秒）。
// 決定的な再現(08要件)なので、同じindex.htmlなら同条件で常に同じ数字が出る＝差分はコード変更の合図。
// ★Phase 2で方策2/3を追加したが、この基準値は従来どおり方策1のみ・従来のrunN呼び出しのまま(挙動不変)。
const BASELINE_N = 5;
const BASELINE_POLICY = 1;
const BASELINE_PATH = path.join(__dirname, 'playtest_baseline.json');
const activeVehIdx = [];
for (let vi = 0; vi < G.VEHICLES.length; vi++) {
  if (G.VEH_META[vi] && G.VEH_META[vi].retired) continue;
  activeVehIdx.push(vi);
}
const STAGE_KEYS = G.STAGE_ORDER;

function computeBaselineResults() {
  const results = {};
  for (const vi of activeVehIdx) {
    const name = G.VEHICLES[vi].name;
    results[name] = {};
    for (const sk of STAGE_KEYS) {
      const r = runN(vi, sk, BASELINE_N, BASELINE_POLICY);
      results[name][sk] = { clearRate: r.clearRate, avgAlt: r.avgAlt, avgHits: r.avgHits };
    }
  }
  return results;
}

if (updateBaseline || checkBaseline) {
  const t0 = Date.now();
  const results = computeBaselineResults();
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);

  if (updateBaseline) {
    const baseline = { n: BASELINE_N, generatedAt: new Date().toISOString(), results };
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
    console.log(`基準値を更新: ${BASELINE_PATH}（N=${BASELINE_N}, 計測${elapsedSec}秒）`);
  } else {
    console.log(`=== バランス回帰チェック（基準値と比較, N=${BASELINE_N}, 計測${elapsedSec}秒） ===`);
    let baseline;
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8'));
    } catch (e) {
      console.log('[playtest] 基準値ファイルが無いのでスキップ: node tools/playtest.cjs --update-baseline で作成して');
      process.exit(0);
    }
    const diffs = [];
    for (const vi of activeVehIdx) {
      const name = G.VEHICLES[vi].name;
      for (const sk of STAGE_KEYS) {
        const cur = results[name][sk];
        const base = baseline.results && baseline.results[name] && baseline.results[name][sk];
        if (!base) {
          diffs.push(`機体${name}/ステージ${sk}: 基準値なし(新規) クリア率${(cur.clearRate*100).toFixed(1)}%`);
          continue;
        }
        if (Math.abs(cur.clearRate - base.clearRate) > 1e-9) {
          diffs.push(`機体${name}/ステージ${sk}: クリア率${(base.clearRate*100).toFixed(1)}%→${(cur.clearRate*100).toFixed(1)}%`);
        }
      }
    }
    if (diffs.length) {
      console.log(`★差分あり(${diffs.length}件):`);
      diffs.forEach(d => console.log('  ' + d));
      console.log('意図した変更なら node tools/playtest.cjs --update-baseline を実行して基準値をコミットに含めて。');
    } else {
      console.log('基準値と一致。差分なし。');
    }
  }
  process.exit(0);
}

// ===== --report：全機体×全ステージ×方策のマトリクス（要件§4/§5・Phase 2） =====
if (reportRequested) {
  const policies = policyArg && policyArg !== 'all' ? [parseInt(policyArg, 10)] : [1, 2, 3];
  const t0 = Date.now();
  // results[policy][vehName][stageKey] = runN結果
  const results = {};
  for (const p of policies) {
    results[p] = {};
    for (const vi of activeVehIdx) {
      const name = G.VEHICLES[vi].name;
      results[p][name] = {};
      for (const sk of STAGE_KEYS) {
        results[p][name][sk] = runN(vi, sk, N, p);
      }
    }
  }
  const elapsedSec = ((Date.now() - t0) / 1000).toFixed(1);
  const vehNames = activeVehIdx.map(vi => G.VEHICLES[vi].name);

  console.log(`=== hippo-rocket 自動プレイテスト Phase 2（全機体×全ステージ×方策, N=${N}, 計測${elapsedSec}秒） ===`);
  console.log('※stub環境の相対差を見るもの。絶対値は実ブラウザと一致しない前提（要件§8）。');
  console.log('');
  for (const p of policies) {
    console.log(`--- 方策${p}〈${POLICY_NAMES[p]}〉クリア率(%) ---`);
    const header = ['機体'.padEnd(6,'　'), ...STAGE_KEYS].join('\t');
    console.log(header);
    for (const name of vehNames) {
      const row = [name.padEnd(6,'　')];
      for (const sk of STAGE_KEYS) row.push((results[p][name][sk].clearRate*100).toFixed(0));
      console.log(row.join('\t'));
    }
    console.log('');
  }

  // ===== 要件§5「判定への接続」の自動生成 =====

  // (a) 支配的戦略チェック：全ステージ×全方策(セル)で常に最上位タイに入る機体がいるか
  let dominantCandidates = null; // Set<string>|null
  const cellBestCount = {}; // vehName -> 何セルでtop集合入りしたか(参考値)
  vehNames.forEach(n => cellBestCount[n] = 0);
  for (const p of policies) {
    for (const sk of STAGE_KEYS) {
      const cellVals = vehNames.map(name => ({ name, r: results[p][name][sk] }));
      const maxClear = Math.max(...cellVals.map(v => v.r.clearRate));
      const top = cellVals.filter(v => Math.abs(v.r.clearRate - maxClear) < 1e-9).map(v => v.name);
      top.forEach(n => cellBestCount[n]++);
      const topSet = new Set(top);
      dominantCandidates = dominantCandidates === null ? topSet : new Set([...dominantCandidates].filter(n => topSet.has(n)));
    }
  }
  const isDominant = dominantCandidates && dominantCandidates.size > 0;

  // (b) 設計意図との照合：STAGES[key].recと、3方策平均クリア率トップの機体
  const designMatchRows = [];
  let designMatches = 0;
  for (const sk of STAGE_KEYS) {
    const rec = G.STAGES[sk].rec;
    const avgByVeh = vehNames.map(name => {
      const vals = policies.map(p => results[p][name][sk].clearRate);
      return { name, avg: vals.reduce((a,b)=>a+b,0)/vals.length };
    });
    const maxAvg = Math.max(...avgByVeh.map(v => v.avg));
    const best = avgByVeh.filter(v => Math.abs(v.avg - maxAvg) < 1e-9).map(v => v.name);
    const match = rec ? best.includes(rec) : null;
    if (match) designMatches++;
    designMatchRows.push({ sk, name: G.STAGES[sk].name, rec, best, match });
  }

  // (c) 安全優先(方策1)でクリア率0%のステージ一覧（詰み疑い）
  const stuckRows = [];
  if (results[1]) {
    for (const sk of STAGE_KEYS) {
      for (const name of vehNames) {
        if (results[1][name][sk].clearRate === 0) stuckRows.push({ sk, name, stageName: G.STAGES[sk].name });
      }
    }
  }

  console.log('--- 判定への接続（要件§5） ---');
  console.log(`支配的戦略チェック: ${isDominant ? `× 全ステージ×全方策で最良を独占/共有する機体あり(${[...dominantCandidates].join('/')})` : '○ 単独で常に最良の機体はなし'}`);
  console.log(`設計意図との一致: ${designMatches}/${STAGE_KEYS.length} ステージが「活きるステージ」宣言(rec)と一致`);
  console.log(`詰み疑い(方策1クリア率0%): ${stuckRows.length}件`);

  // ===== Markdownレポート生成 =====
  const today = new Date().toISOString().slice(0,10);
  const outPath = reportPath
    ? (path.isAbsolute(reportPath) ? reportPath : path.join(__dirname, '..', reportPath))
    : path.join(__dirname, '..', 'docs', 'audits', `${today}_playtest-phase2.md`);

  let md = '';
  md += `# 自動プレイテスト Phase 2 レポート\n\n`;
  md += `> 生成: ${new Date().toISOString()} / N=${N} / 方策=${policies.map(p=>`${p}(${POLICY_NAMES[p]})`).join(', ')} / 計測${elapsedSec}秒\n`;
  md += `> 土台=[08-自動プレイテスト要件定義.md](../../../yukiya-private/projects/game-dev-flow/08-自動プレイテスト要件定義.md) §3方策・§4指標・§5判定。stub環境の相対差専用（絶対値は実ブラウザと不一致前提・要件§8）。\n\n`;

  md += `## マトリクス（機体×ステージ×方策：クリア率%）\n\n`;
  for (const p of policies) {
    md += `### 方策${p}〈${POLICY_NAMES[p]}〉\n\n`;
    md += `| 機体 | ${STAGE_KEYS.join(' | ')} |\n`;
    md += `|---|${STAGE_KEYS.map(()=>'---').join('|')}|\n`;
    for (const name of vehNames) {
      const cells = STAGE_KEYS.map(sk => {
        const r = results[p][name][sk];
        const pk = peakBin(r.hitAltBins);
        const pkStr = pk == null ? '-' : `${pk}`;
        return `${(r.clearRate*100).toFixed(0)}%(被弾峰${pkStr}m)`;
      });
      md += `| ${name} | ${cells.join(' | ')} |\n`;
    }
    md += '\n';
  }

  md += `## 被弾高度の分布（機体×方策・全ステージ合算のテキストバー、${ALT_BIN}mビン）\n\n`;
  for (const p of policies) {
    md += `### 方策${p}〈${POLICY_NAMES[p]}〉\n\n`;
    for (const name of vehNames) {
      const merged = {};
      for (const sk of STAGE_KEYS) mergeBins(merged, results[p][name][sk].hitAltBins);
      md += `**${name}**\n\n`;
      md += '```\n';
      md += renderHitAltBar(merged).join('\n') + '\n';
      md += '```\n\n';
    }
  }

  md += `## 判定への接続（要件§5）\n\n`;
  md += `### 支配的戦略チェック\n\n`;
  md += `全ステージ×全方策(計${STAGE_KEYS.length * policies.length}セル)で、常にクリア率最上位(タイ含む)に入り続けた機体がいるかを機械チェックした。\n\n`;
  if (isDominant) {
    md += `**× 該当あり**: ${[...dominantCandidates].join(', ')} が全セルで最良(タイ含む)。単一機体が支配的＝07監査C項目に抵触の疑い。\n\n`;
  } else {
    md += `**○ 該当なし**: 全セルを通じて常に最良であり続けた単独機体はいなかった。\n\n`;
  }
  md += `参考（各機体が最良集合に入ったセル数／全${STAGE_KEYS.length * policies.length}セル）:\n\n`;
  md += `| 機体 | 最良集合入り回数 |\n|---|---|\n`;
  vehNames.forEach(name => { md += `| ${name} | ${cellBestCount[name]} |\n`; });
  md += '\n';

  md += `### 設計意図との照合（機体設計.md「活きるステージ」宣言 vs 計測）\n\n`;
  md += `ステージ定義の \`rec\`(推奨機体)と、3方策平均クリア率トップの機体を照合。${designMatches}/${STAGE_KEYS.length}ステージが一致。\n\n`;
  md += `| ステージ | 宣言(rec) | 計測上の最良 | 一致 |\n|---|---|---|---|\n`;
  for (const row of designMatchRows) {
    md += `| ${row.sk} ${row.name} | ${row.rec || '(なし)'} | ${row.best.join('/')} | ${row.match ? '○' : '×'} |\n`;
  }
  md += '\n';

  md += `### 詰み疑い（方策1〈安全優先〉でクリア率0%のステージ×機体）\n\n`;
  if (!stuckRows.length) {
    md += '該当なし。\n\n';
  } else {
    md += `${stuckRows.length}件:\n\n`;
    for (const row of stuckRows) md += `- ${row.sk} ${row.stageName} / ${row.name}\n`;
    md += '\n';
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md);
  console.log('');
  console.log(`Markdownレポートを書き出し: ${path.relative(path.join(__dirname,'..'), outPath)}`);
  process.exit(0);
}

// ===== 通常モード（単一機体/ステージの簡易実行。--policy=all で3方策比較、--all-vehで全機体比較） =====
console.log('=== hippo-rocket 自動プレイテスト（Phase 2: 3方策対応） ===');
console.log('※このツールはstub環境の相対差を見るもの。絶対値（クリア率そのもの等）は実ブラウザと一致しない前提で、機体間・方策間の"差"だけを判断材料にすること（要件§8）。');
console.log('');

const vehName = G.VEHICLES[0].name;

if (policyArg === 'all') {
  console.log(`--- 機体=${vehName}（既定/index0） ステージ=${stageKey} N=${N}（3方策比較） ---`);
  for (const p of [1,2,3]) {
    const r = runN(0, stageKey, N, p);
    console.log(`方策${p}〈${POLICY_NAMES[p]}〉: クリア率 ${(r.clearRate*100).toFixed(1)}%  平均到達高度 ${r.avgAlt.toFixed(1)}m  平均被弾 ${r.avgHits.toFixed(2)}回${r.timeouts?`  (timeout:${r.timeouts})`:''}`);
  }
} else {
  const policy = policyArg ? parseInt(policyArg, 10) : 1;
  console.log(`--- 機体=${vehName}（既定/index0） ステージ=${stageKey} N=${N} 方策${policy}〈${POLICY_NAMES[policy]}〉 ---`);
  const main = runN(0, stageKey, N, policy);
  console.log(`試行数: ${main.n}`);
  console.log(`クリア率: ${(main.clearRate*100).toFixed(1)}% (${main.clears}/${main.n})`);
  console.log(`平均到達高度: ${main.avgAlt.toFixed(1)} m`);
  console.log(`平均被弾数: ${main.avgHits.toFixed(2)} 回`);
  if (main.timeouts) console.log(`(タイムアウト扱い: ${main.timeouts}件 ※${MAX_STEPS}フレーム=3分相当で頂上未到達・生存)`);

  if (allVeh) {
    console.log('');
    console.log(`--- 全機体 × ステージ${stageKey}（方策${policy}〈${POLICY_NAMES[policy]}〉のまま） ---`);
    for (let vi = 0; vi < G.VEHICLES.length; vi++) {
      if (G.VEH_META[vi] && G.VEH_META[vi].retired) continue; // こつぶ=廃止枠はスキップ
      const r = runN(vi, stageKey, N, policy);
      const name = G.VEHICLES[vi].name;
      console.log(`${name.padEnd(6,'　')}: クリア率 ${(r.clearRate*100).toFixed(1)}%  平均到達高度 ${r.avgAlt.toFixed(1)}m  平均被弾 ${r.avgHits.toFixed(2)}回${r.timeouts?`  (timeout:${r.timeouts})`:''}`);
    }
  }
}
