const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Usage: node collect_posts.js <handle> [monthsBack=24] [--full] [--with-replies]
//
// アカウントの投稿を集めて data/@<handle>/posts.json に保存する。
// 画面の文字ではなく、Xが裏で受け取っている元データ(GraphQL)から取るので、
// 「さらに表示」で折りたたまれた長文も全文入る。反応の数字も一緒に保存する。
//
// - 残すもの: 本人の投稿と、本人のスレッドの続き(自分への返信)
// - 外すもの: 他の人への返信、リポスト
// - すでに保存済みの投稿: 本文がより長く取れたら上書き、数字は毎回最新に更新
// - monthsBack: 何ヶ月前まで遡るか(新着だけなら 1)
// - --full: 保存済みの投稿にぶつかっても止まらず、monthsBack まで全部見直す
//           (本文の取り直し・数字の更新をまとめてやる時に使う)

const args = process.argv.slice(2);
const FULL = args.includes('--full');
// 普段は「ポスト」タブから取る(他の人への返信を読み込まないので、Xに制限されにくい。スレッドの続きも取れる)。
// --with-replies を付けた時だけ、昔のやり方(「返信」タブ)で取る
const POSTS_TAB = !args.includes('--with-replies');
const pos = args.filter((a) => !a.startsWith('--'));
const HANDLE = pos[0];
const MONTHS_BACK = parseInt(pos[1] || '24', 10);

if (!HANDLE) {
  console.error('USAGE: node collect_posts.js <handle> [monthsBack=24] [--full]');
  process.exit(1);
}

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', 'data', `@${HANDLE}`);
const OUT_PATH = path.join(OUT_DIR, 'posts.json');

const cutoff = new Date();
cutoff.setMonth(cutoff.getMonth() - MONTHS_BACK);

const existing = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : [];
const byId = new Map(existing.map((p) => [p.id, p]));
const existingIds = new Set(byId.keys());

// 保存済みのデータが cutoff まで届いているなら、新着だけ取る「更新モード」
const oldest = existing.length ? existing.reduce((m, p) => (p.created_at < m ? p.created_at : m), existing[0].created_at) : null;
const isUpdateRun = !FULL && oldest !== null && new Date(oldest) <= cutoff;

const stats = { added: 0, textFixed: 0, metricsUpdated: 0, replyToOther: 0, repost: 0 };
const seenOps = new Set();
let profile = null;
let hitCutoff = false;
let hitKnown = false;
let oldHits = 0;   // cutoffより古い投稿に何回当たったか
let knownHits = 0; // 保存済みの投稿に何回当たったか
let ownSeen = 0;

function authorOf(t) {
  const u = t.core && t.core.user_results && t.core.user_results.result;
  if (!u) return null;
  return (u.core && u.core.screen_name) || (u.legacy && u.legacy.screen_name) || null;
}

