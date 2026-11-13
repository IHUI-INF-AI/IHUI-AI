import { chromium } from 'playwright';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
await p.goto('http://127.0.0.1:4183/', { waitUntil: 'networkidle' });

const r = {};
r.title = await p.title();
r.sidebar = await p.locator('aside').first().isVisible();
r.newSessionBtn = await p.getByText('新会话').first().isVisible();
r.hero = await p.getByText('探索未至之境').isVisible();
r.composer = await p.locator('[data-composer-input]').isVisible();
r.sendBtn = await p.locator('[aria-label="发送"]').isVisible();
r.dialog = await p.locator('[role="dialog"]').isVisible();

// 关闭弹窗
await p.locator('[role="dialog"]').getByText('我知道了').or(p.locator('[role="dialog"] button')).last().click({ timeout: 3000 }).catch(()=>{});
await p.waitForTimeout(300);
r.dialogClosed = !(await p.locator('[role="dialog"]').isVisible().catch(()=>false));

// 输入并发送
await p.locator('[data-composer-input]').fill('测试消息');
const disabled = await p.locator('[aria-label="发送"]').isDisabled();
r.sendEnabledAfterInput = !disabled;
await p.locator('[aria-label="发送"]').click();
await p.waitForTimeout(400);
r.messageRendered = await p.getByText('测试消息').first().isVisible().catch(()=>false);

// 深色主题
const themeBtn = p.locator('button[aria-label*="深色"], button[aria-label*="浅色"]').first();
if (await themeBtn.count()) { await themeBtn.click(); await p.waitForTimeout(300);
  r.darkApplied = await p.evaluate(()=>document.documentElement.getAttribute('data-theme')==='dark' || getComputedStyle(document.body).backgroundColor.includes('21, 21, 23')); }

r.consoleErrors = errs.slice(0,5);
console.log(JSON.stringify(r,null,2));
await b.close();
