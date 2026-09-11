const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  });
  const page = await browser.newPage();

  await page.goto('https://x.com/kw1ew', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/claude-0/-home-user-SecondBrain/5ef4a6ef-f1ac-5566-aaf2-0fe9ad9b3f77/scratchpad/profile.png' });

  const mediaLink = page.getByRole('link', { name: /media/i }).first();
  if (await mediaLink.count() > 0) {
    await mediaLink.click();
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/claude-0/-home-user-SecondBrain/5ef4a6ef-f1ac-5566-aaf2-0fe9ad9b3f77/scratchpad/media.png' });
    console.log('Clicked Media tab, current URL:', page.url());
  } else {
    console.log('Media tab link not found. Current URL:', page.url());
  }

  await browser.close();
})();
