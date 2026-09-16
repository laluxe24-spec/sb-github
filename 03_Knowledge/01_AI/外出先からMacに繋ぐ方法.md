# 外出先からMacに繋ぐ方法(Tailscale + Termius)

iPhoneから外出先で、自宅のMacのターミナルを操作して`/remote-control`に繋ぐためのセットアップ手順。

## 全体の仕組み

**イメージ**: 自宅のMacとiPhoneの間だけに、専用の秘密のトンネルを掘るようなもの。このトンネル(Tailscale)を通って、iPhoneからMacのターミナル(SSH)に鍵を挿して入る、という2段構え。

```
iPhone(Termiusアプリ)
  → Tailscaleの専用トンネルを通る
  → Macのターミナルにログイン(SSH)
  → `claude --resume` や `/remote-control` を実行
```

## セットアップ済みの内容

### 1. Mac側: Tailscale
- インストール済み、ログイン済み(Googleアカウント)
- MacのTailscale上のIPアドレス: `100.123.41.89`(固定。確認したい時はメニューバーのTailscaleアイコンから見れる)
- 「Start at login」をON済み(Macを再起動してもTailscaleが自動で起動する)

### 2. Mac側: リモートログイン(SSH)
- 「システム設定」→「一般」→「共有」→「リモートログイン」をON済み
- アクセス許可は「管理者のみ」に制限済み(セキュリティのため)

### 3. iPhone側: Termius
- App Storeから「Termius: Modern SSH Client」をインストール済み
- アカウント作成は不要(「Continue with Basic SSH」でスキップ)
- 接続先ホストを登録済み: IP `100.123.41.89` / ユーザー名 `ryuji` / パスワードはMacのログインパスワード

### 4. Mac側: ワンコマンドで戻れるエイリアス
`.zshrc`に登録済み。**日本語のエイリアスはiPhoneのSSHアプリ経由だと文字化けする**ため、英語名にしてある。

```
alias resume='claude --resume ba635277-6970-44d4-b7bd-21123fc7122a'
```

## 外出先から使う時の手順

1. iPhoneでTermiusを開く
2. 登録済みのホストをタップして接続
3. 繋がったら、ターミナル画面で`resume`と打つだけでこのセッションに戻れる
4. リッチな見た目(吹き出し付き)でVS Codeなどから見たい場合は、続けて`/remote-control`と打つ

## 注意点

- **Macがスリープしてると繋がらない**。外出中も使いたいなら、Macを電源に繋ぎっぱなしにして、「システム設定」→「バッテリー」で「電源アダプタ接続時にディスプレイオフでもスリープしない」をONにしておく(または`sudo pmset -c sleep 0`)
- パスワードやSSHの鍵情報は、Claudeとのチャットには絶対に貼らない(Termiusアプリの入力欄に直接入力する)
