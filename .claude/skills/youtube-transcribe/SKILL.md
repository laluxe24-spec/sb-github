---
name: youtube-transcribe
description: YouTube動画のしゃべっている内容を文字起こしして`01_Sources/04_YouTube/data/@<チャンネル名>/`に保存する。「このYouTubeを文字起こしして」「このYouTubeをナレッジに入れたい」の時に使う。1本でも、URLをまとめた複数本でもOK。
---

# YouTube文字起こし

動画の音声を文字起こしするところまでがこのスキル。ナレッジにするのはknowledge-buildスキル。要約や解釈は加えず、話している内容をそのまま残す。

## 手順

1. **URLを受け取る**: `https://www.youtube.com/watch?v=...` または `https://youtu.be/...`
2. **実行する**:
   ```bash
   cd 01_Sources/04_YouTube
   python3 scripts/transcribe.py "https://youtu.be/xxxxxxxxxxx"
   ```
   まとめて処理する時は、URLを1行1つ書いたテキストファイルを作って:
   ```bash
   python3 scripts/transcribe.py --file urls.txt
   ```
3. **確認**: 次のファイルができていればOK
   - `data/@チャンネル名/transcripts/<動画ID>.md`: 文字起こし(url・チャンネル名・タイトル・投稿日つき)
   - `data/@チャンネル名/manifest.json`: そのチャンネルの動画一覧
   - 音声ファイルは自動で消える
   - 処理済みの動画は「スキップ(処理済み)」と出て正常終了する。エラーではない
4. **中身をりゅーじ君と確認**し、OKならknowledge-buildスキルでナレッジにする。実践者のノウハウ動画(「月50万達成」系)は個人の体験談なので、`はやと式.md`と同じく発信者ごとの専用ファイルに入れる

## 使っている道具
- `yt-dlp`(brew)・`ffmpeg`(brew)・`mlx-whisper`(pip, Apple Silicon専用、モデルは`mlx-community/whisper-large-v3-turbo`)

## 注意点
- YouTubeは1本が長いので、文字起こしに数分〜数十分かかることがある
- 初回はWhisperモデルのダウンロードで時間がかかる
- 大量処理はメモリ対策済み(空きメモリ800MB未満で待機、10本ごとに再起動)
