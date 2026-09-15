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

for (const handle of POST_ACCOUNTS) {
  console.log(`=== @${handle} の新着ポストを確認中 ===`);
  try {
    execFileSync('node', [path.join(ROOT, 'collect_posts.js'), handle], {
      stdio: 'inherit',
      cwd: ROOT,
    });
  } catch (err) {
    console.error(`@${handle} の収集に失敗: ${err.message}`);
  }
}

console.log('完了。');
