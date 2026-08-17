import { test, expect } from '@playwright/test';

test('check chat page error', async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  await page.goto('http://localhost:8801/chat', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(3000);

  const content = await page.content();
  const hasErrorText = content.includes('应用发生严重错误') || content.includes('严重错误');

  console.info('=== PAGE CHECK RESULTS ===');
  console.info('Has error text:', hasErrorText);
  console.info('Page title:', await page.title());
  console.info('Console errors count:', consoleErrors.length);
  console.info('Page errors count:', pageErrors.length);

  if (consoleErrors.length > 0) {
    console.info('Console errors:', JSON.stringify(consoleErrors.slice(0, 20), null, 2));
  }

  if (pageErrors.length > 0) {
    console.info('Page errors:', JSON.stringify(pageErrors, null, 2));
  }

  await page.screenshot({ path: 'g:/IHUI-AI/chat_page_check.png', fullPage: true });
  console.info('Screenshot saved to g:/IHUI-AI/chat_page_check.png');

  expect.hasAssertions();
});
