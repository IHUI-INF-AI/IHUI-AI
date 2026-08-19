/**
 * IHUI AI 分享功能浏览器自动化验证
 * 通过 Playwright 直接调用，模拟用户完整流程
 */
import { test, expect } from '@playwright/test';
import { request } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

const WEB_URL = 'http://localhost:8801';
const API_URL = 'http://localhost:8802';
const SCREENSHOT_DIR = path.join(process.cwd(), 'e2e', 'test-screenshots');

test.describe('分享功能验证', () => {
  let accessToken: string;
  let refreshToken: string;
  let conversationId: string;
  let conversationTitle: string;
  let shareToken: string;

  test.beforeAll(async () => {
    // 确保截图目录存在
    await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
  });

  test('完整分享流程验证', async ({ browser }) => {
    console.log('[Test] 开始执行分享功能验证\n');

    // ========== Step 1: API 登录 ==========
    console.log('[Step 1] API 登录...');
    const httpReq = await request.newContext();
    const loginResp = await httpReq.post(`${API_URL}/api/auth/login`, {
      data: { account: 'admin', password: 'admin123' },
    });
    expect(loginResp.ok()).toBe(true);
    const loginBody = await loginResp.json();
    expect(loginBody.code).toBe(0);
    accessToken = loginBody.data.accessToken;
    refreshToken = loginBody.data.refreshToken;
    console.log(`    ✓ accessToken 长度: ${accessToken.length}\n`);
    await httpReq.dispose();

    // ========== Step 2: 创建认证上下文 ==========
    console.log('[Step 2] 创建认证浏览器上下文...');
    const storageState = {
      cookies: [
        { name: 'auth_token', value: accessToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
        { name: 'token', value: accessToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
        { name: 'refresh_token', value: refreshToken, domain: 'localhost', path: '/', httpOnly: false, secure: false, sameSite: 'Lax' as const, expires: -1 },
      ],
      origins: [{
        origin: WEB_URL,
        localStorage: [
          { name: 'token', value: accessToken },
          { name: 'refresh_token', value: refreshToken },
          { name: 'user', value: JSON.stringify({
            accessToken, refreshToken, expiresIn: 900, refreshExpiresIn: 2592000,
            user: { id: '6b8cd0f6-546f-44c8-853a-5f96edbe08be', phone: '18643389808', email: '502319984@qq.com', username: 'admin', nickname: '系统管理员', avatar: '/images/logo.png?v=20260719-unify', bio: '', gender: 0, birthday: '', familyId: '', roleId: 1, status: 1, isVip: 99, level: 0, inviteCode: '', parentId: '', createdAt: '2026-07-16T15:31:16.704Z', updatedAt: '2026-08-01T13:59:32.482Z', permissions: ['*:*:*'] }
          })},
        ],
      }],
    };
    const context = await browser.newContext({ storageState });
    console.log('    ✓ 认证上下文已创建\n');

    // ========== Step 3: 获取对话列表 ==========
    console.log('[Step 3] 获取对话列表...');
    const convReq = await request.newContext();
    const cr = await convReq.get(`${API_URL}/api/chat/conversations?page=1&pageSize=10`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(cr.ok()).toBe(true);
    const convBody = await cr.json();
    expect(convBody.code).toBe(0);
    const conversations = convBody.data?.conversations ?? [];
    console.log(`    找到 ${conversations.length} 个对话`);
    expect(conversations.length).toBeGreaterThan(0);

    const conv = conversations.find((c: any) => c.id && c.title);
    expect(conv).toBeDefined();
    conversationId = conv.id;
    conversationTitle = conv.title;
    console.log(`    ✓ 选择对话: "${conversationTitle}" (ID: ${conversationId})\n`);
    await convReq.dispose();

    // ========== Step 4: 通过 API 生成分享 token ==========
    console.log('[Step 4] 生成分享 token...');
    const shareReq = await request.newContext();
    const sr = await shareReq.post(`${API_URL}/api/chat/conversations/${conversationId}/share`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(sr.ok()).toBe(true);
    const shareBody = await sr.json();
    expect(shareBody.code).toBe(0);
    shareToken = shareBody.data.token;
    expect(shareToken).toBeDefined();
    expect(shareToken.length).toBe(16);
    console.log(`    ✓ Token: ${shareToken}\n`);
    await shareReq.dispose();

    // ========== Step 5: 打开分享页面 ==========
    console.log('[Step 5] 打开分享页面...');
    const sharePage = await context.newPage();
    const shareUrl = `${WEB_URL}/chat/share/${shareToken}`;
    await sharePage.goto(shareUrl);
    await sharePage.waitForTimeout(2000);

    const shareTitle = await sharePage.title();
    const shareContent = await sharePage.evaluate(() => document.body?.innerText?.slice(0, 1000) ?? '');
    const hasTitle = shareContent.includes(conversationTitle);

    console.log(`    分享页面标题: ${shareTitle}`);
    console.log(`    包含对话标题: ${hasTitle ? '✓ 是' : '✗ 否'}`);
    console.log(`    内容预览: ${shareContent.substring(0, 200)}...\n`);

    // 截图
    await sharePage.screenshot({ path: path.join(SCREENSHOT_DIR, 'share-page.png'), fullPage: true });
    console.log('    截图已保存: share-page.png');

    // 检查是否有"复制链接"按钮
    const copyBtn = sharePage.locator('button:has-text("复制链接")');
    const copyBtnVisible = await copyBtn.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`    复制链接按钮可见: ${copyBtnVisible ? '✓ 是' : '✗ 否'}\n`);

    await sharePage.close();

    // ========== Step 6: 测试前端分享按钮 UI ==========
    console.log('[Step 6] 测试前端分享按钮流程...');
    const mainPage = await context.newPage();
    await mainPage.goto(`${WEB_URL}/chat/${conversationId}`);
    await mainPage.waitForTimeout(3000);

    // 截图 - 对话页面
    await mainPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'chat-page.png'), fullPage: true });
    console.log('    对话页面截图已保存: chat-page.png');

    // 等待消息加载
    await mainPage.waitForTimeout(2000);

    // 查找消息区域中的分享按钮
    console.log('    查找分享按钮...');
    let shareBtnFound = false;
    let toastTexts: string[] = [];

    // 尝试多种选择器
    const selectors = [
      'button[aria-label*="分享"]',
      'button[title*="分享"]',
      'button svg[data-testid*="share"]',
      'button i[class*="share"]',
      'button span:has-text("分享")',
    ];

    for (const sel of selectors) {
      const btns = mainPage.locator(sel);
      const count = await btns.count().catch(() => 0);
      if (count > 0) {
        console.log(`    找到 ${count} 个 "${sel}" 元素`);
        // 点击第一个
        await btns.first().click();
        shareBtnFound = true;
        break;
      }
    }

    await mainPage.waitForTimeout(2000);

    // 检查 toast
    console.log('\n[Step 7] 检查 toast 提示...');
    toastTexts = await mainPage.evaluate(() => {
      const selectors = ['.sonner-toast', '[class*="toast"]', '[class*="Toast"]', '[role="alert"]'];
      const results: string[] = [];
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          const t = el.textContent?.trim();
          if (t && t.length > 0 && !results.includes(t)) results.push(t);
        });
      }
      return results;
    });

    console.log(`    Toast 文字: ${JSON.stringify(toastTexts)}`);

    const isSuccess = toastTexts.some(t => t.includes('已复制') || t.includes('copied') || t.includes('成功'));
    const isFail = toastTexts.some(t => t.includes('失败') || t.includes('error'));

    console.log(`    成功提示: ${isSuccess ? '✓ 是' : '未检测到'}`);
    console.log(`    失败提示: ${isFail ? '✗ 检测到' : '✓ 无'}`);

    // 截图
    await mainPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'toast-check.png'), fullPage: true });

    // 检查剪贴板
    console.log('\n[Step 8] 检查剪贴板...');
    const clipboardContent = await mainPage.evaluate(async () => {
      try {
        if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
        return null;
      } catch (e) { return `Error: ${(e as Error).message}`; }
    });

    console.log(`    剪贴板: ${clipboardContent ? clipboardContent.substring(0, 200) + '...' : '(空)'}`);

    // 截图
    await mainPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'clipboard-check.png'), fullPage: true });

    // 最终截图
    await mainPage.screenshot({ path: path.join(SCREENSHOT_DIR, 'final-result.png'), fullPage: true });
    console.log('    最终截图已保存: final-result.png');

    await mainPage.close();
    await context.close();

    // ========== 结果汇总 ==========
    console.log('\n===== 验证结果 =====');
    console.log(`1. 登录状态:        ✓ 成功`);
    console.log(`2. 对话选择:        ${conversationTitle ? `"${conversationTitle}" ✓` : '无可用对话 ✗'}`);
    console.log(`3. 分享按钮点击:    ${shareBtnFound ? '✓ 已点击' : '⚠ 未找到（可能需手动 hover）'}`);
    console.log(`4. Toast 提示:     ${toastTexts.length > 0 ? JSON.stringify(toastTexts) : '未显示'}`);
    console.log(`   - 成功:          ${isSuccess ? '✓ 是' : '未检测到'}`);
    console.log(`   - 失败:          ${isFail ? '✗ 是' : '✓ 无'}`);
    console.log(`5. 剪贴板:          ${clipboardContent ? '✓ 已写入' : '未写入或为空'}`);
    console.log(`6. 分享页面:        ${shareToken ? '✓ 已生成并访问' : '生成失败'}`);
    console.log(`   - 标题匹配:      ${hasTitle ? '✓ 是' : '✗ 否'}`);
    console.log('====================\n');
  });
});
