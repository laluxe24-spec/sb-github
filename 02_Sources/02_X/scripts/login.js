const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false,
    args: ['--disable-blink-features=AutomationControlled'],
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();
  await page.goto('https://x.com/i/flow/login', { waitUntil: 'load', timeout: 60000 });

  console.log('LOGIN_PAGE_OPEN: ブラウザでログインを完了してください。');

  // Poll for the actual auth_token cookie rather than trusting URL changes.
  const deadline = Date.now() + 10 * 60 * 1000;
  let authed = false;
  while (Date.now() < deadline) {
    const cookies = await context.cookies();
    if (cookies.some((c) => c.name === 'auth_token')) {
      authed = true;
      break;
    }
    await page.waitForTimeout(1500);
  }

  if (!authed) {
    console.error('LOGIN_TIMEOUT: auth_token cookie が確認できませんでした。');
    await browser.close();
    process.exit(1);
  }

  // Give the home timeline a moment to render, confirming logged-in state.
  await page.waitForTimeout(3000);

  await context.storageState({ path: 'auth.json' });
  console.log('LOGIN_SUCCESS: セッションを auth.json に保存しました。');

  await browser.close();
})().catch((err) => {
  console.error('LOGIN_FAILED:', err.message);
  process.exit(1);
});
