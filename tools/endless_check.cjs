// エンドレスモードの機械検証（手プレイ前）：ブラウザstubでindex.htmlを実行し、endless=trueで長距離登坂をシミュレート。
//  検査: ①長時間(=高高度)まで例外が出ない ②beatチャンクが無限に供給され続ける ③頂上到達クリアが発火しない(=無限)
//        ④生成フロンティア(stageTop)が常にプレイヤーの上 ⑤難度ランプ(高高度ほど硬いbeatが増える) ⑥各高度で必ず通れる横隙間が残る
//  土台は tools/validate.cjs と同じ「ブラウザstub＋New Functionでindex.html内蔵scriptを実行」方式。
//  使い方: node tools/endless_check.cjs
const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const ctxProxy = new Proxy({}, { get: (t, k) => {
  if (k === 'canvas') return { width:432, height:768 };
  if (k === 'createLinearGradient' || k === 'createRadialGradient')
    return () => ({ addColorStop(){} });
  if (k === 'measureText') return () => ({ width: 10 });
  return () => {};
}});
const fakeCanvas = { getContext: () => ctxProxy, width:432, height:768, style:{},
  getBoundingClientRect: () => ({ left:0, top:0, width:432, height:768 }) };
function elStub(){ return { classList:{toggle(){},add(){},remove(){},contains(){return false;}}, addEventListener(){}, dataset:{}, style:{}, blur(){} }; }
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
sandbox.window = sandbox;

// 内蔵scriptを実行後、同スコープでエンドレスをドライブ（index.htmlにテスト専用コードを足さずに検証する）。
const driver = code + `
;endless=true; stageKey='A'; reset();
  let maxBeats=0, threw=null, samples=[], clearedEver=false;
  try{
    for(let step=0; step<4000; step++){        // 8px/step × 4000 ≈ 32000px 登坂(高高度まで)
      hippoY += 8; started=true;
      spawnAhead();
      if(cleared) clearedEver=true;
      if(stage().beats.length>maxBeats) maxBeats=stage().beats.length;
      if(step%500===0){
        const wy=hippoY+300, near=birds.filter(b=>Math.abs((b.cy!=null?b.cy:b.y)-wy)<420)
          .map(b=>({x:b.x,cy:(b.cy!=null?b.cy:b.y),r:b.r,box:b.box,hw:b.hw,hh:b.hh}));
        samples.push({ m:Math.round((hippoY-START_Y)/PXPM), beats:stage().beats.length,
          top:Math.round(stageTop), aheadPx:Math.round(stageTop-hippoY), enemies:birds.length, wy, near });
      }
    }
  }catch(e){ threw = (e&&e.message||String(e))+'\\n'+((e&&e.stack)||''); }
  // 難度ランプ：生成済みチャンクを高度バンド別に集計
  let cum=START_Y; const bands={};
  for(const b of endlessBeats){ const m=(cum-START_Y)/PXPM;
    const band = m<250?'0-250':(m<600?'250-600':(m<1100?'600-1100':'1100+'));
    (bands[band]=bands[band]||{})[b.type]=((bands[band]||{})[b.type]||0)+1; cum+=(b.len||1); }
  return { maxBeats, threw, samples, clearedEver, bands,
           finalM:Math.round((hippoY-START_Y)/PXPM), START_Y, PXPM, W, HIPPO_R, VEHICLES };`;

const argNames = Object.keys(sandbox);
const G = new Function(...argNames, driver)(...argNames.map(k=>sandbox[k]));