function handleTweet(obj, pinned) {
  const t = obj.__typename === 'TweetWithVisibilityResults' ? obj.tweet : obj;
  if (!t || !t.legacy || !t.rest_id) return;
  const author = authorOf(t);
  if (!author || author.toLowerCase() !== HANDLE.toLowerCase()) return;
  const L = t.legacy;
  if (L.retweeted_status_result || (L.full_text || '').startsWith('RT @')) { stats.repost++; return; }
  const replyTo = L.in_reply_to_screen_name;
  if (replyTo && replyTo.toLowerCase() !== HANDLE.toLowerCase()) { stats.replyToOther++; return; }

  const createdAt = new Date(L.created_at);
  if (createdAt < cutoff) {
    // 固定ポストは古くても一番上に出るので、止まる理由にしない。3回当たったら止める
    if (!pinned && ++oldHits >= 3) hitCutoff = true;
    return;
  }
  ownSeen++;

  const note = t.note_tweet && t.note_tweet.note_tweet_results && t.note_tweet.note_tweet_results.result;
  const text = note && note.text ? note.text : (L.full_text || '');
  if (!text) return;

  const metrics = {
    views: t.views && t.views.count ? parseInt(t.views.count, 10) : null,
    likes: L.favorite_count ?? null,
    reposts: L.retweet_count ?? null,
    replies: L.reply_count ?? null,
    bookmarks: L.bookmark_count ?? null,
    quotes: L.quote_count ?? null,
  };
  const now = new Date().toISOString();
  const id = t.rest_id;

  if (existingIds.has(id)) {
    if (isUpdateRun && !pinned && ++knownHits >= 3) hitKnown = true;
    const p = byId.get(id);
    if (text.length > (p.text || '').length) { p.text = text; stats.textFixed++; }
    p.is_long = !!(note && note.text);
    p.parent_id = replyTo ? L.in_reply_to_status_id_str : null;
    p.metrics = metrics;
    p.metrics_at = now;
    stats.metricsUpdated++;
    existingIds.delete(id); // 同じ投稿を2回数えない
    return;
  }
  if (byId.has(id)) return;

  byId.set(id, {
    id,
    url: `https://x.com/${HANDLE}/status/${id}`,
    text,
    created_at: createdAt.toISOString(),
    is_long: !!(note && note.text),
    parent_id: replyTo ? L.in_reply_to_status_id_str : null,
    metrics,
    metrics_at: now,
  });
  stats.added++;
}

