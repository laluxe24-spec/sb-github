# TikTok

`SKILL.md`の「動画の文字起こし」のやり方で、`01_Sources/03_TikTok`で実行する。

```bash
cd 01_Sources/03_TikTok
python3 scripts/transcribe.py "https://www.tiktok.com/@アカウント名/video/数字"
```

- URLは個別の動画URL(`https://www.tiktok.com/@アカウント名/video/数字`)。プロフィールURLしか無い時は、対象の動画を1本ずつ確認してから進める
- ブラウザでTikTokを直接開かない(自動アクセス扱いでエラーになる)。必ずこのプログラム経由で取る
