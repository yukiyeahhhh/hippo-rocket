# AGENTS.md — hippo-rocket（Codex/AIエージェント共通の作業指示）

このリポジトリで作業するエージェント（特に Codex）への指示。**Claude から開発バトンを受け取ったら、まずここ→[HANDOFF.md](HANDOFF.md) を読む。**

## これは何
重いコビトカバがロケットで上を目指す**縦スクロール登山ゲーム**。**単一ファイル `index.html`**（HTML/CSS/JS全部入り、`<script>`内がゲーム本体）。
押す＝上昇／離す＝落下／←→・ドラッグ＝横移動。コア＝**迫る脅威を避け（斜めダイブ鳥/タカ）・かすめて得して（グレイズ）・登る**。

## ★読む順（引き継ぎの正本）
1. **[HANDOFF.md](HANDOFF.md)** … 直近の状態・**次にやること**・途中の半端・未コミット・決定事項。常にここが最新。
2. **[開発計画.md](開発計画.md)** … メタ含む全体ロードマップ（Phase 0土台→1経済ループ→2拡充→3演出）。
3. **[敵設計.md](敵設計.md) / [機体設計.md](機体設計.md)** … 敵・機体の設計哲学（4スキル/4軸・支配的戦略の排除）。
4. **[art-bible.md](art-bible.md) / [素材棚卸し.md](素材棚卸し.md)** … 絵柄ルール・素材状況。
5. 汎用の手法は別repoの共有ナレッジ `~/Documents/knowledge`（索引＝そこの `README.md`）。設計手順=「ゲームの中身を設計する順序」、検証=「ゲームの自動検証」、AI分担=「AI協業の運用」。
6. ゲーム制作フローの正本・監査スキル・武器の要件定義（07設計監査／08自動プレイテスト／09立ち上げキット）は `~/Documents/yukiya-private/projects/game-dev-flow/`。**このリポとknowledgeを探して見つからない設計文書は、まずここを疑う**（読めない環境なら人間かClaudeに本文の貼り付けを頼む）。

## ★ブランチ運用（迷子防止）
- **開発は `master`**。このブランチには `HANDOFF.md` / 設計md / `tools/` / 生成元素材を置く。
- **公開は `gh-pages`**。Cloudflare Pages / GitHub Pages が見る外部公開用で、`index.html` と必要な配信アセットだけを置く。設計思想・引き継ぎメモ・検証ツールは公開しない。
- `HANDOFF.md` や設計mdが見えない場合、公開用 `gh-pages` を見ている可能性が高い。作業前に `git branch --show-current` と `git status --short --branch` で現在地を確認する。
- 公開更新が必要な時だけ、`master` の成果物を `gh-pages` へ最小構成で反映する。通常作業で `gh-pages` に直接開発変更を積まない。

## ★ハードルール（厳守）
- **コミットはする**（区切りごと・なぜを込めた日本語メッセージで）。**push は人間の明示指示がある時だけ**。勝手に push しない。
- **単一ファイル**を維持（index.html）。フォント等の既存規約（`"M PLUS Rounded 1c"`）を踏襲。
- **コビトカバの体格は固定**（`veh().size`で大小しない方針＝旧art-bibleから変更）。機体差は**乗り物リグの物理＋当たり判定の形**で出す。小型ニッチは別キャラ。
- **設計を変えたら必ず該当ドキュメント（敵設計/機体設計/開発計画）と HANDOFF を更新**してからコミット。
- **ロジック（衝突/BD/音/UI状態機械/セーブ）を触ったバッチは、push/公開反映の前に必ず「★レビューゲート」を通す**。自動テストが緑＝レビュー済み、ではない（回帰系は自動テストの死角）。
- **作業を切り上げる前に HANDOFF.md の「最新の現在地／次の一手／未コミット」を更新**（＝次のエージェントが詰まらないように。これがバトンの実体）。
- **HANDOFF.md は「現在地」だけを保つ**。古い追記は `docs/handoff-archive/` へ移す（目安：5KB超）。

## ★動かし方・検証（手で遊ぶ前に機械で確かめる）
1. **構文チェック**：`node -e '...new Function(<script>中身)...'`（落ちないか）。
2. **生成バリデータ**：`node tools/validate.cjs` … ブラウザ環境をstubしてspawnを実行し、**全機体×全パターンに通路があるか／全ステージが例外なく頂上まで通るか**を機械検査。敵/機体/ステージをいじったら必ず回す。
3. **ヘッドレスChromeでスクショ**（見た目確認・要 timeout で包む／起動ごとに `--user-data-dir=$(mktemp -d)`）：
   ```
   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --no-sandbox \
     --user-data-dir=$(mktemp -d) --hide-scrollbars --window-size=480,860 \
     --virtual-time-budget=2500 --screenshot=out.png \
     "file:///Users/yukiya/Documents/hippo-rocket/index.html?cap&stage=A&veh=0&alt=120"
   ```
   **撮影専用URLクエリ**（コードに実装済み）：`?cap`即プレイ / `&stage= &veh= &alt=` 指定 / `&hold` 高度固定で敵だけ降下 / `&demo=over|float|swoop|dive` 新要素を中央固定 / `&show=dead&cause=fall|hit` 結果画面 / `&show=clear&pick=N` クリア結果画面（`pick`を付けないと内訳が「クリア/星ボーナス」の最大2行にしかならず、実際にコインを拾った時だけ出る「道中で拾った分」込みの最大3行状態を見落とす＝2026-07-03のクリアモーダル崩れ再発の原因はこれだった）。
   **注意**：headless Chromeは`--window-size`の実効下限が約500pxで、それより狭い値を指定すると一度500幅でレイアウトされてからリサイズされ、偽の崩れ/偽の正常が出ることがある。実機相当の見た目を確認したい時は`--window-size=500,900`のように500以上を指定する（本ゲームのcanvasは432×768固定解像度を等比スケールする設計のため、幅を変えても内部レイアウトの崩れ方自体は変わらない＝崩れの再現には状態(内訳の行数など)を変える方が確実）。
