import { test, expect } from './fixtures'

/**
 * 新建任务入口统一守门(2026-08-29 迁移整合)。
 *
 * 背景:AI 面板 header"新建任务"按钮已移除,入口统一到侧边栏 SidebarQuickActions
 * "新建任务"按钮:streaming 门控 + 自动开面板 + 会话重置全部收敛到
 * ai-side-panel 对 global-shortcut:new-chat 的单点监听(DRY)。
 * 三个入口:① 侧边栏按钮 ② Ctrl+Shift+N ③ Tauri 桌面端快捷键(浏览器 e2e 不覆盖)。
 *
 * 守门回归:
 *   - 面板关闭态点击侧边栏"新建任务"→ 自动重开面板(aria-pressed 翻转 + aside 重新可见)
 *   - Ctrl+Shift+N → 跳转 /chat(global-hooks-provider SHORTCUT_ROUTES 互补消费)+ 面板打开
 */
test.describe('新建任务入口统一守门', () => {
  // dev 环境偶发浏览器崩溃,与 sidebar-visual 同策略加 1 次重试兜底
  test.describe.configure({ retries: 1 })

  const newTaskBtn = 'aside#main-sidebar button[aria-pressed]'
  const panelAside = '[data-testid="ai-side-panel-aside"]'

  test('面板关闭态:点击侧边栏"新建任务"→ 自动重开面板 + aria-pressed 翻转', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/')
    const btn = page.locator(newTaskBtn).first()
    await expect(btn).toBeVisible({ timeout: 15000 })
    // 默认面板打开(ai-panel store open 强制默认 true)
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(panelAside)).toBeVisible()

    // 关闭 AI 面板(header 右侧 X,aria-label = common.close)。
    // 用 getByLabel 正则(CSS 属性正则 button[aria-label=/…/] 会 SyntaxError)
    await page
      .locator(panelAside)
      .getByLabel(/^(关闭|Close)$/i)
      .first()
      .click()
    // 面板关闭:aside 从 DOM 移除(if (!open) 分支只渲染 width:0 手柄容器),aria-pressed 同步翻转
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await expect(page.locator(panelAside)).toBeHidden()

    // 点击侧边栏"新建任务"→ 监听器自动 openPanel + handleNewChat(面板关闭也能立即触达)
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(panelAside)).toBeVisible()
  })

  test('Ctrl+Shift+N:跳转 /chat + 面板打开(与按钮入口行为一致)', async ({
    authenticatedPage: page,
  }) => {
    await page.goto('/')
    const btn = page.locator(newTaskBtn).first()
    await expect(btn).toBeVisible({ timeout: 15000 })

    // use-global-shortcuts:Ctrl+Shift+N → 派发 global-shortcut:new-chat
    // → ai-side-panel 监听器(openPanel + handleNewChat)
    // + global-hooks-provider SHORTCUT_ROUTES(非 /chat 页 → router.push('/chat'))
    await page.keyboard.press('Control+Shift+N')
    await expect(page).toHaveURL(/\/chat/, { timeout: 10000 })
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.locator(panelAside)).toBeVisible()
  })
})
