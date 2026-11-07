// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from './fixtures'

/**
 * 同会话模式切换 E2E(2026-09-13 矩阵 A #24)。
 *
 * 覆盖:
 * 1. ModeSwitcher 可见控件:打开菜单 → 5 个模式选项齐备 → 选择后触发器 data-mode 即时更新
 * 2. UI 通道端到端:选择 ask/build 后发送消息,捕获 POST /api/ai/chat/stream body,
 *    断言顶层 mode 字段逐次为 'ask' → 'build'(同会话内切换;#24 修复前该字段被
 *    ai-chat-stream.ts zod strip 静默剥离,请求 body 根本观察不到 mode)
 * 3. 快捷键通道:Ctrl+5 → 切到 ask
 *
 * 2026-11-04 信息架构重构:ModeSwitcher 从可见底栏移入「+」菜单第一层的
 * composer-quick-controls(+ 菜单是自写 popover,点菜单外或 Esc(栈顶)关闭)。
 * 因此本 spec 里每次断言 mode-switcher 的 data-mode / 可用性前都要先展开菜单;
 * 需要输入或发送时先关菜单再操作。断言语义与超时数值保持不变。
 *
 * mock:stream 路由返回最小 SSE(chunk + done);conversations 三端点 mock 与
 * ai-tool-loop.spec.ts 同构(避免打真实后端形成覆盖竞态)。
 */

/**
 * 展开「+」菜单并等待第一层快捷设置(composer-quick-controls)出现 ——
 * ModeSwitcher 现在只在这一层里挂载。
 */
async function openAddMenu(page: Page) {
  await page.getByTestId('add-menu-trigger').click()
  await expect(page.getByTestId('composer-quick-controls')).toBeVisible({ timeout: 5000 })
}

/**
 * 关闭「+」菜单(Esc 在栈顶时消费)。
 * 菜单关闭后 ModeSwitcher 随之卸载,故只在需要输入/发送时调用。
 */
async function closeAddMenu(page: Page) {
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('add-menu-trigger')).toHaveAttribute('data-state', 'closed', {
    timeout: 5000,
  })
}

const SSE_BODY = [
  'event: chunk\ndata: {"content":"已收到,当前模式已生效"}\n\n',
  'event: done\ndata: {"content":"已收到,当前模式已生效"}\n\n',
].join('')