4. **ローカルプレイ**：`node` 簡易サーバ→ http://localhost:8123/index.html （無ければ任意の静的サーバで配信）。
5. 手プレイは「手触り・緩急・難度の効き」だけに残す（機械でできる検証は機械に）。
6. **バランス回帰ゲート**：`node tools/playtest.cjs --update-baseline` で全機体×全ステージの基準値を `tools/playtest_baseline.json` に保存。pre-commitが `--check-baseline` で自動比較し、クリア率が変わったら警告表示（コミットは止めない。意図した変更なら基準値を更新してコミットに含める）。

## ★レビューゲート（回帰の網＝自動テストの死角を別視点で塞ぐ）
自動検証（validate/smoke/playtest）が見るのは**湧き幾何・ホットスポット・バランス基準値**まで。**「無敵がゲートを貫通」「iframe混入」「状態機械の取りこぼし（タイトル無音）」のようなロジック退行は完全に死角**で、2026-07-03のバッチ群はこの死角で複数の退行を積んだ（磨き込みループを軽くした時にレビュー段が手順から抜けたのが原因）。だから軽いループは保ったまま、網だけを一番安い場所に固定する：

- **いつ**：ロジック（衝突/BD/音/UI状態機械/セーブスキーマ）を1つでも触ったバッチは、**push／gh-pages反映の前に必ず**回す。**純データだけ**（STAGESのビート/dmul/座標）の変更は validate/playtest で足りるので免除。毎コミットでは回さない＝公開直前にバッチ単位で一度。
- **誰が**：**実装した本人をレビュー役にしない**（自己検証は別視点にならない＝[[AI協業の運用]]のクロスチェック）。Codexが実装したバッチはClaudeが、Claudeが実装したバッチはCodexが adversarial に見る。
- **どう叩く**：`git diff <base> HEAD -- index.html` を stdin で `codex exec --sandbox read-only -C .` に渡す（大きければ機能群で分割）。差分が交錯して読みにくい時は「現在コード＋設計md（機体設計/敵設計/サウンド設計）を突き合わせて乖離＝退行を探せ」と指示する方が効く。プロンプトは Goal/読むもの/意図(正本)/Done when の4点。
- **所見の扱い**：**文書化済みの意図に反する明確バグ＝直す／設計判断が要る＝人間(yukiya)裁定**。**Codexは同僚であって権威でない**——鵜呑みにせず実機で裏取りし、指摘は取捨選択する。
- **★UI/描画を変えたら必ず目視（自動テストの死角＝レイアウト崩れ）**：validate/smoke/Codexは全部「ロジック」で、**文字の重なり・パネルはみ出し・トゲ等の描画ズレは検知できない**（2026-07-04、クリアパネルに星内訳2行を足して見出しと重なった＝この工程を飛ばして毎回yukiyaに崩れを指摘させていた）。canvasの描画/レイアウトを触ったら、**該当画面をスクショして自分の目で確認**してからコミットする：
  - クリア＝`?cap&stage=A&show=clear&pick=8`（pick=Nで内訳3行の最悪ケース＝ボタンとの詰みを再現）／死亡＝`?show=dead&cause=hit`／各画面＝`?screen=DESTINATION&dst=stages` 等／敵単体＝`?cap&demo=<種類>`。
  - 撮り方：`open <png>` で自分が見る。Chrome headless（`--headless=new --virtual-time-budget=3500 --screenshot=...`）はこの環境で**間欠ハングする**ので、失敗したら2〜3回リトライ。それでも撮れない時は**パネルの固定高さ(ph)と各要素のy座標を紙で足し算**して重なり/はみ出しが無いか検算する（撮れないことを目視スキップの言い訳にしない）。

## ★アート生成（必要時）
Codex内蔵 `image_gen`（ChatGPT枠）。既存の絵柄に合わせ参照画像を `-i` で渡し、**クロマキー緑(#00FF00)背景**で生成→`assets/states/`に置き→`node tools/cutout.cjs`で透過切り出し→`assets/sprites/`。スプライト名を index.html のローダ配列と cutout.cjs の files 配列に追加。

## ★引き継ぎ・交代（Claude ⇄ Codex）
交代制プロトコルの正本＝ `~/Documents/knowledge/dotfiles/skills/ai-handoff/SKILL.md`（Claudeには ai-handoff スキルとして自動発火。キックオフ定型文もそこ）。要点だけ：**HANDOFF.md が唯一のバトン**／区切りごとに更新／切り上げ合図で「HANDOFF更新→区切りが良ければ1コミット→3〜5行要約」／**pushしない**。
- このリポジトリ固有：敵/機体/ステージを触ったら引き渡し前に `node tools/validate.cjs` を回す。

## ★全体共通
全プロジェクト共通の人間ルールは `~/.claude/CLAUDE.md`（Claude用）。Codexはこの AGENTS.md と各docに従えばよい。
