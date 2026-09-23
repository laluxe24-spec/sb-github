---
name: x-post-collect
description: Xの投稿型アカウント(本文を全部集めるタイプ)の投稿を`01_Sources/02_X/data/@<アカウント名>/posts.json`に集める。「Xのアカウント@〇〇を追加して」「Xの投稿を集めて」「新着を取って」の時に使う。1枚ずつ選ぶスクショ型(@kw1ew)はx-screenshot-collectを使う。
---

# X投稿収集(投稿型)

対象アカウントのプロフィールから投稿本文を取得して`posts.json`に保存する。全件そのまま保存する(自動リポストだけ除外される)。厳選は不要なので、確認を取らずに進めてよい。

## フォルダ
```
01_Sources/02_X/
├── scripts/                 収集プログラム(スクショ型と共通)
└── data/@<アカウント名>/posts.json   投稿データ(id・url・text・created_at)
```

## 手順

### 新しいアカウントを追加する
```bash
cd 01_Sources/02_X/scripts
node collect_posts.js <アカウント名>
```
- アカウント名は`@`なしで渡す(例: `mai_x0x0_21`)
- 2つ目の引数(何ヶ月前まで遡るか)を省略すると24ヶ月分を取る。初回はこれでよい
- `data/@<アカウント名>/posts.json`が自動で作られ、翌日からの毎朝の自動収集にも自動で含まれる

### 1アカウントの新着だけ取る
```bash
node collect_posts.js <アカウント名> 1
```
既に持っている投稿にぶつかった時点で止まるので、数秒〜数十秒で終わる。

### 全アカウントの新着をまとめて取る
```bash
node auto_check.js
```
`@kw1ew`以外の全アカウントに対して、上の「新着だけ取る」を順番に実行する。毎朝の自動実行(`x-daily`)と同じ処理。

## 注意点
- ログインが切れていたら`node login.js`を実行し、りゅーじ君本人がその場でXにログインする(ブラウザが開き、ログインを検知すると`auth.json`に保存して自動で閉じる)
- 初回や`node_modules`が消えている時は、先に`npm install && npx playwright install chromium`
- 分析結果はこのフォルダに置かない(ナレッジは02_Knowledge、分析はResearchの報告)