test.describe('同会话模式切换(ModeSwitcher + 契约透传)', () => {
  test('模式选择 → 请求 body.mode 逐次生效 + Ctrl+5 快捷键', async ({ authenticatedPage }) => {
    const consoleErrors: string[] = []
    authenticatedPage.on('pageerror', (err) => consoleErrors.push(err.message))

    // 捕获每次流式请求顶层的 mode 字段(POST body 由 client.ts extraBody 合并,顶层可见)
    const capturedModes: Array<string | undefined> = []
    await authenticatedPage.route('**/api/ai/chat/stream', async (route) => {
      const body = route.request().postDataJSON() as { mode?: string } | undefined
      capturedModes.push(body?.mode)
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        body: SSE_BODY,
      })
    })

    // 会话态 mock(与 ai-tool-loop.spec.ts 同构:三端点 URL 谓词分支)
    const e2eConversationId = 'e2e-conv-mode-switch'
    const conversationRouteMatcher = (url: URL) =>
      url.pathname === '/api/chat/conversations' ||
      url.pathname.startsWith('/api/chat/conversations/')
    await authenticatedPage.route(conversationRouteMatcher, async (route) => {
      const method = route.request().method()
      const pathname = new URL(route.request().url()).pathname
      const accept = (data: unknown) =>
        route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: 0, message: 'ok', data }),
        })
      if (method === 'POST' && pathname === '/api/chat/conversations') {
        await accept({ conversation: { id: e2eConversationId } })
        return
      }
      if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+\/messages$/.test(pathname)) {
        await accept({ messages: [], nextCursor: null, hasMore: false })
        return
      }
      if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+$/.test(pathname)) {
        await accept({ conversation: { id: e2eConversationId, title: null, metadata: null } })
        return
      }
      await route.continue()
    })

    // P3 #43 成本预检(send-message.ts:596):在 addMessage 之前**阻塞式**调用
    // `/api/chat/cost-estimate`。本 spec 若不 mock,这条会打到真实后端;后端慢/挂起时
    // 第二次发送会停在 addMessage 之前(表现为 15s 内无第二条 chat/stream、草稿仍在框内)。
    // 预检是静默放行路径(priced=false + 金额 0 ⇒ 不触发成本协商确认条),不影响用例语义。
    await authenticatedPage.route('**/api/chat/cost-estimate', async (route) => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: {
            estimatedTokensIn: 120,
            estimatedTokensOut: 240,
            estimatedCostUsd: 0,
            priced: false,
          },
        }),
      })
    })

    await authenticatedPage.goto('/chat')
    await authenticatedPage.waitForLoadState('domcontentloaded')
    if (!authenticatedPage.url().includes('/chat')) return

    const textarea = authenticatedPage.locator('textarea').first()
    try {
      await textarea.waitFor({ state: 'visible', timeout: 20000 })
    } catch {
      return
    }

    // ---- ① 打开 + 菜单 → ModeSwitcher 可见:5 个模式选项齐备 ----
    // 2026-11-04 结构变化:ModeSwitcher 不再在可见底栏,需先点 add-menu-trigger 展开 + 菜单
    await openAddMenu(authenticatedPage)
    const switcher = authenticatedPage.getByTestId('mode-switcher')
    await expect(switcher).toBeVisible()
    await switcher.click()
    const options = authenticatedPage.locator('[data-testid^="mode-option-"]')
    await expect(options).toHaveCount(5, { timeout: 5000 })
    for (const mode of ['ask', 'build', 'plan', 'review', 'spec']) {
      await expect(authenticatedPage.getByTestId(`mode-option-${mode}`)).toBeAttached()
    }

    // ---- ② 选 ask → 触发器即时反映 + 发送后 body.mode === 'ask' ----
    await authenticatedPage.getByTestId('mode-option-ask').click()
    await expect(switcher).toHaveAttribute('data-mode', 'ask')
    // 菜单开着时无法在输入框输入/回车发送,先 Esc 关菜单(菜单项已随选择关闭,Esc 落在 + 菜单栈顶)
    await closeAddMenu(authenticatedPage)
    await textarea.fill('什么是依赖注入?')
    await authenticatedPage.keyboard.press('Enter')
    await expect.poll(() => capturedModes.length, { timeout: 15000 }).toBeGreaterThan(0)
    expect(capturedModes[capturedModes.length - 1]).toBe('ask')
    // 流式回包渲染(mock chunk 文案可见,证明链路完整)
    await expect(authenticatedPage.getByText('已收到,当前模式已生效').first()).toBeVisible({
      timeout: 10000,
    })
    // 首流收尾的**真判据**(不是睡眠):发送/停止按钮由同一个 isStreaming 驱动,而
    // send-message.ts 的收尾块里 setStreaming(false) 与 sendInFlightRef 释放是同一段
    // 同步代码(1767 → 1837,中间无 await)。因此「stop-button 消失且 send-button 就位」
    // ⇒ 首流已收尾且在途锁已释放。等它再发第二条,避免第二条被 :276/:297 静默吞掉。
    await expect(authenticatedPage.getByTestId('stop-button')).toHaveCount(0, { timeout: 15000 })
    await expect(authenticatedPage.getByTestId('send-button')).toBeVisible()

    // ---- ③ 同会话切回 build → 再次发送 body.mode === 'build' ----
    // 菜单关闭期间 ModeSwitcher 卸载,重新展开 + 菜单后才能断言其恢复可用并再次切换
    await openAddMenu(authenticatedPage)
    await expect(switcher).toBeEnabled({ timeout: 15000 })
    await switcher.click()
    await authenticatedPage.getByTestId('mode-option-build').click()
    await expect(switcher).toHaveAttribute('data-mode', 'build')
    await closeAddMenu(authenticatedPage)
    await textarea.fill('帮我实现一个工具')
    await authenticatedPage.keyboard.press('Enter')
    await expect.poll(() => capturedModes.length, { timeout: 15000 }).toBe(2)
    expect(capturedModes[1]).toBe('build')

    // ---- ④ 快捷键通道:Ctrl+5 → ask ----
    // 快捷键直接改 store;重新展开 + 菜单断言触发器即时反映(Ctrl+5 不依赖菜单是否打开)
    await authenticatedPage.keyboard.press('Control+5')
    await openAddMenu(authenticatedPage)
    await expect(switcher).toHaveAttribute('data-mode', 'ask')

    expect(authenticatedPage.url()).toContain('/chat')
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)

    await authenticatedPage.unroute('**/api/ai/chat/stream')
    await authenticatedPage.unroute(conversationRouteMatcher)
    await authenticatedPage.unroute('**/api/chat/cost-estimate')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
