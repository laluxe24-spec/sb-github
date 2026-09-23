---
name: tiktok-transcribe
description: TikTok動画のしゃべっている内容を文字起こしして`02_Sources/03_TikTok/data/@<アカウント名>/`に保存する。「このTikTokを文字起こしして」「このTikTokをナレッジに入れたい」の時に使う。1本でも、URLをまとめた複数本でもOK。
---

# TikTok文字起こし

動画の音声を文字起こしするところまでがこのスキル。ナレッジにするのはknowledge-buildスキル。要約や解釈は加えず、話している内容をそのまま残す。

## 手順

1. **URLを受け取る**: 個別の動画URL(`https://www.tiktok.com/@アカウント名/video/数字`)。プロフィールURLしか無い時は、対象の動画を1本ずつ確認してから進める
2. **実行する**:
   ```bash
   cd 02_Sources/03_TikTok
   python3 scripts/transcribe.py "https://www.tiktok.com/@アカウント名/video/数字"
   ```
   まとめて処理する時は、URLを1行1つ書いたテキストファイルを作って:
   ```bash
   python3 scripts/transcribe.py --file urls.txt
   ```
3. **確認**: 次のファイルができていればOK
   - `data/@アカウント名/transcripts/<動画ID>.md`: 文字起こし(url・投稿者・タイトル・投稿日つき)
   - `data/@アカウント名/manifest.json`: そのアカウントの動画一覧
   - 音声ファイルは自動で消える
   - 処理済みの動画は「スキップ(処理済み)」と出て正常終了する。エラーではない
4. **中身をりゅーじ君と確認**し、OKならknowledge-buildスキルでナレッジにする

## 使っている道具
- `yt-dlp`(brew): 音声だけダウンロード
- `ffmpeg`(brew): 音声の変換
- `mlx-whisper`(pip, Apple Silicon専用): 文字起こし。モデルは`mlx-community/whisper-large-v3-turbo`

## 注意点
- ブラウザでTikTokを直接開かない(自動アクセス扱いでエラーになる)。必ずこのプログラム経由で取る
- 初回はWhisperモデル(数百MB〜1GB)のダウンロードで時間がかかる
- 大量処理はメモリ対策済み(空きメモリ800MB未満で待機、10本ごとに再起動)。重いアプリ(Chromeのタブ、Claudeデスクトップアプリ)を閉じておくと落ちにくい