function walk(node, pinned = false) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((n) => walk(n, pinned)); return; }
  const isPin = pinned || node.type === 'TimelinePinEntry';
  if (node.__typename === 'Tweet' || node.__typename === 'TweetWithVisibilityResults') handleTweet(node, isPin);
  for (const k of Object.keys(node)) walk(node[k], isPin);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(POSTS_TAB ? 'TAB: ポストタブ' : 'TAB: 返信タブ(昔のやり方)');
  console.log(isUpdateRun ? 'MODE: update(新着だけ)' : (FULL ? 'MODE: full(全部見直す)' : 'MODE: backfill(古い投稿まで遡る)'));

  const browser = await chromium.launch({ headless: false, args: ['--disable-blink-features=AutomationControlled'] });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState: path.join(ROOT, 'auth.json'),
  });
  const page = await context.newPage();

  let responses = 0;
  page.on('response', async (res) => {
    const u = res.url();
    if (!u.includes('/graphql/')) return;
    const op = u.split('?')[0].split('/').pop() || '?';
    seenOps.add(op);
    // アカウント情報(フォロワー数・作った日など)。取るたびに履歴として残す(伸び方を見るため)
    if (op === 'UserByScreenName') {
      try {
        const j = await res.json();
        const u = j && j.data && j.data.user && j.data.user.result;
        if (u) {
          // Xはデータの形をよく変えるので、場所を決め打ちせず中を探す
          const find = (o, key) => {
            if (!o || typeof o !== 'object') return undefined;
            if (key in o && typeof o[key] !== 'object') return o[key];
            for (const k of Object.keys(o)) { const v = find(o[k], key); if (v !== undefined) return v; }
            return undefined;
          };
          const rc = u.relationship_counts || {};
          const tc = u.tweet_counts || {};
          profile = {
            created_at: find(u, 'created_at') ?? null,
            name: (u.core && u.core.name) || null,
            bio: (u.profile_bio && u.profile_bio.description) || (u.legacy && u.legacy.description) || null,
            followers: rc.followers ?? find(u, 'followers_count') ?? null,
            following: rc.following ?? find(u, 'friends_count') ?? null,
            posts: tc.tweets ?? find(u, 'statuses_count') ?? null,
          };
          if (profile.followers === null) {
            fs.writeFileSync(path.join(ROOT, '_profile_raw.json'), JSON.stringify(j, null, 1));
          }
        }
      } catch (e) {}
      return;
    }
    // 名前はXが変えることがあるので、1つに決め打ちしない
    if (!/^User.*(Tweets|Timeline)$|UserWithReplies/i.test(op)) return;
    try { walk(await res.json()); responses++; } catch (e) {}
  });

  // with_replies = 本人の投稿+スレッドの続き+他人への返信。他人への返信は上で外す
  await page.goto(POSTS_TAB ? `https://x.com/${HANDLE}` : `https://x.com/${HANDLE}/with_replies`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(4000);

  // Xがたまに出す「問題が発生しました」は、少し待って再読み込みすれば直る
  for (let attempt = 0; attempt < 5; attempt++) {
    const hasError = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
    const articles = await page.locator('article').count();
    if (!hasError && articles > 0) break;
    console.log(`RELOAD_ATTEMPT ${attempt + 1}`);
    await page.waitForTimeout(5000 + attempt * 5000);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
  }

  let stagnant = 0;
  let lastCount = -1;
  let reloads = 0;
  const MAX_RELOADS = 4; // Xに制限された時、再読み込みは4回まで。それ以上は取れた分を保存して終わる
  let rateLimited = false;
  while (stagnant < 15 && !hitCutoff && !hitKnown) {
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(1500);
    if (ownSeen === lastCount) {
      stagnant++;
      const hasError = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
      if (hasError) {
        if (reloads >= MAX_RELOADS) { rateLimited = true; break; }
        reloads++;
        const waitSec = 30 * reloads; // 30秒→60秒→90秒→120秒と長めに待つ
        console.log(`MID_SCROLL_ERROR: Xに制限されたかも。${waitSec}秒待って再読み込み(${reloads}/${MAX_RELOADS})`);
        await page.waitForTimeout(waitSec * 1000);
        await page.reload({ waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(3000);
        stagnant = 0;
      }
    } else {
      stagnant = 0;
    }
    lastCount = ownSeen;
  }
  await browser.close();

  const merged = [...byId.values()].sort((a, b) => (a.id < b.id ? 1 : -1));
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));

  if (profile) {
    const PROFILE_PATH = path.join(OUT_DIR, 'profile.json');
    const prev = fs.existsSync(PROFILE_PATH) ? JSON.parse(fs.readFileSync(PROFILE_PATH, 'utf8')) : { history: [] };
    const out = {
      handle: HANDLE,
      created_at: profile.created_at ? new Date(profile.created_at).toISOString() : prev.created_at || null,
      name: profile.name ?? prev.name ?? null,
      bio: profile.bio ?? prev.bio ?? null,
      history: [{ at: new Date().toISOString(), followers: profile.followers, following: profile.following, posts: profile.posts }, ...(prev.history || [])],
    };
    fs.writeFileSync(PROFILE_PATH, JSON.stringify(out, null, 2));
    console.log(`アカウント情報: フォロワー ${profile.followers}人 / 作った日 ${out.created_at ? out.created_at.slice(0, 10) : '不明'}`);
  }

  console.log(`DONE @${HANDLE}: 新しく追加 ${stats.added}件 / 全文に直した ${stats.textFixed}件 / 数字を更新 ${stats.metricsUpdated}件 (合計 ${merged.length}件)`);
  console.log(`除外: 他の人への返信 ${stats.replyToOther}件 / リポスト ${stats.repost}件`);
  const threadParts = merged.filter((p) => p.parent_id && p.metrics_at && new Date(p.metrics_at) > new Date(Date.now() - 3600e3)).length;
  console.log(`今回取れたスレッドの続き: ${threadParts}件`);
  if (rateLimited) console.log('止まった理由: Xに制限された。取れた分だけ保存した。時間をあけて同じコマンドをもう一度やれば続きが取れる');
  else if (hitCutoff) console.log(`止まった理由: ${MONTHS_BACK}ヶ月より前の投稿まで来た`);
  else if (hitKnown) console.log('止まった理由: 保存済みの投稿に追いついた(新着の取得完了)');
  else console.log('止まった理由: タイムラインの最後まで来た');
  if (responses === 0) {
    console.log('注意: 投稿のデータを1つも受け取れなかった。Xから届いたデータの名前:');
    [...seenOps].forEach((o) => console.log('  ' + o));
  }
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
