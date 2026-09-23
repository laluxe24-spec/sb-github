---
name: transcribe
description: 文字起こしの手順書。TikTok・YouTubeの動画のしゃべっている内容や、Kindle本の本文を文字にして01_Sourcesに保存する。「このTikTok/YouTubeを文字起こしして」「この本を読み込んで」「〇〇をナレッジに入れたい」の時に使う。
---

# 文字起こし

## どのファイルを読むか

| 何を文字にするか | 読むファイル |
|---|---|
| TikTokの動画 | `TikTok.md` |
| YouTubeの動画 | `YouTube.md` |
| Kindleの本 | `Kindle.md` |

新しい媒体(Instagramの動画など)を文字にする時は、同じ形で`<媒体名>.md`をこのフォルダに作ってから始める(媒体ごとに1ファイル)。

## 共通ルール

- 要約や解釈は加えず、話している内容・書いてある内容をそのまま残す
- 保存先は`01_Sources/<媒体>/data/`。ナレッジや分析はここに置かない
- 終わったら中身をりゅーじ君と確認し、OKならknowledge-buildスキルでナレッジにする

## 動画の文字起こし(TikTok・YouTube共通)

音声だけダウンロードして、文字にする。

- 1本の時: `python3 scripts/transcribe.py "<動画URL>"`
- まとめて処理する時: URLを1行1つ書いたテキストファイルを作って `python3 scripts/transcribe.py --file urls.txt`
- できるもの:
  - `data/@<アカウント名>/transcripts/<動画ID>.md`: 文字起こし(URL・投稿者・タイトル・投稿日つき)
  - `data/@<アカウント名>/manifest.json`: そのアカウントの動画一覧
  - 音声ファイルは自動で消える
- 処理済みの動画は「スキップ(処理済み)」と出て正常終了する。エラーではない

使っている道具:
- `yt-dlp`(brew): 音声だけダウンロード
- `ffmpeg`(brew): 音声の変換
- `mlx-whisper`(pip, Apple Silicon専用): 文字起こし。モデルは`mlx-community/whisper-large-v3-turbo`

注意点:
- 初回はWhisperモデル(数百MB〜1GB)のダウンロードで時間がかかる
- 大量処理はメモリ対策済み(空きメモリ800MB未満で待機、10本ごとに再起動)。重いアプリ(Chromeのタブ、Claudeデスクトップアプリ)を閉じておくと落ちにくい
