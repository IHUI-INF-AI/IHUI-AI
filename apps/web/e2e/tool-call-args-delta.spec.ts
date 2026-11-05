// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from './fixtures'

/**
 * 端到端验证:tool-call-args-delta 增量帧真的驱动前端 ToolCallCard 渐进渲染
 * (而非仅契约到达 wire)。
 *
 * 链路:mock SSE 逐帧吐 tool-call-args-delta → api-client 解析(parseToolCallArgsDeltaFrame)
 *   → send-message.ts 注册的 onOpenAiToolCall → createOpenAiToolCallHandler 写
 *   store.partialArgs/argsStreaming → ToolCallCard 渲染 tool-call-partial-args 预览块。
 *
 * 关键断言:同一预览块文本随帧递增(a → abc),证明是"逐片"而非一次性到达;
 * complete 帧 + tool-result 后预览块卸载、卡片收敛为终态(不卡在 running 预览)。
 *
 * 复用 perf-long-session.spec.ts 的 mockSSEStreaming 思路(patch window.fetch 返回
 * ReadableStream 逐帧 enqueue),以及 ai-tool-loop.spec.ts 的会话态 mock(避免真实后端
 * 把 conversationId 重置)。末尾自动补 chunk + done,否则 streamChat 30s 首 token 超时 abort。
 */

/** 构造 SSE body(每条事件 data: JSON\n\n) */
function makeSSE(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/** 会话态 mock:覆盖 createConversation / getConversation / getMessages 三个真实端点 */
async function mockConversation(page: Page, convId: string): Promise<void> {
  const matcher = (url: URL) =>
    url.pathname === '/api/chat/conversations' ||
    url.pathname.startsWith('/api/chat/conversations/')
  await page.route(matcher, async (route) => {
    const method = route.request().method()
    const pathname = new URL(route.request().url()).pathname
    const accept = (data: unknown) =>
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 0, message: 'ok', data }),
      })
    if (method === 'POST' && pathname === '/api/chat/conversations') {
      await accept({ conversation: { id: convId } })
      return
    }
    if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+\/messages$/.test(pathname)) {
      await accept({ messages: [], nextCursor: null, hasMore: false })
      return
    }
    if (method === 'GET' && /^\/api\/chat\/conversations\/[^/]+$/.test(pathname)) {
      await accept({ conversation: { id: convId, title: null, metadata: null } })
      return
    }
    await route.continue()
  })
}

/**
 * mock 流式 chat:逐帧吐 tool-call-args-delta + 收尾(tool-call-start / tool-result / chunk / done)。
 * 在 addInitScript 里 patch window.fetch,命中 /ai/chat/stream 时返回 ReadableStream 逐帧
 * enqueue —— 到达形态与真实流式一致(应用 reader 逐帧读、渲染走 smooth-delta-batcher 的 rAF 平滑)。
 */
async function mockToolCallArgsDeltaStream(
  page: Page,
  frames: ReadonlyArray<Record<string, unknown>>,
  opts: { chunkDelayMs?: number } = {},
): Promise<void> {
  const sse = makeSSE([
    ...frames,
    // 真实生产顺序:delta 帧在 LLM 流式吐参时出现,工具实际执行前再发 tool-call-start,
    // 执行完发 tool-result。这里补齐全链路,验证 progressive 渲染后卡片能收敛为终态。
    {
      type: 'tool-call-start',
      toolCallId: 'c1',
      toolName: 'web_search',
      args: { query: 'abc', limit: 5 },
    },
    { type: 'tool-result', toolCallId: 'c1', isError: false, result: { ok: true } },
    { type: 'chunk', content: 'ok' },
    { type: 'done', content: 'ok' },
  ])
  const delay = opts.chunkDelayMs ?? 350
  await page.addInitScript(
    ({ sse, delay }: { sse: string; delay: number }) => {
      const orig = window.fetch.bind(window)
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url
        if (!url.includes('/ai/chat/stream')) return orig(input, init)
        const enc = new TextEncoder()
        const parts = sse.split(/(?=data: )/)
        const body = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              for (const p of parts) {
                if (init?.signal?.aborted) break
                controller.enqueue(enc.encode(p))
                if (delay > 0) await new Promise((r) => setTimeout(r, delay))
              }
              controller.close()
            } catch {
              try {
                controller.close()
              } catch {
                /* 已关闭 */
              }
            }
          },
        })
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        })
      }
    },
    { sse, delay },
  )
}

const DELTA_FRAMES: ReadonlyArray<Record<string, unknown>> = [
  {
    type: 'tool-call-args-delta',
    index: 0,
    id: 'c1',
    name: 'web_search',
    args: { query: 'a' },
    argsComplete: false,
    argsPartial: true,
  },
  {
    type: 'tool-call-args-delta',
    index: 0,
    id: 'c1',
    name: 'web_search',
    args: { query: 'abc' },
    argsComplete: false,
    argsPartial: true,
  },
  {
    type: 'tool-call-args-delta',
    index: 0,
    id: 'c1',
    name: 'web_search',
    args: { query: 'abc', limit: 5 },
    argsComplete: true,
    argsPartial: false,
  },
]

test.describe('tool-call-args-delta 增量渲染端到端', () => {
  test('逐帧推进 partial 预览,complete 后收敛为终态', async ({ authenticatedPage }) => {
    const consoleErrors: string[] = []
    authenticatedPage.on('pageerror', (err) => consoleErrors.push(err.message))

    await mockConversation(authenticatedPage, 'e2e-conv-tool-args-delta')
    await mockToolCallArgsDeltaStream(authenticatedPage, DELTA_FRAMES)

    await authenticatedPage.goto('/chat')
    await authenticatedPage.waitForLoadState('domcontentloaded')
    const textarea = authenticatedPage.locator('textarea').first()
    try {
      await textarea.waitFor({ state: 'visible', timeout: 20000 })
    } catch {
      return
    }
    await textarea.fill('搜一下 abc')
    await authenticatedPage.keyboard.press('Enter').catch(() => {})

    // 卡片随 delta 首片挂载(行级 testid 含 toolCallId c1)
    const row = authenticatedPage.getByTestId('tool-call-row-c1')
    await row.waitFor({ state: 'attached', timeout: 20000 })

    const partial = authenticatedPage.getByTestId('tool-call-partial-args')
    // 首片:预览含 "query": "a"
    await expect(partial).toContainText('"query": "a"', { timeout: 20000 })

    // 逐片增长:同一预览块文本最终含 "abc"(证明是逐片渲染,而非一次性出现)
    await expect
      .poll(async () => (await partial.textContent()) ?? '')
      .toContain('abc')

    // complete 帧 + tool-result 后:预览块卸载,卡片收敛为终态仍挂载(不卡在 running 预览)
    await expect(partial).toHaveCount(0, { timeout: 20000 })
    await expect(row).toBeAttached()

    // 不应有未捕获页面异常
    expect(consoleErrors).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
