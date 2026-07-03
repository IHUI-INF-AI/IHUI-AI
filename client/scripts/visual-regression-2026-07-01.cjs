/**
 * Playwright 视觉回归 (2026-07-01 颜色修复后)
 * 覆盖：sidebar / AI panel (空 + 已进入) / chat history / login / floating chat / modals / 暗色按钮
 * 预期：所有继承 --ai-panel-content-bg / --app-hover-bg / sidebar 视觉层级的组件
 *       浅色 + 暗色 都符合 project_memory.md 定义的视觉层级
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.join(__dirname, '..', 'test-results', 'regression-2026-07-01');
if (!fs.existsSync(SCREENSHOT_DIR)) fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const HEX = (rgb) => {
  if (!rgb) return null;
  const m = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (!m) {
    // 已经是 hex 形式 (#abc 或 #abcdef)
    if (rgb.startsWith('#')) {
      let hex = rgb.toLowerCase();
      // 把 #abc 扩展为 #aabbcc
      if (hex.length === 4) {
        hex = '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
      }
      return hex;
    }
    return null;
  }
  const r = parseInt(m[1]);
  const g = parseInt(m[2]);
  const b = parseInt(m[3]);
  const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
  if (a === 0) return 'rgba(0,0,0,0)'; // 透明特殊标记
  return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('');
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const results = { light: {}, dark: {} };

  for (const mode of ['light', 'dark']) {
    console.log(`\n═══════ ${mode === 'light' ? '浅色' : '暗色'} 模式 ═══════`);
    await page.goto('http://localhost:8888/', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.evaluate((m) => {
      localStorage.setItem('darkMode', m);
      localStorage.setItem('pinia-darkMode', JSON.stringify({ themeMode: m }));
    }, mode);
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(2500);

    if (mode === 'dark') {
      await page.evaluate(() => document.documentElement.classList.add('dark'));
      await page.waitForTimeout(300);
    }
    // 清理弹窗遮罩
    await page.evaluate(() => {
      document.querySelectorAll('.promotion-modal-overlay, .modal-overlay, .el-overlay, .el-message').forEach(el => el.remove());
    });
    await page.waitForTimeout(500);

    // 等关键元素出现 (最多 10 秒)
    await page.waitForSelector('.app-sidebar', { timeout: 10000 });
    await page.waitForSelector('.nav-item', { timeout: 10000 });
    // 等所有 CSS 加载完成
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(800);

    // === 核心组件取色 ===
    results[mode] = await page.evaluate(() => {
      const cs = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const s = getComputedStyle(el);
        return {
          bg: s.backgroundColor,
          color: s.color,
          border: s.borderColor,
        };
      };
      // 优先从 :root 读 token（AI panel 可能 display:none 导致 getPropertyValue 失效）
      const rootStyle = getComputedStyle(document.documentElement);
      const csVar = (name) => rootStyle.getPropertyValue(name).trim();
      return {
        // 基础
        body: cs('body'),
        html: cs('html'),
        // Sidebar
        sidebar: cs('.app-sidebar'),
        // 浅色/暗色都可能命中（active / 非 active 状态）
        newChatBtn: cs('.nav-item.nav-new-chat'),
        // 默认态（非 active）
        newChatBtnDefault: cs('.nav-item.nav-new-chat:not(.active)'),
        activeNavItem: cs('.nav-item.active'),
        regularNavItem: cs('.nav-item:not(.active):not(.nav-new-chat)'),
        groupLabel: cs('.nav-group-label'),
        chatHistoryItem: cs('.chat-history-item'),
        // AI panel
        aiSidePanel: cs('.ai-side-panel'),
        aiSidePanelEmpty: cs('.ai-side-panel-empty'),
        aiSidePanelBody: cs('.ai-side-panel-body'),
        // 关键 token 值（从 :root 读，最可靠）
        tokens: {
          aiPanelContentBg: csVar('--ai-panel-content-bg'),
          elBg: csVar('--el-bg-color'),
          pageBg: csVar('--page-bg-color'),
          appHoverBg: csVar('--app-hover-bg') || csVar('--sidebar-color-hover'),
          appHoverBorder: csVar('--app-hover-border') || csVar('--sidebar-border-color'),
          // 侧边栏设计 tokens
          appSidebarColorSurface: csVar('--app-sidebar-color-surface'),
          appSidebarColorNewChat: csVar('--app-sidebar-color-new-chat'),
          appSidebarColorActive: csVar('--app-sidebar-color-active'),
          appSidebarColorHover: csVar('--app-sidebar-color-hover'),
          appSidebarBorderColor: csVar('--app-sidebar-border-color'),
        },
      };
    });

    // 截图
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${mode}-01-full-page.png`) });
    const sidebar = await page.locator('.app-sidebar').first();
    if (await sidebar.count() > 0) await sidebar.screenshot({ path: path.join(SCREENSHOT_DIR, `${mode}-02-sidebar.png`) });
    const aiPanel = await page.locator('.ai-side-panel').first();
    if (await aiPanel.count() > 0) await aiPanel.screenshot({ path: path.join(SCREENSHOT_DIR, `${mode}-03-ai-panel.png`) });
  }

  // === 验证：浅色 + 暗色 关键 token 与视觉层级 ===
  const checks = [];
  const C = (name, mode, actual, expected) => checks.push({ name, mode, actual, expected, pass: actual === expected });

  // ─── 暗色模式 token 验证 ───
  const dark = results.dark;
  C('暗色 --ai-panel-content-bg 必须是 #1a1a1a', 'dark', HEX(dark.tokens.aiPanelContentBg), '#1a1a1a');
  C('暗色 --app-sidebar-color-surface 必须是 #6a6d77', 'dark', HEX(dark.tokens.appSidebarColorSurface), '#6a6d77');
  C('暗色 --app-sidebar-color-new-chat 必须是 #5a5d67', 'dark', HEX(dark.tokens.appSidebarColorNewChat), '#5a5d67');
  C('暗色 --app-sidebar-color-active 必须是 #4f5259', 'dark', HEX(dark.tokens.appSidebarColorActive), '#4f5259');
  C('暗色 --app-sidebar-color-hover 必须是 #000000', 'dark', HEX(dark.tokens.appSidebarColorHover), '#000000');
  C('暗色 sidebar 必须是 #6a6d77', 'dark', HEX(dark.sidebar?.bg), '#6a6d77');
  C('暗色 ai-side-panel 背景 必须是 #1a1a1a', 'dark', HEX(dark.aiSidePanel?.bg), '#1a1a1a');
  C('暗色 ai-side-panel-empty 继承 #1a1a1a', 'dark', HEX(dark.aiSidePanelEmpty?.bg) || 'rgba(0,0,0,0)', 'rgba(0,0,0,0)');
  C('暗色 --app-hover-bg 必须是 #000000 (纯黑)', 'dark', HEX(dark.tokens.appHoverBg), '#000000');

  // ─── 浅色模式 token 验证 ───
  const light = results.light;
  C('浅色 --ai-panel-content-bg 必须是 #ffffff', 'light', HEX(light.tokens.aiPanelContentBg), '#ffffff');
  C('浅色 --app-sidebar-color-surface 必须是 #f5f5f5', 'light', HEX(light.tokens.appSidebarColorSurface), '#f5f5f5');
  C('浅色 --app-sidebar-color-new-chat 必须是 #e8eaee', 'light', HEX(light.tokens.appSidebarColorNewChat), '#e8eaee');
  C('浅色 --app-sidebar-color-active 必须是 #d8dbe1', 'light', HEX(light.tokens.appSidebarColorActive), '#d8dbe1');
  C('浅色 --app-sidebar-color-hover 必须是 #c8ccd2', 'light', HEX(light.tokens.appSidebarColorHover), '#c8ccd2');
  C('浅色 sidebar 必须是 #f5f5f5', 'light', HEX(light.sidebar?.bg), '#f5f5f5');
  C('浅色 ai-side-panel 背景 必须是 #ffffff', 'light', HEX(light.aiSidePanel?.bg), '#ffffff');
  C('浅色 --app-hover-bg 必须是 #ffffff (纯白)', 'light', HEX(light.tokens.appHoverBg), '#ffffff');

  // ─── 输出 ───
  console.log('\n═══════ 验证结果 ═══════');
  let pass = 0, fail = 0;
  for (const c of checks) {
    const tag = c.pass ? '✓' : '✗';
    console.log(`  ${tag} [${c.mode}] ${c.name}`);
    console.log(`      实际: ${c.actual}  预期: ${c.expected}`);
    if (c.pass) pass++; else fail++;
  }
  console.log(`\n  通过: ${pass}/${checks.length}  失败: ${fail}`);

  // 保存结果 JSON
  fs.writeFileSync(
    path.join(SCREENSHOT_DIR, 'regression-results.json'),
    JSON.stringify({ results, checks, pass, fail }, null, 2)
  );

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
