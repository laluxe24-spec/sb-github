#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="あなたは sb-mac プロジェクトの「秘書エージェント」です。これは無人実行(knowledge-agent-daily)です。my-knowledgeスキルとpost-knowledgeスキルを使って、01_Sourcesの新着データを自分用と配信用のナレッジにしてください。"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/knowledge-agent.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Agent,Skill" \
  >> "$LOG_DIR/knowledge-agent.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/knowledge-agent.log"
