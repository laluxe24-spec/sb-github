const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Usage: node collect_posts.js <handle> [monthsBack]
// Collects an account's own text posts (skips pure reposts) from their X
// profile's main "posts" tab, scrolling back until either the timeline ends
// or a post older than `monthsBack` months is reached. Safe to re-run: it
// merges into the existing post_accounts/<handle>/posts.json by tweet id,
// so a later run only needs to fetch forward from the newest saved post.

const HANDLE = process.argv[2];
const MONTHS_BACK = parseInt(process.argv[3] || '24', 10);

if (!HANDLE) {
  console.error('USAGE: node collect_posts.js <handle> [monthsBack=24]');
  process.exit(1);
}

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', 'post_accounts', HANDLE);
const OUT_PATH = path.join(OUT_DIR, 'posts.json');

function loadExisting() {
  if (fs.existsSync(OUT_PATH)) {
    return JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
  }
  return [];
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existing = loadExisting();
  const existingIds = new Set(existing.map((p) => p.id));

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_BACK);

  // Two distinct situations look identical at the top of the timeline (we
  // immediately start seeing already-known ids), but need different
  // behavior:
  //  - "update" run: a previous run already backfilled all the way to (at
  //    least) this cutoff, so once we're back in known territory there is
  //    nothing older left to gain — safe to stop early.
  //  - "backfill" run: existing data only covers a recent window (e.g. an
  //    earlier short test run) that doesn't yet reach the cutoff — known ids
  //    encountered near the top must be skipped WITHOUT stopping, so the
  //    scroll can continue past them into genuinely older, uncollected posts.
  const existingOldestDate = existing.length
    ? existing.reduce((min, p) => (p.created_at < min ? p.created_at : min), existing[0].created_at)
    : null;
  const isUpdateRun = existingOldestDate !== null && new Date(existingOldestDate) <= cutoff;
  console.log(isUpdateRun ? 'MODE: update (existing coverage already reaches the cutoff)' : 'MODE: backfill (scrolling past known posts to reach older, uncollected ones)');

  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState: path.join(ROOT, 'auth.json'),
  });
  const page = await context.newPage();
  // with_replies is a superset of the plain profile: own top-level posts +
  // own replies (both self-thread continuations and replies to others). We
  // filter out replies-to-others below, keeping self-thread continuations.
  await page.goto(`https://x.com/${HANDLE}/with_replies`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  // X occasionally serves a soft-error placeholder ("something went wrong,
  // please reload") instead of the timeline — usually transient (rate-limit-
  // ish), and a reload after a short pause reliably clears it.
  for (let attempt = 0; attempt < 5; attempt++) {
    const hasError = await page.evaluate(() =>
      document.body.innerText.includes('問題が発生しました')
    );
    const articleCount = await page.locator('article').count();
    if (!hasError && articleCount > 0) break;
    console.log(`RELOAD_ATTEMPT ${attempt + 1} (error page or empty timeline detected)`);
    await page.waitForTimeout(5000 + attempt * 5000);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
  }

  const collected = new Map(); // id -> {id, url, text, created_at}
  const anyTweetIdsSeen = new Set();
  let stagnantRounds = 0;
  let hitCutoff = false;
  let hitKnown = false; // reached a tweet id we've already saved (catch-up mode)

  while (stagnantRounds < 40 && !hitCutoff && !hitKnown) {
    const items = await page.$$eval(`article`, (articles) => {
      return articles.map((a) => {
        // Skip pure reposts (no added comment) — social context line says so.
        const social = a.querySelector('[data-testid="socialContext"]');
        const isRepost = social && /repost|リポスト/i.test(social.innerText || '');

        const timeEl = a.querySelector('time');
        const datetime = timeEl ? timeEl.getAttribute('datetime') : null;
        const linkEl = timeEl ? timeEl.closest('a') : null;
        const href = linkEl ? linkEl.getAttribute('href') : null;

        // The with_replies timeline shows no "replying to" label in list view;
        // instead, a reply's parent tweet (from whoever it's addressed to) is
        // rendered as the immediately preceding <article>. So to tell a
        // self-thread continuation from a reply-to-someone-else, the caller
        // compares each article's author handle against the PREVIOUS
        // article's author handle. Grab the author's own @handle here (first
        // anchor whose text is "@something").
        const handleEl = [...a.querySelectorAll('a')].find((el) => /^@\w+/.test((el.innerText || '').trim()));
        const authorHandle = handleEl ? handleEl.innerText.trim().slice(1) : null;

        const textEl = a.querySelector('[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : '';

        return { href, datetime, text, isRepost, authorHandle };
      });
    });

    const beforeAny = anyTweetIdsSeen.size;
    let prevAuthor = null;
    for (const it of items) {
      const isOwn = it.authorHandle && it.authorHandle.toLowerCase() === HANDLE.toLowerCase();

      if (!it.href || !it.datetime) {
        prevAuthor = it.authorHandle;
        continue;
      }
      const m = it.href.match(/status\/(\d+)/);
      if (!m) {
        prevAuthor = it.authorHandle;
        continue;
      }
      const id = m[1];
      anyTweetIdsSeen.add(id);

      if (!isOwn) {
        // A foreign tweet shown only as reply-context — not to be saved, but
        // remember its author so the NEXT (own) article can be checked.
        prevAuthor = it.authorHandle;
        continue;
      }

      // This article is the account's own tweet. If the immediately preceding
      // article was from someone else, this is a reply directed at them —
      // exclude. If the preceding article was the account's own (or this is
      // the very first article), it's either a top-level post or a
      // self-thread continuation — keep.
      const isReplyToOther = prevAuthor !== null && prevAuthor.toLowerCase() !== HANDLE.toLowerCase();
      prevAuthor = it.authorHandle;

      if (existingIds.has(id)) {
        if (isUpdateRun) hitKnown = true;
        continue;
      }
      if (it.isRepost) continue;
      if (!it.text) continue;
      if (isReplyToOther) continue;

      const createdAt = new Date(it.datetime);
      if (createdAt < cutoff) {
        hitCutoff = true;
        continue;
      }

      if (!collected.has(id)) {
        collected.set(id, {
          id,
          url: `https://x.com/${HANDLE}/status/${id}`,
          text: it.text,
          created_at: it.datetime,
        });
      }
    }

    if (anyTweetIdsSeen.size === beforeAny) stagnantRounds++;
    else stagnantRounds = 0;

    // Mid-scroll rate-limit recovery: if the error placeholder shows up,
    // back off and reload rather than let it masquerade as "end of timeline".
    if (anyTweetIdsSeen.size === beforeAny) {
      const hasError = await page.evaluate(() =>
        document.body.innerText.includes('問題が発生しました')
      );
      if (hasError) {
        console.log('MID_SCROLL_ERROR: backing off and reloading');
        await page.waitForTimeout(8000);
        await page.reload({ waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(3000);
        stagnantRounds = 0;
        continue;
      }
    }

    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(1200);
  }

  await browser.close();

  const merged = [...existing, ...collected.values()];
  merged.sort((a, b) => (a.id < b.id ? 1 : -1)); // newest first
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));

  console.log(`DONE @${HANDLE}: +${collected.size} new posts (total ${merged.length}) -> ${OUT_PATH}`);
  if (hitCutoff) console.log(`Stopped: reached posts older than ${MONTHS_BACK} months.`);
  if (hitKnown) console.log(`Stopped: caught up with previously saved posts (incremental update complete).`);
  if (!hitCutoff && !hitKnown) console.log(`Stopped: reached end of timeline (scroll stagnant).`);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
