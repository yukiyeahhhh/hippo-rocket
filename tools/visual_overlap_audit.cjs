// Visual overlap audit for hippo-rocket.
// It checks the same 432x768 play viewport the player sees and writes an HTML
// report with SVG slices when enemies/coins visually overlap or look too close.
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
function elStub(){
  return { classList: { toggle(){}, add(){}, remove(){} }, addEventListener(){}, dataset: {}, style: {}, blur(){} };
}
const documentStub = {
  getElementById: () => fakeCanvas,
  querySelectorAll: () => { const a = []; a.forEach = Array.prototype.forEach.bind(a); return a; },
  querySelector: () => elStub(),
};
class ImageStub {
  constructor(){ this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; }
  set src(v){}
  get src(){ return ''; }
}

const sandbox = {
  document: documentStub,
  Image: ImageStub,
  window: {},
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  addEventListener: () => {},
  location: { search: '' },
  Math,
  Date,
  console,
  URLSearchParams,
};
sandbox.window = sandbox;

const argNames = Object.keys(sandbox);
const argVals = argNames.map(k => sandbox[k]);
const exported = code + `
;return {
  reset, spawnAhead,
  get birds(){ return birds; },
  get coins(){ return coins; },
  setStage(k){ stageKey = k; },
  get stageTop(){ return stageTop; },
  START_Y, PXPM, STAGES, W, H, HIPPO_SCR_Y,
  PULSAR_R_MAX, SHUTTER_BASE, SHUTTER_TH,
};`;
const G = new Function(...argNames, exported)(...argVals);

const HARD_ENEMY_COIN_PAD = 2;
const WARN_ENEMY_COIN_PAD = 16;
const HARD_ENEMY_ENEMY_PAD = 0;
const WARN_ENEMY_ENEMY_PAD = 10;
const HARD_COIN_COIN_PAD = 0;
const WARN_COIN_COIN_PAD = 8;
const VIEW_STEP = 160;
const MAX_SLICES_PER_STAGE = 120;
const MAX_DETAILS = 80;

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function round(n){ return Math.round(n); }
function screenY(worldY, cameraY){ return G.HIPPO_SCR_Y - (worldY - cameraY); }

function enemyVisualBoxes(b){
  const y = b.y;
  if (b.move === 'shutter') {
    const gap = b.gapHalf || G.SHUTTER_BASE;
    const hh = G.SHUTTER_TH + 16;
    return [
      { kind: 'enemy', x: (b.x - gap) / 2, y, hw: Math.max(0, (b.x - gap) / 2), hh, ref: b },
      { kind: 'enemy', x: (G.W + b.x + gap) / 2, y, hw: Math.max(0, (G.W - b.x - gap) / 2), hh, ref: b },
    ];
  }
  if (b.cap) return [{ kind: 'enemy', x: b.x, y, hw: (b.hw || 46) * 1.75, hh: 34, ref: b }];
  if (b.move === 'float') return [{ kind: 'enemy', x: b.x, y, hw: (b.r || 23) * 1.05, hh: (b.r || 23) * 1.85, ref: b }];
  if (b.move === 'pulsar') return [{ kind: 'enemy', x: b.x, y, hw: G.PULSAR_R_MAX * 1.22, hh: G.PULSAR_R_MAX * 1.22, ref: b }];
  if (b.sprite === 'storm') return [{ kind: 'enemy', x: b.x, y, hw: 72, hh: 72, ref: b }];
  if (b.sprite === 'hawk' || b.move === 'diver') return [{ kind: 'enemy', x: b.x, y, hw: 66, hh: 70, ref: b }];
  if (b.type === 'large') return [{ kind: 'enemy', x: b.x, y, hw: 66, hh: 54, ref: b }];
  return [{ kind: 'enemy', x: b.x, y, hw: 40, hh: 30, ref: b }];
}
function boxCircleGap(box, c){
  const dx = Math.max(Math.abs(c.x - box.x) - box.hw, 0);
  const dy = Math.max(Math.abs(c.y - box.y) - box.hh, 0);
  return Math.hypot(dx, dy) - c.r;
}
function boxBoxGap(a, b){
  const dx = Math.abs(a.x - b.x) - (a.hw + b.hw);
  const dy = Math.abs(a.y - b.y) - (a.hh + b.hh);
  if (dx <= 0 && dy <= 0) return Math.max(dx, dy);
  return Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
}
function circleCircleGap(a, b){
  return Math.hypot(a.x - b.x, a.y - b.y) - (a.r + b.r);
}
function typeOfEnemy(b){
  return b.move || b.sprite || b.type || 'enemy';
}
function severity(gap, hardPad, warnPad){
  if (gap < hardPad) return 'hard';
  if (gap < warnPad) return 'warn';
  return null;
}
function inViewY(y, cameraY, pad = 110){
  const sy = screenY(y, cameraY);
  return sy >= -pad && sy <= G.H + pad;
}

