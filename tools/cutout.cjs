// クロマキー緑→透過＋bbox切り出し。sharpはhippo_fallのを流用。
// 使い方: node tools/cutout.cjs
const sharp = require('c:/Users/mr_ba/Documents/hippo_fall/node_modules/sharp');
const path = require('path');
const fs = require('fs');

const SRC = path.join(__dirname, '..', 'assets', 'states');
const OUT = path.join(__dirname, '..', 'assets', 'sprites');
fs.mkdirSync(OUT, { recursive: true });

// ground は全面塗りなので切り出さない（緑の草が消えるため）。raw を直接 sprites へ置く。
const files = ['idle', 'boost', 'fall', 'hit', 'bird_small', 'bird_large',
  'pad', 'hills', 'cloud_big', 'cloud_small', 'power', 'star', 'hawk', 'storm',
  'pelican', 'float',
  'veh_tsubasa', 'veh_fuusen', 'veh_kotsubu'];

(async () => {
  for (const name of files) {
    const inPath = path.join(SRC, name + '.png');
    const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels } = info;
    let minX = W, minY = H, maxX = 0, maxY = 0, kept = 0;

    for (let i = 0; i < W * H; i++) {
      const o = i * channels;
      const r = data[o], g = data[o + 1], b = data[o + 2];
      const key = g - Math.max(r, b);          // 緑の強さ
      let a = data[o + 3];
      if (key > 60) {                          // 明確な背景
        a = 0;
      } else if (key > 18) {                   // フチ(アンチエイリアス)
        a = Math.round(a * (60 - key) / 42);
        // デスピル(緑かぶり除去)
        const m = Math.max(r, b);
        data[o + 1] = Math.min(g, m + 8);
      }
      data[o + 3] = a;
      if (a > 16) {
        const x = i % W, y = (i / W) | 0;
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        kept++;
      }
    }
    const cw = maxX - minX + 1, ch = maxY - minY + 1;
    await sharp(data, { raw: { width: W, height: H, channels } })
      .extract({ left: minX, top: minY, width: cw, height: ch })
      .png()
      .toFile(path.join(OUT, name + '.png'));
    console.log(`${name}: crop ${cw}x${ch}  (kept ${kept}px)`);
  }
  console.log('done ->', OUT);
})().catch(e => { console.error(e); process.exit(1); });
