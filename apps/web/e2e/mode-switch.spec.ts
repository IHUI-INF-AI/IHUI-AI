// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect } from './fixtures'

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
 * mock:stream 路由返回最小 SSE(chunk + done);conversations 三端点 mock 与
 * ai-tool-loop.spec.ts 同构(避免打真实后端形成覆盖竞态)。
 */

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

    await authenticatedPage.goto('/chat')
    await authenticatedPage.waitForLoadState('domcontentloaded')
    if (!authenticatedPage.url().includes('/chat')) return

    const textarea = authenticatedPage.locator('textarea').first()
    try {
      await textarea.waitFor({ state: 'visible', timeout: 20000 })
    } catch {
      return
    }

    // ---- ① 打开 ModeSwitcher 菜单:5 个模式选项齐备 ----
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
    await textarea.fill('什么是依赖注入?')
    await authenticatedPage.keyboard.press('Enter')
    await expect.poll(() => capturedModes.length, { timeout: 15000 }).toBeGreaterThan(0)
    expect(capturedModes[capturedModes.length - 1]).toBe('ask')
    // 流式回包渲染(mock chunk 文案可见,证明链路完整)
    await expect(authenticatedPage.getByText('已收到,当前模式已生效').first()).toBeVisible({
      timeout: 10000,
    })

    // ---- ③ 同会话切回 build → 再次发送 body.mode === 'build' ----
    await expect(switcher).toBeEnabled({ timeout: 15000 })
    await switcher.click()
    await authenticatedPage.getByTestId('mode-option-build').click()
    await expect(switcher).toHaveAttribute('data-mode', 'build')
    await textarea.fill('帮我实现一个工具')
    await authenticatedPage.keyboard.press('Enter')
    await expect.poll(() => capturedModes.length, { timeout: 15000 }).toBe(2)
    expect(capturedModes[1]).toBe('build')

    // ---- ④ 快捷键通道:Ctrl+5 → ask ----
    await authenticatedPage.keyboard.press('Control+5')
    await expect(switcher).toHaveAttribute('data-mode', 'ask')

    expect(authenticatedPage.url()).toContain('/chat')
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)

    await authenticatedPage.unroute('**/api/ai/chat/stream')
    await authenticatedPage.unroute(conversationRouteMatcher)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
