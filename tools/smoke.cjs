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
function smoke(label, setup){
  setup();
  if(scene==='PLAY') draw(); else drawMenu();
  if(!Array.isArray(hotspots)) throw new Error(label+': hotspots missing');
  console.log('ok '+label+' hotspots='+hotspots.length);
}
unlockAll();
save.best={A:400,B:180,C:260,D:90};
save.stars={A:3,B:1,C:2};
save.bestTime={A:72,C:119};
smoke('TITLE', () => { scene='TITLE'; });
smoke('SELECT', () => { scene='SELECT'; stageKey='A'; });
smoke('SHOP', () => { scene='SHOP'; });
smoke('SETTINGS', () => { scene='SETTINGS'; resetConfirm=false; });
smoke('PLAY_READY', () => { scene='PLAY'; reset(); started=false; });
smoke('PLAY_PAUSED', () => { scene='PLAY'; reset(); started=true; paused=true; });
smoke('PLAY_DEAD', () => { scene='PLAY'; reset(); started=true; die('hit'); lastGain=4; });
smoke('PLAY_CLEAR', () => { scene='PLAY'; reset(); started=true; cleared=true; lastGain=30; lastPar=88; save.stars[stageKey]=3; });
`;

const argNames = Object.keys(sandbox);
const argVals = argNames.map(k => sandbox[k]);
const factory = new Function(...argNames, code + tail);
factory(...argVals);
