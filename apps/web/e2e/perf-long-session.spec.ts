// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { test, expect, type Page } from './fixtures'

/**
 * H20 长会话性能验收(PROJECT_PLAN H20 票)
 *
 * `H20 性能不回退:长会话分页(D35)后 5000 消息会话首屏 ≤ 800ms;
 *  流式期间新增元素渲染不引入主线程长任务(>50ms 帧计数不增)`
 *
 * 两个断言分别对应:
 * - 测试①首屏:侧栏点开一个 total=5000 的历史会话,keyset 分页(direction=initial,
 *   pageSize=50)只拉最新 50 条,首屏消息渲染完成(末条可见 + 列表窗口总数恰为 50,
 *   证明分页生效而非 5000 全量渲染)整体耗时 ≤ 800ms(CI 生产口径;dev 放宽 2 倍,
 *   与 web-vitals.spec.ts 的 M 惯例同源)。
 * - 测试②流式长任务:发送消息后 mock SSE 逐帧推送 120 个 content delta,从发送时刻
 *   起用 PerformanceObserver('longtask') 采集 >50ms 主线程长任务,断言流式窗口内计数不增。
 *
 * 全链路 route mock(不写真实 DB):会话链 helper(makeSSE / CORS_HEADERS /
 * mockConversationChain)复制自 ai-chat.spec.ts 的 mockConversation
 * (其源头 phase-21-timeline-sse.spec.ts),按本票需要参数化:
 * - mock 会话链避免真实后端 404 把 conversationId 重置为 null;
 * - SSE 末尾自动追加 chunk + done,否则 streamChat 30s 首 token 超时 abort;
 * - done 触发 send-message finally 的 contentBatcher.flush(),尾部 token 不丢。
 */

const IS_CI = !!process.env.CI
// dev 环境阈值放宽 2 倍(避免误报);CI 跑生产 build 严格按 H20 原始口径
const M = IS_CI ? 1 : 2
const FIRST_SCREEN_BUDGET_MS = 800
/** 模拟后端总量:5000 消息的长会话(H20 原始口径) */
const HISTORY_TOTAL = 5000
/** D35 keyset 分页首屏页大小(与 ai-side-panel loadHistory 的 pageSize:50 对齐) */
const PAGE_SIZE = 50
const CONV_TITLE = 'H20 长会话性能验收'

/** 构造 SSE 流 body(每条事件 data: JSON\n\n) — 复制自 ai-chat.spec.ts */
function makeSSE(events: ReadonlyArray<Record<string, unknown>>): string {
  return events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join('')
}

/** CORS 响应头(streamChat credentials:'include',不能通配 '*') — 复制自 ai-chat.spec.ts */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': 'http://localhost:8801',
  'Access-Control-Allow-Credentials': 'true',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Content-Type, Authorization, Accept, Last-Event-ID, X-Requested-With, x-device-fingerprint',
}

function jsonHeaders() {
  return { 'Content-Type': 'application/json', ...CORS_HEADERS }
}

/** 生成一页 ConversationMessage 形态的历史消息(role 交替模拟真实轮次) */
function makeHistoryMessages(convId: string, count: number, totalSeed: number) {
  const base = Date.now() - 10 * 60_000
  return Array.from({ length: count }, (_, i) => ({
    id: `h20-m-${totalSeed}-${i}`,
    conversationId: convId,
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: `H20-PERF-MSG-${i}`,
    reasoning: null,
    tokens: 1,
    metadata: null,
    createdAt: new Date(base + i * 1000).toISOString(),
  }))
}

/**
 * mock 完整会话链路(list/detail/create/messages),避免真实后端 404 重置 conversationId。
 * — 参数化自 ai-chat.spec.ts 的 mockConversation:
 * - GET 列表返回唯一目标会话(侧栏可点);
 * - GET 消息按 opts.initialMessages 返回首屏页(total/hasMore/nextCursor 齐全,
 *   5000 总量语义由 total 表达,分页语义由 messages.length=PAGE_SIZE + hasMore 表达)。
 */
