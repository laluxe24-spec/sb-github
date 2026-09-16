// X(ポスト型7アカウント)の新着ポストを日次で自動収集する(launchdからの
// 日次実行を想定)。各アカウントについて collect_posts.js を呼ぶだけで、
// 収集済みポストに追いつき次第(hitKnown)自動で打ち切られるので、
// 2回目以降の実行は基本的に数秒〜数十秒で終わる。
//
// スクショ型のkw1ewはここでは扱わない(絞り込みが必要なため別フロー)。
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, '..', 'data');

const POST_ACCOUNTS = fs
  .readdirSync(DATA_DIR)
  .filter((name) => name.startsWith('@') && name !== '@kw1ew')
  .map((name) => name.slice(1));

// monthsBack=1固定で呼ぶ。collect_posts.jsは「既存データの最古日付が
// cutoff(今からmonthsBackヶ月前)より古ければupdateモード」と判定する。
// 通常運用では既存データの方がずっと古いはずなので、monthsBackを浅く
// (1ヶ月)しておくことで確実にupdateモードにし、「既知のポストに
// ぶつかった時点で打ち切り」の早期終了を効かせる。デフォルトの24ヶ月の
// ままだと毎回backfillモード(全履歴スクロール)になり、日次実行には
// 重すぎる。
const DAILY_MONTHS_BACK = '1';

for (const handle of POST_ACCOUNTS) {
  console.log(`=== @${handle} の新着ポストを確認中 ===`);
  try {
    execFileSync('node', [path.join(ROOT, 'collect_posts.js'), handle, DAILY_MONTHS_BACK], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  } catch (err) {
    console.error(`@${handle} の収集に失敗: ${err.message}`);
  }
}

console.log('完了。');
