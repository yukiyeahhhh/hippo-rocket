// Minimal screen smoke test. It executes the inline game script in a stubbed
// browser environment and verifies the main screens draw without throwing.
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
function elStub(){ return { classList:{toggle(){},add(){},remove(){}}, addEventListener(){}, dataset:{}, style:{}, blur(){} }; }
const documentStub = {
  getElementById: () => fakeCanvas,
  querySelectorAll: () => { const a=[]; a.forEach=Array.prototype.forEach.bind(a); return a; },
  querySelector: () => elStub(),
};
class ImageStub { constructor(){ this.complete=false; this.naturalWidth=0; this.naturalHeight=0; } set src(v){} get src(){return '';} }

const saved = {};
const localStorageStub = {
  getItem: k => saved[k] || null,
  setItem: (k, v) => { saved[k] = String(v); },
  removeItem: k => { delete saved[k]; },
};
class AudioContextStub {
  constructor(){ this.currentTime = 0; this.destination = {}; }
  createOscillator(){ return { type:'sine', frequency:{ setValueAtTime(){}, linearRampToValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){}, start(){}, stop(){} }; }
  createGain(){ return { gain:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
}

const sandbox = {
  document: documentStub, Image: ImageStub,
  window: {}, performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  addEventListener: () => {}, location: { search: '' },
  localStorage: localStorageStub, AudioContext: AudioContextStub, webkitAudioContext: AudioContextStub,
  Math, Date, console, URLSearchParams,
};
sandbox.window = sandbox;

const tail = `
function smokeUnlockMigration(){
  const originalSave=save;
  save={unlocked:['A','B','C','D']};
  normalizeUnlockedStages();
  const initial=save.unlocked.join(',');
  if(initial!=='A,B,C,D') throw new Error('unlock migration expanded initial regions: '+initial);
  save={unlocked:['A','A4','B','C','D']};
  normalizeUnlockedStages();
  const filled=save.unlocked.join(',');
  if(filled!=='A,A4,B,C,D,A2,A3') throw new Error('unlock migration failed region fill: '+filled);
  save=originalSave;
  console.log('ok UNLOCK_MIGRATION');
}
function smokeSettingsUnlockAll(){
  const originalSave=save;
  save=defaultSave();
  debugUnlockAllFromSettings();
  const buyable=VEH_META.map((m,i)=>m && !m.retired ? i : -1).filter(i=>i>=0).join(',');
  if(save.owned.join(',')!==buyable) throw new Error('settings unlock owned mismatch: '+save.owned.join(','));
  if(save.unlocked.join(',')!==STAGE_ORDER.concat(Object.values(SECRET_OF)).join(',')) throw new Error('settings unlock stages mismatch');
  if(save.coins<9999) throw new Error('settings unlock coins too low: '+save.coins);
  for(const i of save.owned){ if(VEH_META[i].backdraft && save.bd[i]!==BD_MAX) throw new Error('settings unlock bd not max: '+i+'='+save.bd[i]); }
  save=originalSave;
  console.log('ok SETTINGS_UNLOCK_ALL');
}
function smoke(label, setup){
  setup();
  if(scene==='PLAY') draw(); else drawMenu();
  if(!Array.isArray(hotspots)) throw new Error(label+': hotspots missing');
  console.log('ok '+label+' hotspots='+hotspots.length);
}
smokeUnlockMigration();
smokeSettingsUnlockAll();
unlockAll();
save.best={A:400,B:180,C:260,D:90};
save.stars={A:3,B:1,C:2};
save.bestTime={A:72,C:119};
smoke('SPLASH', () => { scene='SPLASH'; });
smoke('TITLE', () => { scene='TITLE'; });
smoke('HELP', () => { scene='HELP'; });
smoke('GARAGE', () => { scene='GARAGE'; stageKey='A'; });
smoke('DESTINATION', () => { scene='DESTINATION'; stageKey='A'; });
smoke('SHOP', () => { scene='SHOP'; });
smoke('SETTINGS', () => { scene='SETTINGS'; resetConfirm=false; });
smoke('PLAY_READY', () => { scene='PLAY'; reset(); started=false; });
smoke('PLAY_PAUSED', () => { scene='PLAY'; reset(); started=true; paused=true; });
smoke('PLAY_DEAD', () => { scene='PLAY'; reset(); started=true; die('hit'); deathT=9; lastGain=5; lastBreakdown={collect:2,graze:2,comboBonus:1,mulBonus:0,clearBonus:0,noHitBonus:0,fastBonus:0}; });
smoke('PLAY_CLEAR', () => { scene='PLAY'; reset(); started=true; cleared=true; clearedT=9; lastGain=56; lastPar=88; save.stars[stageKey]=3; lastBreakdown={collect:8,graze:9,comboBonus:4,mulBonus:0,clearBonus:15,noHitBonus:8,fastBonus:12}; });
`;

const argNames = Object.keys(sandbox);
const argVals = argNames.map(k => sandbox[k]);
const factory = new Function(...argNames, code + tail);
factory(...argVals);
