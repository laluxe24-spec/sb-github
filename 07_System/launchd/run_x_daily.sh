#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac/02_Sources/02_X/scripts
LOG_DIR=/Users/ryuji/sb-mac/07_System/launchd/logs
mkdir -p "$LOG_DIR"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/x.log"
/usr/local/bin/node auto_check.js >> "$LOG_DIR/x.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/x.log"
