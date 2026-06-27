// 緑(#00B140)クロマキー→透過＋bbox切り出し＋デスピル。汎用版（cutout.cjsはファイル固定なのでこちら）。
// 使い方: node tools/dechroma_green.cjs <in.png> <out.png>
const sharp = require('c:/Users/mr_ba/Documents/hippo_fall/node_modules/sharp');
const inPath = process.argv[2], outPath = process.argv[3];
if (!inPath || !outPath) { console.error('usage: node dechroma_green.cjs in.png out.png'); process.exit(1); }
(async () => {
  const { data, info } = await sharp(inPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;
  let minX = W, minY = H, maxX = 0, maxY = 0;
  for (let i = 0; i < W * H; i++) {
    const o = i * channels;
    const r = data[o], g = data[o + 1], b = data[o + 2];
    const key = g - Math.max(r, b);              // 緑の強さ
    let a = data[o + 3];
    if (key > 60) a = 0;                          // 明確な背景
    else if (key > 18) { a = Math.round(a * (60 - key) / 42); data[o + 1] = Math.min(g, Math.max(r, b) + 8); } // フチ＋デスピル
    data[o + 3] = a;
    if (a > 16) { const x = i % W, y = (i / W) | 0; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  }
  const cw = Math.max(1, maxX - minX + 1), ch = Math.max(1, maxY - minY + 1);
  await sharp(Buffer.from(data), { raw: { width: W, height: H, channels } })
    .extract({ left: minX, top: minY, width: cw, height: ch }).png().toFile(outPath);
  console.log(`done: ${W}x${H} -> crop ${cw}x${ch} -> ${outPath}`);
})();
