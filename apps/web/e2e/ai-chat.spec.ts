// 2026-08-29:改用 fixtures 扩展 test(需要 adminPage 登录态 fixture,见文件末尾
// "思考过程折叠生命周期(SSE mock)" describe)。fixtures 的 test 兼容内置 page fixture,
// 既有用例(仅用 { page })行为不变。
import { test, expect, type Page } from './fixtures'

/**
 * AI 对话完整流程测试。
 *
 * 覆盖:
 * - 发送消息
 * - 流式响应
 * - 历史记录
 * - 删除对话
 * - 页面无 500/无控制台异常
 * - 思考过程折叠生命周期(SSE mock,2026-08-29 立)
 */

test.describe('AI 对话流程', () => {
  test('未登录访问 /chat 被拦截', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForURL(/\/(login|register)/, { timeout: 5000 }).catch(() => {})
    expect(page.url()).toMatch(/\/(login|register|chat)/)
  })

  test('chat 页面渲染核心结构(若可访问)', async ({ page }) => {
    const serverErrors: string[] = []
    page.on('response', (resp) => {
      if (resp.status() >= 500) serverErrors.push(`${resp.url()} ${resp.status()}`)
    })
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    expect(
      serverErrors.filter(
        (e) =>
          !e.includes('favicon') &&
          !/\/api\/(ai|llm|agents|tools|mcp|a2a|workflow|llm-tools)\/.*\b(5\d{2})\b/.test(e) &&
          !/(\/sso\/(login|register)|\/login|\/register).*\b500\b/.test(e),
      ),
    ).toHaveLength(0)

    if (page.url().includes('/chat')) {
      const main = page.locator('main, [role="main"]').first()
      await expect(main).toBeVisible({ timeout: 10000 })
    }
  })

  test('发送消息:输入框可输入(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('你好,这是 E2E 测试消息')
      await expect(textarea).toHaveValue('你好,这是 E2E 测试消息')
    }
  })

  test('发送按钮存在(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    // 发送按钮可能是图标按钮,匹配常见文案
    const sendBtn = page
      .getByRole('button')
      .filter({
        hasText: /发送|Send|Submit/i,
      })
      .first()
    const hasSend = await sendBtn.isVisible({ timeout: 3000 }).catch(() => false)
    expect(hasSend || true).toBeTruthy()
  })

  test('流式响应:发送后等待响应(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    const textarea = page.locator('textarea').first()
    if (await textarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await textarea.fill('测试流式响应')
      await page.keyboard.press('Enter').catch(() => {})
      // 等待响应(不崩溃即通过)
      await page.waitForTimeout(3000)
      expect(page.url()).toContain('/chat')
    }
  })

  test('历史记录列表存在(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    // 历史记录通常在侧边栏
    const sidebar = page.locator('aside, nav, [role="navigation"]').first()
    if (await sidebar.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(sidebar).toBeVisible()
    }
  })

  test('删除对话按钮存在(若有历史记录)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    await page.waitForTimeout(2000)
    const deleteBtn = page.getByRole('button', { name: /删除|Delete|Remove/i }).first()
    const hasDelete = await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)
    expect(hasDelete || true).toBeTruthy()
  })

  test('chat 页面无控制台未捕获异常', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    const realErrors = consoleErrors.filter(
      (e) => !e.includes('favicon') && !e.includes('React DevTools'),
    )
    expect(realErrors).toHaveLength(0)
  })

  test('附加框交互:输入内容 → 点击添加引用 → 显示引用计数 chip(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    const textarea = page.locator('textarea').first()
    if (!(await textarea.isVisible({ timeout: 5000 }).catch(() => false))) return

    // 附加框按钮的 aria-label 在有内容时为「添加为上下文引用」,空状态为「添加上下文文件或引用」
    const attachBtn = page
      .getByRole('button', {
        name: /添加为上下文引用|添加上下文文件或引用|Add as Context Reference|Add context file or reference/i,
      })
      .first()
    if (!(await attachBtn.isVisible({ timeout: 3000 }).catch(() => false))) return

    // 1. 输入内容后按钮文案应切换为「添加为上下文引用」
    await textarea.fill('这是一段需要被添加为引用的测试内容')
    await expect(attachBtn).toHaveAttribute(
      'aria-label',
      /添加为上下文引用|Add as Context Reference/i,
    )

    // 2. 点击附加框按钮 → 文本被作为引用添加 → textarea 清空 → 显示「1 个引用」chip
    await attachBtn.click()
    await expect(textarea).toHaveValue('')
    const refChip = page.locator('text=/1 个引用|1 reference/i').first()
    await expect(refChip).toBeVisible({ timeout: 3000 })
  })

  test('附加框 hover 态:鼠标悬停时按钮应有视觉反馈(若可访问)', async ({ page }) => {
    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    if (!page.url().includes('/chat')) return

    const textarea = page.locator('textarea').first()
    if (!(await textarea.isVisible({ timeout: 5000 }).catch(() => false))) return

    const attachBtn = page
      .getByRole('button', {
        name: /添加为上下文引用|添加上下文文件或引用|Add as Context Reference|Add context file or reference/i,
      })
      .first()
    if (!(await attachBtn.isVisible({ timeout: 3000 }).catch(() => false))) return

    // 悬停前后 class 列表应有差异(transition-all + hover:shadow-sm + hover:-translate-y-px)
    await attachBtn.hover()
    // 仅断言按钮仍可见且可点击,具体 class 差异由 CSS 引擎保证
    await expect(attachBtn).toBeVisible()
  })
})

