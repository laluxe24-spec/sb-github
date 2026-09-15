# X解析

X(Twitter)アカウントの投稿を分析・収集するプロジェクト。

- `docs/` : 共通ドキュメント(このREADME、操作メモ)
- `scripts/` : 収集・ログイン用のPlaywrightスクリプト(共通)
- `data/@<アカウント名>/` : アカウントごとの生データ
  - スクショ収集型: `スクショ/`(厳選済み画像) + `manifest.json`(元ツイートURL)
  - 投稿収集型: `posts.json`(投稿本文+URL)

分析結果(文字起こし・まとめなど)は、このプロジェクト内には置かず、`03_Knowledge/03_Romance/`(ジャンル別)に直接まとめる運用にしている。

## 現在の対象アカウント
- スクショ型: `@kw1ew`(はやと) → `data/@kw1ew/`
- 投稿型: `@bagurase_tyan` `@romantic_thai` `@mirei_urateku` `@Sta_Loveshinri` `@rei0723_X` `@mai_x0x0_21` → `data/@<各アカウント名>/`

収集〜絞り込みの再現手順は `docs/操作メモ.md` を参照。