function buildStage(stageKey){
  G.setStage(stageKey);
  G.reset();
  G.spawnAhead(G.stageTop + 200);
  const enemies = G.birds.map((b, i) => ({ ...b, i, boxes: enemyVisualBoxes(b).map(x => ({ ...x, enemyIndex: i })) }));
  const coins = G.coins.map((c, i) => ({ ...c, i, r: c.r || 13 }));
  return { enemies, coins, stageTop: G.stageTop };
}

function auditStage(stageKey){
  const state = buildStage(stageKey);
  const candidates = new Map();
  let worstGap = Infinity;
  let sliceCount = 0;
  function addCandidate(key, detail){
    const prev = candidates.get(key);
    if (!prev || detail.gap < prev.gap) candidates.set(key, detail);
  }
  for (let cameraY = G.START_Y; cameraY <= state.stageTop; cameraY += VIEW_STEP) {
    if (++sliceCount > MAX_SLICES_PER_STAGE) break;
    const visibleEnemies = state.enemies.filter(b => b.boxes.some(box => inViewY(box.y, cameraY, Math.max(box.hh + 80, 110))));
    const visibleCoins = state.coins.filter(c => inViewY(c.y, cameraY, c.r + 80));
    for (const c of visibleCoins) {
      for (const b of visibleEnemies) {
        for (const box of b.boxes) {
          const gap = boxCircleGap(box, c);
          worstGap = Math.min(worstGap, gap);
          const sev = severity(gap, HARD_ENEMY_COIN_PAD, WARN_ENEMY_COIN_PAD);
          if (sev) {
            addCandidate(`ec:${c.i}:${b.i}:${box.enemyIndex}:${Math.round(box.x)}:${Math.round(box.y)}`,
              { stageKey, cameraY, type: 'enemy-coin', severity: sev, gap, coin: c, enemy: b, box });
          }
        }
      }
    }
    for (let i = 0; i < visibleEnemies.length; i++) {
      for (let j = i + 1; j < visibleEnemies.length; j++) {
        const a = visibleEnemies[i];
        const b = visibleEnemies[j];
        for (const abox of a.boxes) for (const bbox of b.boxes) {
          const gap = boxBoxGap(abox, bbox);
          worstGap = Math.min(worstGap, gap);
          const sev = severity(gap, HARD_ENEMY_ENEMY_PAD, WARN_ENEMY_ENEMY_PAD);
          if (sev) {
            addCandidate(`ee:${a.i}:${b.i}:${Math.round(abox.x)}:${Math.round(abox.y)}:${Math.round(bbox.x)}:${Math.round(bbox.y)}`,
              { stageKey, cameraY, type: 'enemy-enemy', severity: sev, gap, enemy: a, otherEnemy: b, box: abox, otherBox: bbox });
          }
        }
      }
    }
    for (let i = 0; i < visibleCoins.length; i++) {
      for (let j = i + 1; j < visibleCoins.length; j++) {
        const a = visibleCoins[i];
        const b = visibleCoins[j];
        const gap = circleCircleGap(a, b);
        worstGap = Math.min(worstGap, gap);
        const sev = severity(gap, HARD_COIN_COIN_PAD, WARN_COIN_COIN_PAD);
        if (sev) {
          addCandidate(`cc:${a.i}:${b.i}`, { stageKey, cameraY, type: 'coin-coin', severity: sev, gap, coin: a, otherCoin: b });
        }
      }
    }
  }
  const details = Array.from(candidates.values())
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'hard' ? -1 : 1) || a.gap - b.gap);
  const hard = details.filter(d => d.severity === 'hard').length;
  const warn = details.filter(d => d.severity === 'warn').length;
  const byType = details.reduce((acc, d) => {
    const k = `${d.severity}:${d.type}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  return { stageKey, hard, warn, worstGap, details, ...state };
}

function rectSvg(box, cameraY, cls){
  const x = box.x - box.hw;
  const y = screenY(box.y, cameraY) - box.hh;
  return `<rect class="${cls}" x="${round(x)}" y="${round(y)}" width="${round(box.hw * 2)}" height="${round(box.hh * 2)}"/>`;
}
function coinSvg(c, cameraY, cls){
  return `<circle class="${cls}" cx="${round(c.x)}" cy="${round(screenY(c.y, cameraY))}" r="${round(c.r)}"/>`;
}
function sliceSvg(stage, detail){
  const cameraY = detail.cameraY;
  const minY = cameraY - 60;
  const maxY = cameraY + G.H + 60;
  const enemyShapes = [];
  for (const b of stage.enemies) for (const box of b.boxes) {
    if (box.y >= minY && box.y <= maxY) enemyShapes.push(rectSvg(box, cameraY, 'enemy'));
  }
  const coinShapes = stage.coins
    .filter(c => c.y >= minY && c.y <= maxY)
    .map(c => coinSvg(c, cameraY, 'coin'));
  const focus = [];
  if (detail.box) focus.push(rectSvg(detail.box, cameraY, 'focus'));
  if (detail.otherBox) focus.push(rectSvg(detail.otherBox, cameraY, 'focus'));
  if (detail.coin) focus.push(coinSvg(detail.coin, cameraY, 'focusCoin'));
  if (detail.otherCoin) focus.push(coinSvg(detail.otherCoin, cameraY, 'focusCoin'));
  return `<svg viewBox="0 0 ${G.W} ${G.H}" width="216" height="384" role="img" aria-label="stage ${stage.stageKey} camera ${round(cameraY)}">
    <rect width="${G.W}" height="${G.H}" fill="#d9edff"/>
    <line x1="0" x2="${G.W}" y1="${G.HIPPO_SCR_Y}" y2="${G.HIPPO_SCR_Y}" stroke="#4b7" stroke-width="2" stroke-dasharray="8 8"/>
    ${enemyShapes.join('\n')}
    ${coinShapes.join('\n')}
    ${focus.join('\n')}
  </svg>`;
}

const stages = Object.keys(G.STAGES).map(auditStage);
const totalHard = stages.reduce((n, s) => n + s.hard, 0);
const totalWarn = stages.reduce((n, s) => n + s.warn, 0);
const allDetails = stages.flatMap(s => s.details.map(d => ({ ...d, stage: s })));

console.log('visual overlap audit');
for (const s of stages) {
  const worst = Number.isFinite(s.worstGap) ? `${Math.round(s.worstGap)}px` : 'n/a';
  const byType = s.details.reduce((acc, d) => {
    const k = `${d.severity}:${d.type}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
  }, {});
  const typeText = Object.keys(byType).sort().map(k => `${k}=${byType[k]}`).join(' ');
  console.log(`  Stage ${s.stageKey}: hard=${s.hard} warn=${s.warn} worstGap=${worst} enemies=${s.enemies.length} coins=${s.coins.length}${typeText ? ` (${typeText})` : ''}`);
}
console.log(`  total: hard=${totalHard} warn=${totalWarn}`);

