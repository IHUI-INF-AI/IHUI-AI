import { setupTest as test, expect } from './fixtures'
import type { Page } from '@playwright/test'

/**
 * AI 面板右上角三按钮 + 环境信息弹窗 + 工作展示区切换 E2E 测试 (2026-08-17 立)
 *
 * 覆盖已实现功能:
 * 1. header 三按钮存在且可见(环境信息 / 打开终端 / 切换工作展示区)
 * 2. 环境信息按钮打开弹窗(标题 + 内容分支 + 关闭)
 * 3. 切换工作展示区按钮 toggle WebWorkPanel
 *
 * 说明:
 * - 终端按钮(打开终端)仅断言存在,不测行为(终端 dock 尚未完成)。
 * - 环境信息弹窗的 git 数据依赖 activeWorkspace(顶部绑定工作区):
 *   无工作区 → env-info-no-workspace;有工作区 → env-info-row-changes / env-info-branch
 *   (数据加载可能慢,用 expect.poll 兜底;还可能渲染 not-repo / error 状态)。
 * - 所有测试用 fixtures 的 authenticatedPage(自动登录 test@aizhs.top)。
 */

/** 打开首页并等待 AI 面板(docked 默认 open)出现 */
async function openHome(page: Page) {
  await page.goto('/')
  await expect(page.locator('[data-testid="ai-side-panel-aside"]')).toBeVisible({ timeout: 10000 })
}

test.describe('AI panel env-info buttons', () => {
  test.setTimeout(60000)

  test('AI 面板 header 三按钮存在且可见', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    // 环境信息(SlidersHorizontal)→ 弹窗
    await expect(authenticatedPage.locator('button[aria-label="环境信息"]')).toBeVisible({
      timeout: 10000,
    })
    // 打开终端(SquareTerminal)→ 终端 dock(仅断言存在,行为未完成不测)
    await expect(authenticatedPage.locator('button[aria-label="打开终端"]')).toBeVisible({
      timeout: 10000,
    })
    // 切换工作展示区(PanelRight)→ WebWorkPanel toggle
    await expect(authenticatedPage.locator('button[aria-label="切换工作展示区"]')).toBeVisible({
      timeout: 10000,
    })
  })

  test('环境信息按钮打开弹窗', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    await authenticatedPage.locator('button[aria-label="环境信息"]').click()

    const popover = authenticatedPage.locator('[data-testid="env-info-popover"]')
    await expect(popover).toBeVisible({ timeout: 10000 })

    // 标题非空
    const title = popover.locator('[data-testid="env-info-title"]')
    await expect(title).toBeVisible({ timeout: 10000 })
    const titleText = await title.textContent()
    expect(titleText?.trim().length ?? 0).toBeGreaterThan(0)

    // 内容分支:无工作区(env-info-no-workspace)或有工作区(数据行)
    const noWorkspace = popover.locator('[data-testid="env-info-no-workspace"]')
    if ((await noWorkspace.count()) > 0) {
      // 未绑定工作区 → 显示提示,不调 git API
      await expect(noWorkspace).toBeVisible({ timeout: 10000 })
    } else {
      // 已绑定工作区 → git 数据可能加载慢;也可能为 not-repo / error,均视为已加载完成
      await expect
        .poll(
          () =>
            popover.locator(
              '[data-testid="env-info-row-changes"], [data-testid="env-info-branch"], [data-testid="env-info-not-repo"], [data-testid="env-info-error"]',
            ).count(),
          { timeout: 10000 },
        )
        .toBeGreaterThan(0)
    }

    // 关闭弹窗
    await popover.locator('[data-testid="env-info-close"]').click()
    await expect(popover).not.toBeVisible({ timeout: 10000 })
  })

  test('切换工作展示区按钮 toggle WebWorkPanel', async ({ authenticatedPage }) => {
    // 先导航到首页完成加载,再清空 work-panel persist(保证从隐藏态开始)
    await authenticatedPage.goto('/')
    await expect(authenticatedPage.locator('[data-testid="ai-side-panel-aside"]')).toBeVisible({
      timeout: 10000,
    })
    await authenticatedPage.evaluate(() => localStorage.removeItem('ihui-work-panel'))
    await authenticatedPage.reload()
    await expect(authenticatedPage.locator('[data-testid="ai-side-panel-aside"]')).toBeVisible({
      timeout: 10000,
    })

    const panel = authenticatedPage.locator('[data-testid="web-work-panel"]')
    const wpBtn = authenticatedPage.locator('button[aria-label="切换工作展示区"]')
    await expect(wpBtn).toBeVisible({ timeout: 10000 })

    // 初始隐藏(刚清空 persist)
    await expect(panel).not.toBeVisible({ timeout: 5000 })

    // 点击 → 打开
    await wpBtn.click()
    await expect(panel).toBeVisible({ timeout: 5000 })

    // 再点 → 关闭
    await wpBtn.click()
    await expect(panel).not.toBeVisible({ timeout: 5000 })
  })

  test('终端按钮展开/收起底部 PowerShell 终端停靠面板', async ({ authenticatedPage }) => {
    await openHome(authenticatedPage)

    const termBtn = authenticatedPage.locator('button[aria-label="打开终端"]')
    await expect(termBtn).toBeVisible({ timeout: 10000 })

    // 点击展开 dock(无 token 时 TerminalPanel 显示"登录后可用"占位,但 dock 容器必须出现)
    await termBtn.click()
    const dock = authenticatedPage.locator('[data-testid="ai-terminal-dock"]')
    await expect(dock).toBeVisible({ timeout: 10000 })

    // 工具栏:PowerShell 标题 + 新建终端 + 收起按钮
    await expect(dock.locator('span', { hasText: 'PowerShell' }).first()).toBeVisible({
      timeout: 10000,
    })
    await expect(dock.locator('button[aria-label="收起"]')).toBeVisible({ timeout: 10000 })

    // 再次点击终端按钮 → 收起
    await termBtn.click()
    await expect(dock).not.toBeVisible({ timeout: 10000 })
  })
})
