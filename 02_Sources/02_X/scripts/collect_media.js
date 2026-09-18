const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const RAW_TARGET = parseInt(process.argv[2] || '100', 10);
const USERNAME = 'kw1ew';
const ROOT = __dirname;
const PROCESSED_PATH = path.join(ROOT, 'processed_ids.json');

// Caption text patterns that reliably mark a tweet as NOT a technique-example
// screenshot (testimonial / thank-you / success-report content). Filtering on
// the tweet's own caption is cheap (no vision needed) and lets us skip the
// expensive per-image review for the majority of low-yield tweets.
const EXCLUDE_PATTERNS = [
  /報告/, /ご報告/, /結果[◯○〇]/, /感想/, /ありがとうござ/, /ありがとう!/,
  /受講/, /講座/, /教材/, /勉強になり/, /嬉しいご/, /お客様/, /生徒/,
  /レビュー/, /テキストを読/, /読ませて頂き/,
];

function loadProcessed() {
  if (fs.existsSync(PROCESSED_PATH)) {
    return new Set(JSON.parse(fs.readFileSync(PROCESSED_PATH, 'utf8')));
  }
  return new Set();
}

function saveProcessed(set) {
  fs.writeFileSync(PROCESSED_PATH, JSON.stringify([...set], null, 2));
}

(async () => {
  const processed = loadProcessed(); // now keyed by tweet ID only (not per-photo)
  const batchNum = Math.floor(processed.size / 100) + 1;
  const batchDir = path.join(ROOT, `screenshots_batch${batchNum}`);
  fs.mkdirSync(batchDir, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    storageState: 'auth.json',
  });
  const page = await context.newPage();
  await page.goto(`https://x.com/${USERNAME}`, { waitUntil: 'load', timeout: 60000 });
  await page.waitForTimeout(3000);

  const seenTweets = new Map(); // tweetId -> { text, imgs }  (NEW/unprocessed only)
  const anyTweetIdsSeen = new Set(); // ALL tweet ids encountered, processed or not — used to
  // detect genuine scroll stagnation (end of timeline) vs. "still scrolling past
  // already-processed tweets, haven't reached new ones yet" (which must NOT count as stagnant).
  let stagnantRounds = 0;

  while (seenTweets.size < RAW_TARGET && stagnantRounds < 60) {
    const items = await page.$$eval('article', (articles) =>
      articles.map((a) => {
        const linkEl = a.querySelector('a[href*="/status/"]');
        const href = linkEl ? linkEl.getAttribute('href') : null;
        const textEl = a.querySelector('[data-testid="tweetText"]');
        const text = textEl ? textEl.innerText : '';
        const imgs = [...a.querySelectorAll('img[src*="pbs.twimg.com/media/"]')].map((i) => i.src);
        return { href, text, imgs };
      })
    );

    const beforeAny = anyTweetIdsSeen.size;
    for (const it of items) {
      if (!it.href) continue;
      const m = it.href.match(/status\/(\d+)/);
      if (!m) continue;
      const id = m[1];
      anyTweetIdsSeen.add(id);
      if (it.imgs.length === 0) continue;
      if (seenTweets.has(id) || processed.has(id)) continue;
      seenTweets.set(id, { text: it.text, imgs: it.imgs });
      if (seenTweets.size >= RAW_TARGET) break;
    }
    // Only count as stagnant if scrolling truly isn't surfacing any new DOM
    // content at all (i.e. we've hit the real end of the timeline) — not
    // merely because everything visible happens to be already-processed.
    if (anyTweetIdsSeen.size === beforeAny) stagnantRounds++;
    else stagnantRounds = 0;

    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(1000);
  }

  console.log(`SCRAPED ${seenTweets.size} raw tweets with photos (batch ${batchNum})`);

  const candidates = [];
  const autoExcluded = [];
  for (const [id, { text }] of seenTweets) {
    const hit = EXCLUDE_PATTERNS.find((re) => re.test(text));
    if (hit) {
      autoExcluded.push({ id, text, reason: hit.toString() });
    } else {
      candidates.push(id);
    }
  }

  console.log(`TEXT_FILTER: ${candidates.length} candidates kept for visual review, ${autoExcluded.length} auto-excluded by caption`);

  // Auto-excluded tweets are confidently not what we want; mark them processed
  // so we never re-fetch/re-consider them again.
  for (const { id } of autoExcluded) processed.add(id);
  fs.writeFileSync(path.join(batchDir, 'auto_excluded.json'), JSON.stringify(autoExcluded, null, 2));

  // Download images only for candidates (worth spending bandwidth + a vision pass on).
  let i = 0;
  const manifest = [];
  for (const id of candidates) {
    const { imgs } = seenTweets.get(id);
    for (let photoIdx = 0; photoIdx < imgs.length; photoIdx++) {
      i++;
      const src = imgs[photoIdx];
      const srcUrl = new URL(src);
      const format = srcUrl.searchParams.get('format') || 'jpg';
      const base = src.split('?')[0];
      const origUrl = `${base}?format=${format}&name=orig`;
      const filename = `${String(i).padStart(3, '0')}_${id}_${photoIdx}.${format}`;
      try {
        const resp = await page.request.get(origUrl);
        if (resp.status() !== 200) {
          console.error('DOWNLOAD_BAD_STATUS', id, photoIdx, resp.status());
          continue;
        }
        const buf = await resp.body();
        if (buf.length === 0) {
          console.error('DOWNLOAD_EMPTY', id, photoIdx);
          continue;
        }
        fs.writeFileSync(path.join(batchDir, filename), buf);
        manifest.push({ id, url: `https://x.com/${USERNAME}/status/${id}`, file: filename });
      } catch (e) {
        console.error('DOWNLOAD_FAILED', id, photoIdx, e.message);
      }
    }
    processed.add(id); // mark processed once we've attempted to download all its photos
  }

  fs.writeFileSync(path.join(batchDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  saveProcessed(processed);

  console.log(`DONE batch${batchNum}: downloaded ${manifest.length} candidate images (from ${candidates.length} candidate tweets) to ${batchDir}`);
  console.log(`TOTAL_PROCESSED_TWEETS: ${processed.size}`);

  await browser.close();
})().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
