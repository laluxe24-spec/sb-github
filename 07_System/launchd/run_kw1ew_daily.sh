#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac/07_System/launchd/logs
mkdir -p "$LOG_DIR"
PROMPT="$(cat 07_System/launchd/x_kw1ew_collector_prompt.md)"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/kw1ew-collector.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash(node:*),Bash(cp:*),Bash(mkdir:*),Bash(rm:*),Bash(mv:*)" \
  >> "$LOG_DIR/kw1ew-collector.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/kw1ew-collector.log"
