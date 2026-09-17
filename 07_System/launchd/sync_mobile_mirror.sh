#!/bin/zsh
# sb-mac の軽量版(03_Knowledgeと04_MyKnowledgeのみ)を
# /Users/ryuji/sb-iphone-mirror にコピーし、GitHubのsb-iphoneリポジトリへpushする。
# iPhoneのObsidian Gitはこちらをクローンする。
set -e
SRC="/Users/ryuji/sb-mac"
DST="/Users/ryuji/sb-iphone-mirror"

mkdir -p "$DST"
rm -rf "$DST/01_Company" "$DST/05_Projects" "$DST/06_Outputs" "$DST/07_System" "$DST/CLAUDE.md"

rsync -a --delete \
  "$SRC/03_Knowledge" \
  "$SRC/04_MyKnowledge" \
  "$DST/"

cd "$DST"
git add -A
if ! git diff --cached --quiet; then
  git commit -m "軽量版(モバイル用)を更新: $(date '+%Y-%m-%d %H:%M')"
  echo "変更をコミットしました"
else
  echo "変更なし"
fi
