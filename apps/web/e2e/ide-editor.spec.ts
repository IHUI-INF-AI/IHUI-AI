// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
    // 2026-10-31:把"创建终端会话"这条请求的答复带进失败信息 —— `.xterm` 缺席有三种成因
    // (403=管理员 TOTP 闸 / 501=node-pty 缺失 / 200=产品侧渲染缺陷),此前三者同形,
    // 被连续两轮读成"产品渲染问题"。断言本身一条不减,只让红的时候能判死。
    const sessionPosts: string[] = []
    page.on('response', (r) => {
      if (r.request().method() !== 'POST') return
      if (!r.url().includes('/api/terminal/sessions')) return
      sessionPosts.push(String(r.status()))
    })
    await page.goto('/developer/ide')
    await expect(page).toHaveURL(/developer\/ide/)

    // 打开终端视图:IDE 顶栏的 ViewSwitcher(Plus 按钮)弹层 → 点击"终端"项。
    // 2026-11-04 确定性归因(CI run 41779865086 三次尝试同形):
    // 全局顶栏 GlobalTopBar 也有一个 Plus「添加视图」,且在 DOM 中先于 main(IDE 顶栏在其内),
    // 旧的 `div.relative > button:has(svg.lucide-plus)` 取 .first() 点中的是**全局视图菜单**;
    // 该菜单项是 role=menuitem(名"终端"的那项切 WorkPanel 标签,不挂载 IDE 终端),
    // `getByRole('button')` 找不到 → 落 Ctrl+` 兜底,而全局菜单仍开着、焦点在菜单搜索框,
    // 快捷键被菜单消费 ⇒ 助手区没切终端视图,`.xterm` 永不出现、POST 一次都没发出
    // (失败工件快照里 menu 展开 + IDE 主区停在编辑器空态,即此形)。
    // 修正:触发器限定在 main(IDE 顶栏必在 main 内,全局顶栏在其外);菜单项改硬断言,
    // 不再静默兜底 —— 兜底与弹层渲染本就存在竞态,是上一版 flaky 的来源。
    const ideRoot = page.locator('main').first()
    const plusTrigger = ideRoot.locator('div.relative > button:has(svg.lucide-plus)').first()
    await plusTrigger.click()
    const terminalItem = page.getByRole('button', { name: /终端|Terminal/i }).first()
    await expect(
      terminalItem,
      'IDE ViewSwitcher 弹层未出现"终端"项(role=button)——若命中全局"添加视图"菜单,其项为 menuitem',
    ).toBeVisible({ timeout: 5000 })
    await terminalItem.click()

    // xterm 终端实例挂载 .xterm 容器(WS 未连接也渲染 DOM)
    const xterm = page.locator('.xterm')
    await expect(
      xterm.first(),
      `xterm 未挂载;POST /api/terminal/sessions 答复=${
        sessionPosts.join(',') || '未观测到'
      }(403=管理员 TOTP 闸,见 require-permission.ts 的 checkAdminTotpGate;501=node-pty 缺失;200=产品侧 TerminalViewport 未挂载)`,
    ).toBeVisible({ timeout: 15000 })
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
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