const reportDir = path.join(root, '.shots');
fs.mkdirSync(reportDir, { recursive: true });
const reportPath = path.join(reportDir, 'visual-overlap-audit.html');
const detailRows = allDetails.slice(0, MAX_DETAILS).map((d, idx) => {
  const label = d.type === 'enemy-coin'
    ? `coin ${d.coin.i} / enemy ${d.enemy.i} (${typeOfEnemy(d.enemy)})`
    : d.type === 'enemy-enemy'
      ? `enemy ${d.enemy.i} (${typeOfEnemy(d.enemy)}) / enemy ${d.otherEnemy.i} (${typeOfEnemy(d.otherEnemy)})`
      : `coin ${d.coin.i} / coin ${d.otherCoin.i}`;
  return `<section class="case ${d.severity}">
    <div>${sliceSvg(d.stage, d)}</div>
    <div>
      <h2>#${idx + 1} ${escapeHtml(d.stageKey)} ${escapeHtml(d.type)} <span>${escapeHtml(d.severity)}</span></h2>
      <p>alt ${Math.round((d.cameraY - G.START_Y) / G.PXPM)}m / gap ${Math.round(d.gap)}px</p>
      <p>${escapeHtml(label)}</p>
    </div>
  </section>`;
}).join('\n');

fs.writeFileSync(reportPath, `<!doctype html>
<html lang="ja">
<meta charset="utf-8">
<title>hippo-rocket visual overlap audit</title>
<style>
  body{font-family:system-ui,sans-serif;margin:24px;background:#f6f8fb;color:#202636}
  .summary{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0 24px}
  .pill{padding:8px 12px;border-radius:8px;background:white;border:1px solid #d8deea}
  .hard .pill,.pill.hard{border-color:#e5484d;color:#a0141a}
  .warn .pill,.pill.warn{border-color:#f2a93b;color:#8a5200}
  table{border-collapse:collapse;background:white;margin-bottom:24px}
  th,td{padding:8px 10px;border:1px solid #d8deea;text-align:right}
  th:first-child,td:first-child{text-align:left}
  .case{display:flex;gap:18px;align-items:flex-start;background:white;border:1px solid #d8deea;border-left:6px solid #f2a93b;margin:14px 0;padding:12px}
  .case.hard{border-left-color:#e5484d}
  h1{font-size:22px;margin:0}
  h2{font-size:16px;margin:2px 0 8px}
  h2 span{font-size:12px;text-transform:uppercase}
  p{margin:4px 0}
  .enemy{fill:rgba(220,70,85,.22);stroke:rgba(160,20,35,.55);stroke-width:2}
  .coin{fill:rgba(255,205,54,.58);stroke:rgba(150,90,0,.45);stroke-width:2}
  .focus{fill:rgba(230,20,40,.20);stroke:#e00024;stroke-width:5}
  .focusCoin{fill:rgba(255,230,64,.75);stroke:#e00024;stroke-width:5}
</style>
<body>
<h1>hippo-rocket visual overlap audit</h1>
<div class="summary">
  <div class="pill hard">hard ${totalHard}</div>
  <div class="pill warn">warn ${totalWarn}</div>
  <div class="pill">viewport ${G.W}x${G.H}</div>
  <div class="pill">step ${VIEW_STEP}px</div>
</div>
<table>
<tr><th>stage</th><th>hard</th><th>warn</th><th>worst gap</th><th>enemies</th><th>coins</th></tr>
${stages.map(s => `<tr><td>${escapeHtml(s.stageKey)}</td><td>${s.hard}</td><td>${s.warn}</td><td>${Number.isFinite(s.worstGap) ? Math.round(s.worstGap) : 'n/a'}px</td><td>${s.enemies.length}</td><td>${s.coins.length}</td></tr>`).join('\n')}
</table>
${detailRows || '<p>No visual overlap candidates.</p>'}
</body>
</html>
`);
console.log(`  report: ${reportPath}`);

if (totalHard > 0) process.exitCode = 1;