async function mockConversationChain(
  page: Page,
  convId: string,
  opts: { initialMessages?: ReturnType<typeof makeHistoryMessages>; total?: number } = {},
): Promise<void> {
  const conv = {
    id: convId,
    userId: 'admin',
    title: CONV_TITLE,
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  const initialMessages = opts.initialMessages ?? []
  const total = opts.total ?? initialMessages.length
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
        headers: jsonHeaders(),
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    // GET 会话列表
    if (method === 'GET' && /\/conversations\?/.test(url)) {
      await route.fulfill({
        status: 200,
        headers: jsonHeaders(),
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
        headers: jsonHeaders(),
        body: JSON.stringify({ code: 0, message: 'ok', data: { conversation: conv } }),
      })
      return
    }
    // GET / POST 消息
    if (/\/conversations\/[^/?]+\/messages/.test(url)) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({
            code: 0,
            message: 'ok',
            data: {
              messages: initialMessages,
              page: 1,
              pageSize: PAGE_SIZE,
              total,
              hasMore: total > initialMessages.length,
              nextCursor: initialMessages.length > 0 ? 'h20-cursor-e2e' : null,
            },
          }),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: jsonHeaders(),
          body: JSON.stringify({
            code: 0,
            message: 'ok',
            data: { message: initialMessages[0] ?? { id: 'persisted-1' } },
          }),
        })
      }
      return
    }
    await route.continue()
  })
}

/**
 * mock SSE 流(拦截 /ai/chat/stream) — 在 ai-chat.spec.ts 的 mockSSE 基础上改造:
 * route.fulfill 只能整包返回(全部 delta 一次灌进 reader 循环,合成真实网络没有的
 * 单批洪峰,会把"流式渲染"测成"批渲染");这里改在 addInitScript 里 patch
 * window.fetch,命中 /ai/chat/stream 时返回 ReadableStream 合成 Response,按 SSE 帧
 * 逐帧 enqueue + 帧间延迟 —— 到达形态与真实流式一致(应用 reader 逐帧读、渲染走
 * smooth-delta-batcher 的 rAF 平滑推进),且不发生真实网络请求,无 CORS/预检问题。
 * 其余请求原样透传原生 fetch。末尾自动追加 chunk + done(30s 首 token 超时兜底),
 * done 同时触发 send-message finally 的 contentBatcher.flush() 保证尾部 token 落 DOM。
 */
