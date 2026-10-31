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
    // 真实读数落日志(票 goal-r73-d35:perf e2e 要产出可读数字,不只 pass/fail)
    console.log(
      `[perf-long-session] ①首屏 ${elapsed}ms / 预算 ${FIRST_SCREEN_BUDGET_MS * M}ms(${IS_CI ? 'CI 生产口径' : 'dev×2'})`,
    )

    // 冷/热两档读数(goal-b39-s4,只读数不设断言):上面 elapsed 是"冷"档 —— 本地 dev 档
    // 首次导航还含 Turbopack 按需编译与机器并发 CPU 争用,单次读数分不开"产品渲染"与
    // "dev 编译"。重载后再走同一交互(模块已编译进 dev server 内存)即"热"档;两档并排打
    // 日志即可判:热档落回预算内而冷档超 ⇒ 差额是编译/争用(环境放大),两档同超 ⇒ 产品侧。
    // 放在断言之前量:冷档判红时这份归因读数仍然拿得到。
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    const warmItem = page.getByRole('button', { name: CONV_TITLE }).first()
    await expect(warmItem).toBeVisible({ timeout: 20_000 })
    const warmT0 = Date.now()
    await warmItem.click()
    await expect(panel).toHaveAttribute('data-window-total', String(PAGE_SIZE), {
      timeout: 20_000,
    })
    await expect(page.getByText('H20-PERF-MSG-49').first()).toBeVisible({ timeout: 20_000 })
    const warmElapsed = Date.now() - warmT0
    console.log(
      `[perf-long-session] ①冷档 ${elapsed}ms / 热档 ${warmElapsed}ms(重载后再开同一会话)/ 预算 ${FIRST_SCREEN_BUDGET_MS * M}ms —— 仅读数,断言只判冷档`,
    )

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
      // goal-b39-s4:除时刻/时长外把 attribution 一并落账 —— 判"长任务是 dev 按需编译
      // (chunk 脚本装载)还是产品渲染"时,靠 src/type 两格分桶;浏览器不给归因时留空串。
      // 2026-10-31(#5 perf5)采集面更正:Long Tasks 的 attribution 里 containerSrc **只在
      // iframe/frame/embed/object 容器上才有值**;顶层窗口任务的 containerType 恒为
      // 'window' 且 containerSrc 恒为 ''(W3C Long Tasks 规范)⇒ 旧读数「带归因=0」量的
      // 其实是"有没有 iframe",对顶层窗口**结构上永远是 0**,既不能证明采集坏了,也不能
      // 证明长任务来自哪段代码。要归因到具体脚本/调用点需 Long Animation Frames
      // (Chrome 123+):每条长帧自带 scripts[].sourceURL / invoker / invokerType /
      // duration。故并存两个 sink:长任务计数仍走 longtask(断言面一字不动),
      // 脚本级归因走 LoAF(只读数,不参与断言,取不到即"未判定"不冒充 0)。
      type LongTaskEntry = { startTime: number; duration: number; src: string; type: string }
      type LoafEntry = {
        startTime: number
        duration: number
        blockingDuration: number
        scripts: Array<{ src: string; invoker: string; invokerType: string; duration: number }>
      }
      const sink: LongTaskEntry[] = []
      ;(window as unknown as { __h20LongTasks: LongTaskEntry[] }).__h20LongTasks = sink
      const loafSink: LoafEntry[] = []
      ;(window as unknown as { __h20Loaf: LoafEntry[] }).__h20Loaf = loafSink
      try {
        const obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const attrib = (
              e as PerformanceEntry & {
                attribution?: Array<{
                  name?: string
                  containerType?: string
                  containerSrc?: string
                }>
              }
            ).attribution
            const src = (attrib ?? [])
              .map((a) => a.containerSrc ?? a.name ?? '')
              .filter(Boolean)
              .join('|')
              .slice(0, 160)
            const type = (attrib ?? [])
              .map((a) => a.containerType ?? '')
              .filter(Boolean)
              .join('|')
            sink.push({ startTime: e.startTime, duration: e.duration, src, type })
          }
        })
        obs.observe({ type: 'longtask', buffered: true })
      } catch {
        /* 环境不支持 longtask:计数保持空,断言按空通过 */
      }
      try {
        type LoafTiming = PerformanceEntry & {
          blockingDuration?: number
          scripts?: Array<{
            sourceURL?: string
            invoker?: string
            invokerType?: string
            duration?: number
          }>
        }
        const loaf = new PerformanceObserver((list) => {
          for (const e of list.getEntries() as LoafTiming[]) {
            loafSink.push({
              startTime: e.startTime,
              duration: e.duration,
              blockingDuration: e.blockingDuration ?? 0,
              scripts: (e.scripts ?? []).map((s) => ({
                src: (s.sourceURL ?? '').slice(-120),
                invoker: (s.invoker ?? '').slice(0, 80),
                invokerType: s.invokerType ?? '',
                duration: s.duration ?? 0,
              })),
            })
          }
        })
        loaf.observe({ type: 'long-animation-frame', buffered: true } as PerformanceObserverInit)
      } catch {
        /* 内核无 LoAF(Chrome<123):脚本归因**未判定**,保持空数组,不冒充「无脚本」 */
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
      const all = (
        window as unknown as {
          __h20LongTasks: Array<{ startTime: number; duration: number; src: string; type: string }>
        }
      ).__h20LongTasks
      return all.filter((e) => e.startTime >= t0)
    }, sendT0)
    // 归因读数(goal-b39-s4):窗口内新装载的脚本。dev 档按需编译会在流式窗口里现拉
    // chunk(该数>0 ⇒ 长任务至少有一部分是编译);生产 build 首屏已装载完,该数应为 0。
    const scriptsAfterSend = await page.evaluate(
      (t0) =>
        (performance.getEntriesByType('resource') as PerformanceResourceTiming[])
          .filter((r) => r.initiatorType === 'script' && r.startTime >= t0)
          .map((r) => ({ name: r.name.split('/').pop() ?? '', dur: Math.round(r.duration) })),
      sendT0,
    )
    // 脚本级归因(LoAF,只读数不参与断言):窗口内长帧 + 其中带 scripts 的帧。
    // 取不到(内核不支持)时数组为空 ⇒ 下面读数为 0/0 并显式标"未判定",不冒充"无脚本"。
    const loafDuring = await page.evaluate((t0) => {
      const all = (
        window as unknown as {
          __h20Loaf: Array<{
            startTime: number
            duration: number
            blockingDuration: number
            scripts: Array<{ src: string; invoker: string; invokerType: string; duration: number }>
          }>
        }
      ).__h20Loaf
      // 与长任务窗口同口径:与 [t0, ∞) 有重叠即算窗口内
      return all.filter((e) => e.startTime + e.duration >= t0)
    }, sendT0)
    const loafWithScripts = loafDuring.filter((e) => e.scripts.length > 0)
    // 容器归因 = longtask.attribution 存在(顶层窗口恒为 containerType='window');
    // 脚本级归因 = 该长任务与任一"带 scripts 的 LoAF 长帧"在时间上重叠。
    const withContainerAttribution = during.filter((e) => e.type).length
    const withScriptAttribution = during.filter((task) =>
      loafWithScripts.some(
        (f) =>
          f.startTime < task.startTime + task.duration && f.startTime + f.duration > task.startTime,
      ),
    ).length
    const byScript = new Map<string, number>()
    for (const f of loafWithScripts) {
      for (const s of f.scripts) {
        const key = s.src ? (s.src.split('/').pop() ?? s.src) : '(inline)'
        byScript.set(key, (byScript.get(key) ?? 0) + s.duration)
      }
    }
    const topScripts = [...byScript.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    console.log(
      `[perf-long-session] ②流式窗口 >50ms 长任务=${during.length}(预算 0), rAF=${rafFrames}帧/500ms, 带归因(容器)=${withContainerAttribution}/${during.length}, 带归因(脚本/LoAF)=${withScriptAttribution}/${during.length}, 窗口内新装载脚本=${scriptsAfterSend.length}`,
    )
    console.log(
      `[perf-long-session] ②LoAF 长帧=${loafDuring.length}(预算口径同为 0;带 scripts=${loafWithScripts.length}), 脚本累计用时 top${topScripts.length}: ${
        topScripts.length > 0
          ? topScripts.map(([name, ms]) => `${name}(${Math.round(ms)}ms)`).join(', ')
          : '(无脚本归因数据)'
      }`,
    )
    if (during.length > 0) {
      const top = [...during].sort((a, b) => b.duration - a.duration).slice(0, 5)
      console.log(
        `[perf-long-session] ②最长 5 个: ${top
          .map(
            (e) =>
              `${Math.round(e.duration)}ms@${Math.round(e.startTime)}${e.src ? ` src=${e.src}` : ''}`,
          )
          .join(' | ')}`,
      )
      if (scriptsAfterSend.length > 0) {
        console.log(
          `[perf-long-session] ②窗口内脚本: ${scriptsAfterSend
            .slice(0, 3)
            .map((s) => `${s.name}(${s.dur}ms)`)
            .join(', ')}`,
        )
      }
      const topLoaf = [...loafWithScripts]
        .sort((a, b) => b.blockingDuration - a.blockingDuration)
        .slice(0, 5)
      if (topLoaf.length > 0) {
        console.log(
          `[perf-long-session] ②LoAF 阻塞最长 5 帧: ${topLoaf
            .map((f) => {
              const worst = [...f.scripts].sort((a, b) => b.duration - a.duration)[0]
              const who = worst
                ? `${worst.src ? (worst.src.split('/').pop() ?? worst.src) : '(inline)'}@${worst.invokerType || '?'}${worst.invoker ? `:${worst.invoker}` : ''}`
                : '(无 scripts)'
              return `blocking=${Math.round(f.blockingDuration)}ms/frame=${Math.round(f.duration)}ms ${who}`
            })
            .join(' | ')}`,
        )
      }
    }

    expect(
      during,
      `流式窗口内出现 ${during.length} 个 >50ms 主线程长任务(H20 要求计数不增): ${JSON.stringify(during.slice(0, 5))}`,
    ).toHaveLength(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