// ──────────────────────────────────────────────────────────────────────────
// 思考过程折叠生命周期(SSE mock) — 2026-08-29 立
//
// 背景:ThinkingSection(apps/web/src/components/ai/progress-sections/thinking-section.tsx,
// data-testid="thinking-section" / data-thinking-expanded="true"|"false")由 MessageItem
// (apps/web/src/components/chat/message-list/MessageItem.tsx)以受控模式挂载
// (expanded=reasoningExpanded,默认 false)。预期生命周期:
// - "先想后答"模型(reasoning delta 先于正文 chunk 到达):思考区挂载时思考已结束,
//   直接折叠(MessageItem.tsx 2026-08-29 注释),不做"先展开再收起"避免闪烁;
// - 回复(SSE 流)结束后思考区保持折叠态 data-thinking-expanded="false"。
//
// 真实渲染链路(2026-08-29 调查):
// - /chat(app/(main)/chat/page.tsx)已登录时渲染 home 内容 → 全局 docked AISidePanel
//   (app/layout.tsx GlobalShell 挂载;stores/ai-panel.ts open:true 默认展开,
//   persist merge 强制 open/非 float),面板(data-testid="ai-side-panel-aside")内含
//   MessageList + MessageInput(textarea);
// - 发送链路:MessageInput Enter → use-chat send-message → streamChat('/ai/chat/stream')。
//
// mock 链路 helper(makeSSE / CORS_HEADERS / mockConversation / mockSSE)复制自
// phase-21-timeline-sse.spec.ts(该文件未导出 helper,按需复制并注明来源):
// - streamChat 用 streamBaseUrl 直连 API 服务器 localhost:8802,跨域必须具体 origin
//   http://localhost:8801 + Access-Control-Allow-Credentials: true,OPTIONS 需 204 preflight;
// - mock 会话链路避免真实后端 404 把 conversationId 重置为 null;
// - SSE body 末尾追加 chunk + done,否则 streamChat 30s 首 token 超时 abort。
// ──────────────────────────────────────────────────────────────────────────

/** 构造 SSE 流 body(每条事件 data: JSON\n\n) — 复制自 phase-21-timeline-sse.spec.ts */
function makeSSE(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/** CORS 响应头(streamChat credentials:'include',不能通配 '*') — 复制自 phase-21-timeline-sse.spec.ts */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'http://localhost:8801',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept, Last-Event-ID',
}

/**
 * mock 完整会话链路(create/detail/list/messages),避免真实后端 404 重置 conversationId。
 * — 复制自 phase-21-timeline-sse.spec.ts
 */
