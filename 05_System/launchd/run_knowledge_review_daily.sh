#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="あなたは sb-mac プロジェクトの「秘書エージェント」です。これは無人実行(knowledge-review-daily)です。checkスキルを使って、今朝ナレッジにした内容をチェックしてください。"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/knowledge-review.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Skill,Bash(git diff:*),Bash(git log:*),Bash(git show:*)" \
  >> "$LOG_DIR/knowledge-review.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/knowledge-review.log"