// validate.cjs と同じ通過可能性ロジック（ある世界Yで各機体が通れる横隙間があるか）
const { W, HIPPO_R, VEHICLES } = G;
function passableAt(birds, worldY){
  return VEHICLES.map(V => {
    const hr = HIPPO_R * V.size, hw = V.hitW || 1;
    const blocked = [];
    for (const b of birds){
      const by = b.cy != null ? b.cy : b.y;
      const dvy = Math.abs(by - worldY);
      if (b.box){ if (dvy < b.hh + hr*0.45){ const half = b.hw + hr*0.5; blocked.push([b.x-half, b.x+half]); } }
      else { const ry = b.r*0.78 + hr*0.66; if (dvy < ry){ const half=(Math.sqrt(Math.max(0,ry*ry-dvy*dvy)))*hw; blocked.push([b.x-half,b.x+half]); } }
    }
    const lo=hr*0.7, hi=W-hr*0.7; blocked.sort((a,b)=>a[0]-b[0]);
    let widest=0, cur=lo;
    for (const [a,c] of blocked){ if(a>cur){ const gap=Math.min(a,hi)-cur; if(gap>widest)widest=gap; } cur=Math.max(cur,c); if(cur>=hi)break; }
    if (cur<hi){ const gap=hi-cur; if(gap>widest)widest=gap; }
    return { veh:V.name, ok: widest>=hr*1.4, widest:Math.round(widest), need:Math.round(hr*1.4) };
  });
}

let fail=0;
const say=(ok,msg)=>{ console.log((ok?'  ✓ ':'  ✗ ')+msg); if(!ok) fail++; };

console.log('=== エンドレス機械検証（32000px 登坂シミュレート）===');
say(G.threw===null, G.threw===null ? '登坂中に例外なし' : ('例外が発生: '+G.threw));
say(G.clearedEver===false, G.clearedEver? 'クリアが発火した（頂上が存在してしまっている）' : '頂上到達クリアは発火せず（無限を維持）');
say(G.maxBeats>=100 && G.samples[G.samples.length-1].beats > G.samples[0].beats*3, 'beatチャンクが無限供給され増え続けた（'+G.samples[0].beats+'→'+G.maxBeats+' 個）');

console.log('\n--- 高度サンプル（m / 生成beat数 / 頂上まで残px / 敵総数）---');
let frontierOK=true, passOK=true;
for(const s of G.samples){
  if(s.aheadPx<=200) frontierOK=false;
  const fails=passableAt(s.near, s.wy).filter(r=>!r.ok);
  if(fails.length) passOK=false;
  console.log('  '+String(s.m).padStart(5)+' m | beats '+String(s.beats).padStart(4)+' | 前方 '+String(s.aheadPx).padStart(5)+'px | 敵 '+String(s.enemies).padStart(4)
    +(fails.length? '  ✗ 通れない機体: '+fails.map(f=>f.veh+`(${f.widest}<${f.need})`).join(',') : '  ✓ 通れる隙間あり'));
}
say(frontierOK, frontierOK? '生成フロンティアが常にプレイヤーの十分上（前方200px超）' : 'フロンティアがプレイヤーに追いつかれた');
say(passOK, passOK? '全サンプル高度で必ず通れる横隙間が残る' : '通れない壁が生成された高度がある');

console.log('\n--- 難度ランプ（高度バンド別のchunk種別内訳）---');
const HARD=['elite','over','dense'];   // 真の"押し罰/居座り罰"ゲート。swoopは単発(n:1)が導入teachで低高度にも出るので密度指標に含めない
for(const band of ['0-250','250-600','600-1100','1100+']){
  const b=G.bands[band]||{};
  console.log('  '+band.padEnd(9)+'m : '+Object.entries(b).map(([k,v])=>k+'×'+v).join('  '));
}
const low=G.bands['0-250']||{}, high=G.bands['1100+']||{};
const lowHard=HARD.reduce((s,k)=>s+(low[k]||0),0), highHard=HARD.reduce((s,k)=>s+(high[k]||0),0);
const lowHasCalm=(low['calm']||0)>0, highHasCalm=(high['calm']||0)>0;
say(lowHard===0, '低高度(0-250m)に押し罰ゲート(elite/over/dense)が無い＝開幕が易しい');
say(highHard>0, '高高度(1100m+)に押し罰ゲートが出る＝難度が上がる（硬 '+highHard+'個）');
say(lowHasCalm && !highHasCalm, '休符(calm)は低高度のみ・高高度では消える＝密度が上がる');

console.log('\n'+(fail===0 ? '✅ エンドレス検証 全項目パス' : '❌ '+fail+' 項目が不合格'));
process.exit(fail===0?0:1);
