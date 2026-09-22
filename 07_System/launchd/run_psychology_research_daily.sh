#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="あなたは sb-mac プロジェクトの「秘書エージェント」です。これは無人実行(psychology-research-daily)です。psychology-research-dailyスキルを使って、心理学ジャンルのリサーチ待ちリストを1件処理してください。"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/psychology-research.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Skill,WebSearch,WebFetch" \
  >> "$LOG_DIR/psychology-research.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/psychology-research.log"
