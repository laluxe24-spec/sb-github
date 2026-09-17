#!/bin/zsh
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
cd /Users/ryuji/sb-mac/02_Sources/03_TikTok/scripts
LOG_DIR=/Users/ryuji/sb-mac-logs
mkdir -p "$LOG_DIR"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 開始 ===" >> "$LOG_DIR/tiktok.log"
/opt/homebrew/bin/python3 -u auto_check.py >> "$LOG_DIR/tiktok.log" 2>&1
echo "=== $(date '+%Y-%m-%d %H:%M:%S') 終了 ===" >> "$LOG_DIR/tiktok.log"
