// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:PLACEHOLDER

import { expect } from '@playwright/test'
import { test } from './fixtures'

/**
 * /developer/ide — IDE 编辑器工作区冒烟测试。
 *
 * 覆盖:
 * 1. 页面加载,IDE 骨架(布局容器/状态栏)渲染
 * 2. Monaco 编辑器渲染(有文件 → .monaco-editor;无文件 → 编辑区容器可见)
 * 3. 终端面板(Ctrl+` 切换 → xterm 视口)
 * 4. 无 fatal JS 错误(pageerror)
 */

test.describe('IDE 编辑器工作区', () => {
  test('IDE 页面加载且骨架元素可见', async ({ adminPage: page }) => {
    await page.goto('/developer/ide')

    // 页面路由命中:不再跳转登录
    await expect(page).toHaveURL(/developer\/ide/)

    // IDE 布局容器渲染(IDEPage: div.px-4.h-full > IDELayout flex 列)
    const ideRoot = page.locator('div.px-4.h-full').first()
    await expect(ideRoot).toBeVisible()

    // 状态栏(h-6 深色条)存在 — IDE 骨架最底部元素
    await expect(page.locator('div.flex.h-6.shrink-0').first()).toBeVisible()
  })

  test('Monaco 编辑器渲染(打开文件)或编辑器空态兜底', async ({ adminPage: page }) => {
    await page.goto('/developer/ide')
    await expect(page).toHaveURL(/developer\/ide/)

    // 编辑区容器可见;Monaco 挂载 .monaco-editor(首次加载本地 /vs loader,放宽 20s);
    // 工作区无打开文件时显示编辑器空态 — 两者任一即可
    const editorArea = page.locator('div.relative.flex.flex-1.overflow-hidden').first()
    await expect(editorArea).toBeVisible()

    const monaco = page.locator('.monaco-editor')
    if ((await monaco.count()) > 0) {
      await expect(monaco.first()).toBeVisible({ timeout: 20000 })
    }
  })

  test('终端面板 Ctrl+` 切换后 xterm 视口出现', async ({ adminPage: page }) => {
    await page.goto('/developer/ide')
    await expect(page).toHaveURL(/developer\/ide/)

    // 打开终端视图:ViewSwitcher(Plus 按钮)弹层 → 点击"终端"项;Ctrl+` 作为兜底
    const plusTrigger = page.locator('div.relative > button:has(svg.lucide-plus)').first()
    await plusTrigger.click()
    const terminalItem = page.getByRole('button', { name: /终端|Terminal/i }).first()
    if (await terminalItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      await terminalItem.click()
    } else {
      await page.keyboard.press('Control+`')
    }

    // xterm 终端实例挂载 .xterm 容器(WS 未连接也渲染 DOM)
    const xterm = page.locator('.xterm')
    await expect(xterm.first()).toBeVisible({ timeout: 15000 })
  })

  test('无 fatal JS 运行时错误', async ({ adminPage: page }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (err) => {
      const msg = String(err?.message ?? err)
      // 过滤已知非致命噪音
      if (!msg.includes('ResizeObserver') && !msg.includes('Script error')) {
        pageErrors.push(msg)
      }
    })

    await page.goto('/developer/ide')
    await expect(page).toHaveURL(/developer\/ide/)

    // 交互预热:切一次终端再回来,覆盖主要挂载/卸载路径
    await page.keyboard.press('Control+`')
    await page.waitForTimeout(1000)
    await page.keyboard.press('Control+`')

    // 留出异步错误收集窗口
    await page.waitForTimeout(2000)
    expect(pageErrors, `pageerror 收集: ${pageErrors.join(' | ')}`).toHaveLength(0)
  })
})
