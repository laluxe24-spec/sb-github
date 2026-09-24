const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Usage: node collect_metrics.js <handle> [monthsBack=3]
// Records each own post's reaction numbers (views / likes / reposts / replies /
// bookmarks) and, for self-thread continuations, which post they continue
// (parent_id). Saves to data/@<handle>/metrics.json keyed by tweet id.
// posts.json is not touched — this only adds numbers next to it, so the daily
// collector (collect_posts.js) keeps working as before. Numbers change over
// time, so every record also carries metrics_at (when it was read).

const HANDLE = process.argv[2];
const MONTHS_BACK = parseInt(process.argv[3] || '3', 10);

if (!HANDLE) {
  console.error('USAGE: node collect_metrics.js <handle> [monthsBack=3]');
  process.exit(1);
}

const ROOT = __dirname;
const OUT_DIR = path.join(ROOT, '..', 'data', `@${HANDLE}`);
const OUT_PATH = path.join(OUT_DIR, 'metrics.json');

// The action bar's aria-label reads like
// "12 件の返信、34 件のリポスト、567 件のいいね、8 件のブックマーク、12345 件の表示"
// (or the English equivalent). Pull each number out by its keyword.
function parseMetrics(label) {
  const out = { replies: null, reposts: null, likes: null, bookmarks: null, views: null };
  if (!label) return out;
  const keys = [
    ['replies', /(\d[\d,]*)\s*(?:件の返信|replies|reply)/i],
    ['reposts', /(\d[\d,]*)\s*(?:件のリポスト|reposts|repost)/i],
    ['likes', /(\d[\d,]*)\s*(?:件のいいね|likes|like)/i],
    ['bookmarks', /(\d[\d,]*)\s*(?:件のブックマーク|bookmarks|bookmark)/i],
    ['views', /(\d[\d,]*)\s*(?:件の表示|views|view)/i],
  ];
  for (const [k, re] of keys) {
    const m = label.match(re);
    if (m) out[k] = parseInt(m[1].replace(/,/g, ''), 10);
  }
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const existing = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : {};

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_BACK);

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
  await page.goto(`https://x.com/${HANDLE}/with_replies`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  for (let attempt = 0; attempt < 5; attempt++) {
    const hasError = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
    const articleCount = await page.locator('article').count();
    if (!hasError && articleCount > 0) break;
    console.log(`RELOAD_ATTEMPT ${attempt + 1}`);
    await page.waitForTimeout(5000 + attempt * 5000);
    await page.reload({ waitUntil: 'load', timeout: 60000 });
    await page.waitForTimeout(3000);
  }

  const now = new Date().toISOString();
  const found = {};
  const seen = new Set();
  let stagnantRounds = 0;
  let hitCutoff = false;
  let sampleLabel = null;

  while (stagnantRounds < 40 && !hitCutoff) {
    const items = await page.$$eval('article', (articles) =>
      articles.map((a) => {
        const social = a.querySelector('[data-testid="socialContext"]');
        const isRepost = !!(social && /repost|リポスト/i.test(social.innerText || ''));
        const timeEl = a.querySelector('time');
        const datetime = timeEl ? timeEl.getAttribute('datetime') : null;
        const linkEl = timeEl ? timeEl.closest('a') : null;
        const href = linkEl ? linkEl.getAttribute('href') : null;
        const handleEl = [...a.querySelectorAll('a')].find((el) => /^@\w+/.test((el.innerText || '').trim()));
        const authorHandle = handleEl ? handleEl.innerText.trim().slice(1) : null;
        const group = a.querySelector('[role="group"][aria-label]');
        const label = group ? group.getAttribute('aria-label') : null;
        return { href, datetime, isRepost, authorHandle, label };
      })
    );

    const before = seen.size;
    let prev = null; // previous article: {own, id, datetime}
    for (const it of items) {
      const m = it.href && it.href.match(/status\/(\d+)/);
      const own = !!(it.authorHandle && it.authorHandle.toLowerCase() === HANDLE.toLowerCase());
      const cur = { own, id: m ? m[1] : null, datetime: it.datetime };
      if (!m || !it.datetime) { prev = cur; continue; }
      seen.add(cur.id);

      if (own && !it.isRepost) {
        if (new Date(it.datetime) < cutoff) { hitCutoff = true; prev = cur; continue; }
        // In the with_replies timeline, a self-thread is shown oldest-first
        // (the post it continues sits directly above it), while separate
        // top-level posts are shown newest-first. So: previous article is own
        // AND older than this one => this one continues it. Compare tweet ids
        // rather than timestamps: a thread posted in one go shares the same
        // second, but ids still increase in posting order.
        let parentId = null;
        if (prev && prev.own && prev.id && BigInt(prev.id) < BigInt(cur.id)) {
          parentId = prev.id;
        }
        const isReplyToOther = prev && !prev.own && prev.id;
        if (!isReplyToOther) {
          if (!sampleLabel && it.label) sampleLabel = it.label;
          const metrics = parseMetrics(it.label);
          const old = found[cur.id];
          found[cur.id] = {
            ...metrics,
            parent_id: parentId || (old && old.parent_id) || null,
            created_at: it.datetime,
            metrics_at: now,
          };
        }
      }
      prev = cur;
    }

    if (seen.size === before) stagnantRounds++;
    else stagnantRounds = 0;

    if (seen.size === before) {
      const hasError = await page.evaluate(() => document.body.innerText.includes('問題が発生しました'));
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

  const merged = { ...existing, ...found };
  fs.writeFileSync(OUT_PATH, JSON.stringify(merged, null, 2));

  const withViews = Object.values(found).filter((r) => r.views !== null).length;
  const withParent = Object.values(found).filter((r) => r.parent_id).length;
  console.log(`SAMPLE_LABEL: ${sampleLabel}`);
  console.log(`DONE @${HANDLE}: ${Object.keys(found).length} posts read (views found: ${withViews}, thread continuations: ${withParent}) -> ${OUT_PATH}`);
  if (hitCutoff) console.log(`Stopped: reached posts older than ${MONTHS_BACK} months.`);
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
