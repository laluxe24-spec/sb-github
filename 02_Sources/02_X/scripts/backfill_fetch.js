// 過去に「候補として見たが採用されなかった」kw1ewのツイートを、1つのブラウザセッションで
// 順番に再訪問し、画像URLだけを抽出して JSON に書き出す(ダウンロードは別ステップ)。
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IDS_PATH = process.argv[2] || '/tmp/kw1ew_gap_ids.json';
const OUT_PATH = process.argv[3] || '/tmp/kw1ew_gap_images.json';
const START = parseInt(process.argv[4] || '0', 10);
const END = parseInt(process.argv[5] || '99999', 10);

(async () => {
  const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8')).slice(START, END);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: path.join(__dirname, 'auth.json'),
  });
  const page = await context.newPage();

  let results = fs.existsSync(OUT_PATH) ? JSON.parse(fs.readFileSync(OUT_PATH, 'utf8')) : {};

  for (const id of ids) {
    if (results[id]) continue; // 既に処理済みならスキップ(再実行対応)
    const url = `https://x.com/kw1ew/status/${id}`;
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(900);
      const imgs = await page.$$eval('article img', (els) =>
        els.map((e) => e.src).filter((src) => src.includes('twimg.com/media'))
      );
      results[id] = imgs;
    } catch (err) {
      results[id] = { error: err.message };
    }
    fs.writeFileSync(OUT_PATH, JSON.stringify(results, null, 2));
    if (Object.keys(results).length % 20 === 0) {
      console.log(`進捗: ${Object.keys(results).length}件処理`);
    }
  }

  await browser.close();
  console.log(`完了: 合計${Object.keys(results).length}件`);
})();