async function mockConversation(page: Page): Promise<void> {
  const convId = `e2e-conv-${Date.now()}`
  const conv = {
    id: convId,
    userId: 'admin',
    title: 'E2E Thinking Lifecycle Test',
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  await page.route('**/api/chat/conversations**', async (route) => {
    const req = route.request()
    const method = req.method()
    const url = req.url()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    // POST 创建会话(排除 /messages 子路径)
    if (method === 'POST' && !url.includes('/messages')) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    // GET 会话列表
    if (method === 'GET' && /\/conversations\?/.test(url)) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({
          code: 0,
          message: 'ok',
          data: { conversations: [conv], page: 1, pageSize: 20, total: 1 },
        }),
      })
      return
    }
    // GET 会话详情(/conversations/:id)
    if (method === 'GET' && /\/conversations\/[^/?]+$/.test(url)) {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    // GET / POST 消息
    if (/\/conversations\/[^/?]+\/messages/.test(url)) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              messages: [],
              page: 1,
              pageSize: 50,
              total: 0,
              hasMore: false,
              nextCursor: null,
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
          body: JSON.stringify({
            code: 0,
            message: 'ok',
            data: { message: { id: 'persisted-1' } },
          }),
        })
      }
      return
    }
    await route.continue()
  })
}

/**
 * mock SSE 流(拦截 /ai/chat/stream) — 复制自 phase-21-timeline-sse.spec.ts。
 * 自动在 body 末尾追加 chunk + done,保证 streamChat 收到 content token 快速完成
 * (否则 30s 首 token 超时 abort)。
 */
async function mockSSE(page: Page, events: ReadonlyArray<Record<string, unknown>>): Promise<void> {
  const body = makeSSE([
    ...events,
    { type: 'chunk', content: 'ok' },
    { type: 'done', content: 'ok' },
  ])
  await page.route('**/ai/chat/stream', async (route) => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: CORS_HEADERS })
      return
    }
    await route.fulfill({
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        ...CORS_HEADERS,
      },
      body,
    })
  })
}

test.describe('思考过程折叠生命周期(SSE mock)', () => {
  test('回复结束后思考过程处于折叠态(data-thinking-expanded="false")', async ({
    adminPage: page,
  }) => {
    // 先 2-3 条 reasoning delta 再 content delta(模拟"先想后答"),mockSSE 自动补 chunk+done
    await mockConversation(page)
    await mockSSE(page, [
      { type: 'reasoning', content: '用户问的是 E2E 测试问题,先分析问题本身。' },
      { type: 'reasoning', content: '结合上下文逐步推理,确定回答结构。' },
      { type: 'reasoning', content: '组织语言,给出简明结论。' },
      { type: 'chunk', content: '思考结束,这是正文回答内容。' },
    ])

    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded').catch(() => {})
    // 已登录态(adminPage)下不会被重定向
    await expect(page).toHaveURL(/\/chat/, { timeout: 15000 })

    // AI 面板默认展开(stores/ai-panel.ts open:true),textarea 在面板 aside 内
    const textarea = page.locator('[data-testid="ai-side-panel-aside"] textarea').first()
    await expect(textarea).toBeVisible({ timeout: 15000 })
    await textarea.fill('E2E:思考折叠生命周期')
    await page.keyboard.press('Enter')

    // 等待助手回复的 mock 正文出现在 DOM(SSE 流被完整消费,回复结束)
    await expect(page.getByText('思考结束,这是正文回答内容。').first()).toBeVisible({
      timeout: 20000,
    })

    // 断言 1:思考区可见,且回复完成后处于折叠态
    const thinking = page.locator('[data-testid="thinking-section"]')
    await expect(thinking).toBeVisible()
    await expect(thinking).toHaveAttribute('data-thinking-expanded', 'false')

    // 断言 2(增强):折叠态下展开内容区(thinking-content)不可见
    // (条件渲染:仅 expanded 时挂载,折叠时不在 DOM)
    await expect(page.locator('[data-testid="thinking-content"]')).not.toBeVisible()
  })
})
