#!/bin/zsh
# sb-mac の軽量版(生データ02_Sourcesを除く)を /Users/ryuji/sb-iphone-mirror にコピーし、
# GitHubのsb-iphoneリポジトリへpushする。iPhoneのObsidian Gitはこちらをクローンする。
set -e
SRC="/Users/ryuji/sb-mac"
DST="/Users/ryuji/sb-iphone-mirror"

mkdir -p "$DST"

rsync -a --delete \
  "$SRC/01_Company" \
  "$SRC/03_Knowledge" \
  "$SRC/04_MyKnowledge" \
  "$SRC/05_Projects" \
  "$SRC/06_Outputs" \
  "$SRC/07_System" \
  "$DST/"

cp "$SRC/CLAUDE.md" "$DST/CLAUDE.md" 2>/dev/null || true

cd "$DST"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "軽量版(モバイル用)を更新: $(date '+%Y-%m-%d %H:%M')"
  echo "変更をコミットしました"
else
  echo "変更なし"
fi
