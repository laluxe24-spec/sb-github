#!/bin/zsh
export PATH="/Users/ryuji/.npm-global/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
PROMPT="あなたは sb-mac プロジェクトの「秘書エージェント」です。これは無人実行(knowledge-agent-daily)です。knowledge-agentスキルを使って、02_Sourcesの新着データのナレッジ化処理を行ってください。"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/knowledge-agent.log"
claude -p "$PROMPT" \
  --permission-mode acceptEdits \
  --allowedTools "Read,Write,Edit,Glob,Grep,Agent,Skill" \
  >> "$LOG_DIR/knowledge-agent.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/knowledge-agent.log"
