// マゼンタ(#FF00FF)クロマキー→透過。緑(草/木)を残すため緑キーでなくマゼンタキーで抜く。
// 使い方: node tools/dechroma_magenta.cjs <in.png> <out.png>
const sharp = require('c:/Users/mr_ba/Documents/hippo_fall/node_modules/sharp');
const inPath = process.argv[2], outPath = process.argv[3];
if (!inPath || !outPath) { console.error('usage: node dechroma_magenta.cjs in.png out.png'); process.exit(1); }

(async () => {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;
  let cleared = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const key = Math.min(r, b) - g;            // マゼンタの強さ(R高B高G低)
    let a = data[o + 3];
    if (key > 80) { a = 0; cleared++; }        // 明確な背景
    else if (key > 28) {                       // フチ(アンチエイリアス)
      a = Math.round(a * (80 - key) / 52);
      // デスピル(マゼンタかぶり除去)：r,bをgへ寄せる
      data[o]     = Math.min(r, g + 12);
      data[o + 2] = Math.min(b, g + 12);
    }
    data[o + 3] = a;
  }
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels } })
    .png().toFile(outPath);
  console.log(`done: ${W}x${H}, cleared ${cleared}px (${Math.round(cleared/(W*H)*100)}%) -> ${outPath}`);
})();
