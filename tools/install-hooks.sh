#!/usr/bin/env bash
# gitフックをこのリポジトリにインストールする（.git/hooks はgit管理外＝clone後に1回叩く）。
#   bash tools/install-hooks.sh
# 入れるもの: pre-commit = index.html をコミットする時 tools/validate.cjs を自動実行。
# 「敵/機体/ステージを触ったら必ずvalidateを回す」ルールの機械化（手動忘れ防止）。
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$REPO/.git/hooks/pre-commit"

cat > "$HOOK" <<'EOF'
#!/usr/bin/env bash
# index.html がステージ/敵/機体の本体。変更がステージに乗る時だけ検証を回す。
if git diff --cached --name-only | grep -qx 'index.html'; then
  echo "[pre-commit] index.html を検証中: node tools/validate.cjs"
  if ! node tools/validate.cjs; then
    echo "[pre-commit] ★validate失敗。通路が塞がっている等の可能性。修正するか、意図的なら git commit --no-verify で通す。"
    exit 1
  fi
fi
EOF
chmod +x "$HOOK"
echo "インストール完了: ${HOOK}（index.htmlコミット時に validate.cjs が走る）"
