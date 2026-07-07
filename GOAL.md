# GOAL — エンドレスに「高度で地域が変わる登坂演出」＋難度ランプ＋飽きない敵

依頼(2026-07-07・yukiya)：エンドレスで地上→空中→大気圏(雲海)→宇宙(星雲)のように**背景と敵が高度で変化**して「登ってる感」を出す。
確定仕様：①**4段階**（鳥→雲海→嵐→星雲）②境目演出は**こだわり**＝背景クロスフェード＋テロップ＋BGM切替＋**空の色を高度で連続補間**③**徐々に難度UP**＋**飽きない敵の出方**。既存アセット全流用・新規アート無し。

## 地域バンド（生成と描画の唯一の真実）
- birds 0–600m ／ mist 600–1400m ／ storm 1400–2400m ／ stars 2400m+（宇宙・無限・難度は上げ続ける）
- sky色アンカー(連続補間)：0=鳥[[135,180,230],[175,205,235]] / 600=雲海[[150,165,185],[200,210,222]] / 1400=嵐[[80,95,130],[120,135,165]] / 2400=星脈[[55,62,118],[122,116,170]] / 3600=宇宙[[10,12,30],[26,24,52]]
- 背景画像：skyImgs[birds/mist/storm/stars]（全4枚あり）。境界±200mで次地域へαクロスフェード。
- BGM：bgmStageKey を endless対応（region→stageA/B/C/D）。地域が上がったら updateBgm(true)＋テロップ。
- 敵語彙：全typeはspawnAheadが地域非依存で処理可。地域の顔＝どのtypeを選ぶか＋regionBirdSprite(地域別鳥絵)＋背景。
  - birds: swoop/swarm/dive/over/elite/step/updraft/dense … mist: drift(雲クラゲ)/float(泡)/downdraft/columns/cloud/over … storm: wind±/obstacle(雷雲)/streak(debris)/pulsar/gust … stars: pulsar/streak(meteor/shootingstar)/shutter/updraft

## Definition of Done（検証可能）★全項目クリア（2026-07-07・Opus）
- [x] エンドレスで高度に応じ **birds→mist→storm→stars** と地域が移り変わる。→ endless_check：生成順 birds→mist→storm→stars・4地域到達・地域固有敵(drift/float・wind/obstacle・pulsar/streak)確認
- [x] 空の色が**高度で連続補間**＋背景画像が境界で**クロスフェード**。→ endlessSkyAt(anchors補間)・drawSky(境界±220mでαフェード)。スクショ birds青→mist淡→storm紫→space藍で連続
- [x] 地域が上がる瞬間に**テロップ**＋**BGM切替**。→ 「成層圏／嵐の層 へ」バナー確認・updateBgm(region→stageA/B/C/D)・前進のみヒステリシス
- [x] 難度が**徐々に上がる**。→ globalDiff(m/2600)底上げ＋localProgで地域内ランプ＋breatherEveryが高高度で増(休符減)。endless_check calm 5→1
- [x] **飽きない**：同type連続回避／signature周期挿入／各高度で通れる隙間。→ endless_check 全サンプル通過可（timing系streak/shutter/pulsarは静的壁判定から除外）
- [x] 検証：validate回帰PASS／smoke PASS／endless_check 全項目PASS（例外0・無限供給13→202・地域高度順・通過可・コイン0）
- [x] 視覚QA：birds/mist/storm/space＋境界バナー＋結果パネルをスクショ目視。空の連続変化・bg切替・崩れ/フォールバック/絵文字なし

## マイルストーン
1. [ ] 地域モデル＋**region対応エンドレス生成器**（語彙/難度/no-repeat/signature/breather）＋regionBirdSprite endless対応。endless_checkで地域出現順・難度・通過可を検証。
2. [ ] 描画：**空の連続補間**＋背景クロスフェード＋mist雲＋curRegionKey経由化。スクショ多高度で確認。
3. [ ] BGM地域切替＋境界テロップ。スクショ（テロップ）＋コードで確認。
4. [ ] 全検証（validate/smoke/endless_check拡張）＋視覚QA＋コミット（pushしない）。

## 停止条件（提案で止める）
- 新規アート採用/生成・公開(push)・課金・破壊的操作。テロップ文言/トンマナの最終採用はyukiya判断（β実装→明日判断でOK）。

## 現在地／次の一手
- 現在地：**★完了（2026-07-07）**。M1〜M4全部済み・全検証グリーン・視覚QA4地域＋境界通過。未push。
- 明日試す：エンドレスβ→登ると 鳥→雲海→嵐→宇宙 と背景/敵/BGMが変わりバナーが出る。難度は上へ行くほど上がる。
- 割り切り／次段候補：BGM切替はupdateBgmの即切替（クロスフェードにするなら別途フェード実装）。テロップ文言/地域境界高度(600/1400/2400m)の調整は実機FB後。地域巡回はstars(宇宙)で頭打ち＝以降はstars内で難度だけ上げ続ける。
- ハマり所メモ：Editが**稀に無音で不適用**になる（今回draw内のsky大ブロックが1度消えmNow未定義でdraw全体がthrow→黒画面）。大ブロック編集後は grep で適用確認＋node で draw() を1回呼んで例外0を確認するのが安全。
