# hippo-rocket

ムーデン（コビトカバ）がロケットで上を目指す、縦スクロール・ワンボタンのカジュアルゲーム。
**ブーストで昇り、あえてエンジンを切って落下して鳥などの障害をかわし、どこまで高く行けるかを競う。**

## ブランチ運用

- `master`：開発用ブランチ。設計メモ、`HANDOFF.md`、検証ツール、生成元素材を含む。
- `gh-pages`：公開用ブランチ。外部公開に必要な `index.html` と配信アセットだけを置く。設計思想や引き継ぎメモは公開しない。

Cloudflare Pages / GitHub Pages の公開元は `gh-pages`。開発作業は `master` で行い、公開時だけ必要ファイルを `gh-pages` へ反映する。

## 開発の入口

- エージェント作業は [AGENTS.md](AGENTS.md) → [HANDOFF.md](HANDOFF.md) の順に読む。
- 現在地と次の一手は [HANDOFF.md](HANDOFF.md) が正本。
- 企画の詳細は [企画.md](企画.md)。
