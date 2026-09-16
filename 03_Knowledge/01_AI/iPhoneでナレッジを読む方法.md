# iPhoneでナレッジを読む方法(Obsidian + Git)

sb-macの`03_Knowledge`などを、iPhoneのObsidianアプリで読めるようにする仕組み。

## 全体の仕組み

**イメージ**: sb-macの中身をそのままiPhoneに送ると重すぎる(`02_Sources`の生データだけで97MB)ので、**「知識・成果物だけの軽量版」を別の小さいGitHubリポジトリ(`sb-iphone`)に作って、そっちをiPhoneに送る**という2段構え。

```
sb-mac(Mac、フル版)
  → 毎日自動で軽量版だけコピー(02_Sourcesは除く)
  → GitHubの`sb-iphone`リポジトリへpush
  → iPhoneのObsidian(Gitプラグイン)がPullして読む
```

## セットアップ済みの内容

- Mac側に軽量版フォルダ: `/Users/ryuji/sb-iphone-mirror`(`01_Company`, `03_Knowledge`, `04_MyKnowledge`, `05_Projects`, `06_Outputs`, `07_System`, `CLAUDE.md`のみ。`02_Sources`は含まない)
- 同期スクリプト: `07_System/launchd/sync_mobile_mirror.sh`(コピー+コミット)、`run_sync_mobile_daily.sh`(pushまで)
- 毎日6:15に自動実行(`com.sbmac.sync-mobile-daily.plist`)
- GitHubリポジトリ: `https://github.com/laluxe24-spec/sb-iphone`(Private)
- iPhone側: Obsidianアプリに`sb-iphone`という名前のVaultを作成済み、「Git」コミュニティプラグイン導入済み、GitHubのPersonal Access Tokenで認証済み

## 使い方

- **最新を見たい時**: Obsidianでコマンドパレットを開き(右下メニューの「コマンドパレットを開く」など)、「Git: Pull」を実行する。これは**自動では届かないので、見たい時に自分でPullする**必要がある。
- 閲覧は普通にObsidianでファイルをタップするだけ。

## つまずいた点(参考)

- Gitプラグインのクローン中に「local .obsidian設定を消すか」聞かれることがある。**軽量版(`sb-iphone`)には`.obsidian`フォルダが元々無いので、この質問自体が出ないはず**(出た場合は「NO」を選ぶ)
- 最初、フル版(sb-mac本体、249MB)をそのままクローンしようとして、毎回タイムアウトした → 原因は`02_Sources`の生データ(97MB、画像多数)。軽量版に切り替えて解決
- 日本語のエイリアス・入力は、iPhone経由だと文字化けすることがある(→ `claude操作.md`参照)
- **「Git: Pull」で更新が反映されない/「Git: Clone」を既存Vaultに上書きしても直らない時がある**。その場合は素直に、**Vaultを一度削除して、まっさらな状態から新規クローンし直す**のが一番早い(このVaultは軽いので数十秒で終わる)。上書きより新規クローンの方が信頼できる
- Git author name/emailは、プラグイン導入直後に**先に**設定しておく(後から設定すると反映に時間がかかることがある)
