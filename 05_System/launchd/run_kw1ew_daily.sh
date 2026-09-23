#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="あなたは sb-mac プロジェクトの「秘書AI」です。これは無人実行(kw1ew-daily)です。collectスキル(X.mdのスクショ型)を使って、@kw1ewの新着スクショの収集・厳選処理を行ってください。"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/kw1ew-collector.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Skill,Bash(node:*),Bash(cp:*),Bash(mkdir:*),Bash(rm:*),Bash(mv:*)" \
  >> "$LOG_DIR/kw1ew-collector.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/kw1ew-collector.log"
