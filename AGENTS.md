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
   **撮影専用URLクエリ**（コードに実装済み）：`?cap`即プレイ / `&stage= &veh= &alt=` 指定 / `&hold` 高度固定で敵だけ降下 / `&demo=over|float|swoop|dive` 新要素を中央固定 / `&show=dead&cause=fall|hit` 結果画面。
4. **ローカルプレイ**：`node` 簡易サーバ→ http://localhost:8123/index.html （無ければ任意の静的サーバで配信）。
5. 手プレイは「手触り・緩急・難度の効き」だけに残す（機械でできる検証は機械に）。

## ★アート生成（必要時）
Codex内蔵 `image_gen`（ChatGPT枠）。既存の絵柄に合わせ参照画像を `-i` で渡し、**クロマキー緑(#00FF00)背景**で生成→`assets/states/`に置き→`node tools/cutout.cjs`で透過切り出し→`assets/sprites/`。スプライト名を index.html のローダ配列と cutout.cjs の files 配列に追加。

## ★引き継ぎ・交代（Claude ⇄ Codex）
交代制プロトコルの正本＝ `~/Documents/knowledge/dotfiles/skills/ai-handoff/SKILL.md`（Claudeには ai-handoff スキルとして自動発火。キックオフ定型文もそこ）。要点だけ：**HANDOFF.md が唯一のバトン**／区切りごとに更新／切り上げ合図で「HANDOFF更新→区切りが良ければ1コミット→3〜5行要約」／**pushしない**。
- このリポジトリ固有：敵/機体/ステージを触ったら引き渡し前に `node tools/validate.cjs` を回す。

## ★全体共通
全プロジェクト共通の人間ルールは `~/.claude/CLAUDE.md`（Claude用）。Codexはこの AGENTS.md と各docに従えばよい。