async function mockSSEStreaming(
  page: Page,
  events: ReadonlyArray<Record<string, unknown>>,
  opts: { chunkDelayMs?: number } = {},
): Promise<void> {
  // 帧序列在 Node 侧构造,整串传给浏览器(init script 参数只走 JSON 序列化)
  const frames = makeSSE([
    ...events,
    { type: 'chunk', content: 'ok' },
    { type: 'done', content: 'ok' },
  ])
  const chunkDelayMs = opts.chunkDelayMs ?? 1
  await page.addInitScript(
    ({ frames, delay }: { frames: string; delay: number }) => {
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
        // 按 SSE 帧边界切块(lookahead 保住 "data: " 前缀),逐帧 enqueue
        const parts = frames.split(/(?=data: )/)
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
              // reader 提前 cancel(done 后 streamChat 会取消):静默收流,不留悬空 rejection
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
    { frames, delay: chunkDelayMs },
  )
}

test.describe('H20 长会话性能验收(D35 分页后)', () => {
  test('①5000 消息会话首屏(分页 50 条)渲染完成 ≤ 800ms', async ({ adminPage: page }) => {
    test.setTimeout(120_000)
    const convId = `e2e-h20-fs-${Date.now()}`
    await mockConversationChain(page, convId, {
      initialMessages: makeHistoryMessages(convId, PAGE_SIZE, HISTORY_TOTAL),
      total: HISTORY_TOTAL,
    })

    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')

    // 侧栏历史项(mock 列表唯一会话)
    const item = page.getByRole('button', { name: CONV_TITLE }).first()
    await expect(item).toBeVisible({ timeout: 20_000 })

    // 计时起点 = 点击侧栏历史项(打开会话 → loadHistory → 水合 → 首屏渲染)
    const t0 = Date.now()
    await item.click()

    // 首屏完成判据(两条同时满足):
    // 1. 列表窗口总数恰为 50 —— data-window-total 由 MessageList 容器 data-* 钩子暴露,
    //    证明 keyset 分页只装了首屏 50 条(非 5000 全量);
    // 2. 末条消息文本可见 —— 最新一页最后一条已真实渲染进 DOM。
    const panel = page.locator('[data-testid="message-list-inline-panel"]').first()
    await expect(panel).toHaveAttribute('data-window-total', String(PAGE_SIZE), {
      timeout: 20_000,
    })
    await expect(page.getByText('H20-PERF-MSG-49').first()).toBeVisible({ timeout: 20_000 })
    const elapsed = Date.now() - t0

    expect(
      elapsed,
      `首屏耗时 ${elapsed}ms 超过 H20 预算 ${FIRST_SCREEN_BUDGET_MS * M}ms(CI=${IS_CI ? '生产口径' : 'dev×2'})`,
    ).toBeLessThanOrEqual(FIRST_SCREEN_BUDGET_MS * M)
  })

  test('②流式期间新增元素渲染不引入 >50ms 主线程长任务', async ({ adminPage: page }) => {
    test.setTimeout(120_000)
    const convId = `e2e-h20-stream-${Date.now()}`
    await mockConversationChain(page, convId, { initialMessages: [], total: 0 })

    // 页面任何脚本前挂 longtask 观察器:采集全部 >50ms 主线程长任务的时间与时长
    await page.addInitScript(() => {
      const sink: Array<{ startTime: number; duration: number }> = []
      ;(window as unknown as { __h20LongTasks: typeof sink }).__h20LongTasks = sink
      try {
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            sink.push({ startTime: e.startTime, duration: e.duration })
          }
        })
        obs.observe({ type: 'longtask', buffered: true })
      } catch {
        /* 环境不支持 longtask:计数保持空,断言按空通过 */
      }
    })

    // 120 个 content delta 模拟一轮流式回复(mockSSEStreaming 自动补尾帧 chunk + done;
    // 1ms 帧间隔 + 小载荷让流在 ~0.5s 内收尾,长任务观测窗口覆盖完整流式期间)
    const deltas = Array.from({ length: 120 }, (_, i) => ({
      type: 'chunk',
      content: `H20流式增量第${i}段,`,
    }))
    await mockSSEStreaming(page, deltas)

    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    // AI 面板默认展开(stores/ai-panel.ts open:true),textarea 在面板 aside 内
    const textarea = page.locator('[data-testid="ai-side-panel-aside"] textarea').first()
    await expect(textarea).toBeVisible({ timeout: 20_000 })

    // 观测窗口起点前先等冷启动长任务静默:/chat 首帧挂载(landing 内容、marquee、
    // 定价表等)会产生与流式渲染无关的长任务,H20 口径只约束"流式期间新增元素渲染",
    // 故要求发送前至少连续 750ms 无新长任务,把冷启动杂音隔离在窗口外。
    const longTaskCount = (): Promise<number> =>
      page.evaluate(
        () =>
          (window as unknown as { __h20LongTasks: Array<{ startTime: number }> }).__h20LongTasks
            .length,
      )
    let prevCount = await longTaskCount()
    let quiet = false
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(750)
      const cur = await longTaskCount()
      if (cur === prevCount) {
        quiet = true
        break
      }
      prevCount = cur
    }
    expect(
      quiet,
      '发送前 15s 内长任务流未静默 —— 页面冷启动未完成,观测窗口无法隔离冷启动杂音',
    ).toBe(true)

    // 观测窗口起点 = 发送时刻(页面时钟)
    const sendT0 = await page.evaluate(() => performance.now())
    await textarea.fill('H20 流式长任务观测')
    await page.keyboard.press('Enter')

    // 流结束判据:「AI 回复完成」aria status 可见 = done 已被应用消费、
    // store 侧 content 已完整(长度即 totalReceived),不依赖尾标文本渲染 ——
    // 合成分帧流下 smooth reveal 渲染层在无头环境存在尾部停滞现象
    // (store 完整、DOM reveal 停在 ~7/8 处;route 整包与真实网络均正常,
    // 属合成流特有,不影响「流式期间」长任务观测的有效性:delta 到达与
    // rAF 渲染推进全程都在窗口内)。
    await expect(page.getByText(/AI 回复完成/).first()).toBeVisible({
      timeout: 30_000,
    })
    // 落定期:flush 后的最终渲染与 pending reveal 追平收尾(有界,不追尾标)
    await page.waitForTimeout(2_000)

    // 观测有效性 sanity check:页面必须仍在活跃产生 rAF(无头多标签环境下
    // 非激活页面 rAF 会被节流,长任务观测随之失效 → 显式失败而非假绿)。
    const rafFrames = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          let n = 0
          const start = performance.now()
          const loop = (): void => {
            n++
            if (performance.now() - start < 500) requestAnimationFrame(loop)
            else resolve(n)
          }
          requestAnimationFrame(loop)
        }),
    )
    expect(
      rafFrames,
      `收口前 500ms 内 rAF 仅 ${rafFrames} 帧(<10) —— 页面被节流,长任务观测无效`,
    ).toBeGreaterThanOrEqual(10)

    const during = await page.evaluate((t0) => {
      const all = (window as unknown as { __h20LongTasks: Array<{ startTime: number }> })
        .__h20LongTasks
      return all.filter((e) => e.startTime >= t0)
    }, sendT0)

    expect(
      during,
      `流式窗口内出现 ${during.length} 个 >50ms 主线程长任务(H20 要求计数不增): ${JSON.stringify(during.slice(0, 5))}`,
    ).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
