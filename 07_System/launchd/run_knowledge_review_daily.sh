#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="$(cat 07_System/launchd/knowledge_review_prompt.md)"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/knowledge-review.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Bash(git diff:*),Bash(git log:*),Bash(git show:*)" \
  >> "$LOG_DIR/knowledge-review.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/knowledge-review.log"
