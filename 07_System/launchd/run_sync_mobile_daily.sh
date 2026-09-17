#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/sync-mobile.log"
/Users/ryuji/sb-mac/07_System/launchd/sync_mobile_mirror.sh >> "$LOG_DIR/sync-mobile.log" 2>&1
cd /Users/ryuji/sb-iphone-mirror && git push origin main >> "$LOG_DIR/sync-mobile.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/sync-mobile.log"
