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
 *
 * 为什么用内置 page 而非 authenticatedPage:本 spec 是**全 route-mock**(SSE 由 window.fetch
 * patch、会话三端点由 page.route 接管),不产生任何需要真实身份的请求;且 proxy.ts 的鉴权
 * 射程只有 /admin/* 与 /edu/edu-management/*,/chat 不在其中。E2E_USER_PASSWORD 是 env-only
 * (仓内字面量 2026-10-30 已清除),缓存 storageState 的 refresh_token 也会过期 ⇒ 绑
 * authenticatedPage 会在无凭据环境下 requireEnv throw,测试根本加载不起来。与
 * e2e-local-supply.mjs「全 route-mock 的 spec 不需要 E2E_USER_ACCOUNT」同一判据。
 */

/** 构造 SSE body:带 id: 水位行 + data: JSON,与真实 ai-service 帧契约一致。
 *  client.ts 的 processLine 有水位闸(shouldDropByWatermark),id:/event: 行需先喂
 *  frameSeqTracker 才能与随后的 data 配对;只发裸 data: 行会被判成 undetermined 帧。*/
function makeSSE(events: ReadonlyArray<Record<string, unknown>>): string {
  return events
    .map((e, i) => `id: ${i + 1}\ndata: ${JSON.stringify(e)}\n\n`)
    .join('')
}

/**
 * 注入"已登录"的 UI 态(不产生任何凭据、不调任何真实鉴权接口)。
 *
 * 判据:useAuthBootstrap 在无内存 token、无 auth cookie、无 refresh 凭据时走
 * "完全无会话"分支 → setReady(true) 后直接 return,**不改写 isAuthenticated**;
 * 而 auth store 的 persist 只持久化 isAuthenticated + user(见 stores/auth.ts partialize)。
 * 聊天页的门禁是 `!ready || !isAuthenticated`,注入该态即渲染输入框。
 * 本 spec 全 route-mock(SSE 由 fetch patch、会话三端点由 page.route 接管),
 * 不会有任何请求真去校验 token ⇒ 无需 accessToken / 密码 / 有效 storageState。
 * 与 fixtures.ts 构造 storageState 时写`ihui-auth`的形状逐字一致。
 */
async function mockLoggedInUi(page: Page): Promise<void> {
  await page.addInitScript(() => {
    try {
      localStorage.setItem(
        'ihui-auth',
        JSON.stringify({
          state: {
            isAuthenticated: true,
            user: { id: 'e2e-tool-args-delta', nickname: 'E2E', status: 1 },
          },
          version: 0,
        }),
      )
    } catch {
      // about:blank 等非同源导航取不到 localStorage;真正页面加载时会再执行一次。
    }
  })
}

/**
 * 页面内采样预览块文本。
 *
 * 为什么不用 Playwright locator 轮询:预览块只在 running + argsStreaming 窗口内存在,
 * 卡片挂载/展开/React 提交的耗时可能让测试线程错过整个窗口 ⇒ 轮询断言会假绿或假红。
 * 由页面自己的 50ms 采样器把「见过的每一版文本」留在 window 上,流结束后一次读回,
 * 逐片证据(出现过 ≥2 个不同文本、且从 a 增长到 abc)与测试线程时序彻底解耦。
 */
async function installPartialArgsProbe(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __partialArgsSnapshots?: string[]
      __rowStates?: string[]
    }
    w.__partialArgsSnapshots = []
    w.__rowStates = []
    setInterval(() => {
      // 外层「执行过程」组默认折叠(stream-ui.tsx:399 的 {open && children}),
      // 折叠时**所有工具卡都不在 DOM**。必须先展开组头,否则内层卡片/预览块
      // 永远查不到 —— 这正是初版「零渲染」的真因,不是 api-client 或组件缺陷。
      // ⚠️ 选择器必须精确命中组头(data-stream-group-trigger,stream-ui.tsx:369):
      // 工具卡自己的 StreamRow 也是 button 且 aria-expanded=false,宽泛的
      // `[data-testid^="message-steps-group-"] button[aria-expanded="false"]`
      // 会把它一起选中 ⇒ 同一轮先点组头、再点 row,两次 toggle 正好抵消,
      // 实测 expanded 恒 false、预览块永不渲染(2026-11-05 假红定位)。
      const collapsedGroup = document.querySelector(
        '[data-stream-group-trigger="true"][aria-expanded="false"]',
      ) as HTMLElement | null
      if (collapsedGroup) collapsedGroup.click()
      const row = document.querySelector(
        '[data-testid="tool-call-row-c1"]',
      ) as HTMLElement | null
      const expanded = row?.getAttribute('data-stream-expanded') ?? 'absent'
      // 预览块住在 StreamRow 的 expanded 展开区(tool-call-card.tsx:1517)。dev 首次
      // 编译 / hydration 期间,测试线程的一次 Playwright click 可能落在 React 绑定
      // onClick 之前而丢失;卡片若因 store 更新重挂载,expanded 也会回到 false。
      // 由页面自身保证「卡片一出现就保持展开」,与测试线程时序彻底解耦。
      if (row && expanded === 'false') row.click()
      const el = document.querySelector('[data-testid="tool-call-partial-args"]')
      // 分层读数:group=「执行过程」组是否挂载(stepSectionsCount>0 才有)、
      // trigger=组头按钮、rows=工具行总数、preview=预览块。三者一起才能区分
      // 「store 无 toolCalls ⇒ 组不挂载」与「组已挂载但折叠 ⇒ 卡片不在 DOM」。
      const groups = document.querySelectorAll('[data-testid^="message-steps-group-"]')
      const triggers = document.querySelectorAll('[data-stream-group-trigger]')
      const rows = document.querySelectorAll('[data-testid^="tool-call-row-"]')
      const state =
        `groups=${groups.length} triggers=${triggers.length} rows=${rows.length} ` +
        `expanded=${expanded} status=${row?.getAttribute('data-stream-status') ?? 'absent'} ` +
        `preview=${el ? 'yes' : 'no'}`
      const states = w.__rowStates
      // 绝对时间戳:与 __sseChunkTimes 同一时钟,可读出卡片相对首帧出现的时刻,
      // 也能看出探针是否被页面重载重置(记录数突然从 0 重新增长)。
      if (states && states[states.length - 1]?.slice(14) !== state) {
        states.push(`${Date.now()} ${state}`)
      }
      if (!el) return
      const text = el.textContent ?? ''
      const snaps = w.__partialArgsSnapshots
      if (snaps && snaps[snaps.length - 1] !== text) snaps.push(text)
    }, 50)
  })
}

async function readPartialArgsSnapshots(page: Page): Promise<{
  snapshots: string[]
  rowStates: string[]
}> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __partialArgsSnapshots?: string[]
      __rowStates?: string[]
    }
    return {
      snapshots: w.__partialArgsSnapshots ?? [],
      rowStates: w.__rowStates ?? [],
    }
  })
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
  opts: { chunkDelayMs?: number; firstFrameDelayMs?: number } = {},
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
  // 首片额外停留:dev 首次编译 / hydration 下,卡片挂载与自动展开需要一点时间;
  // 若首片窗口太短,采样器看到的第一个文本会是后续片,「出现过首片 a」就会假红。
  const firstFrameDelay = opts.firstFrameDelayMs ?? 0
  await page.addInitScript(
    (
      { sse, delay, firstFrameDelay }: {
        sse: string
        delay: number
        firstFrameDelay: number
      },
    ) => {
      const orig = window.fetch.bind(window)
      const probe = window as unknown as {
        __sseFetchHits?: number
        __sseFrames?: string[]
        __sseEnqueueTimes?: number[]
      }
      probe.__sseFetchHits = 0
      probe.__sseFrames = []
      probe.__sseEnqueueTimes = []
      window.fetch = async (input, init) => {
        const url =
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : (input as Request).url
        if (!url.includes('/ai/chat/stream')) return orig(input, init)
        probe.__sseFetchHits = (probe.__sseFetchHits ?? 0) + 1
        const enc = new TextEncoder()
        const parts = sse.split(/(?=id: )/).filter((p) => p.length > 0)
        const body = new ReadableStream<Uint8Array>({
          start(controller) {
            // ⚠️ 不要写成 `async start(controller) { ... await setTimeout ... }`:
            // start() 返回长期 pending 的 Promise 时,浏览器会推迟把 Response 交付给
            // fetch 调用方,逐帧 enqueue 的数据全部攒到 close() 之后才被读到 ——
            // 表现成「流期间零渲染、流末一次性出现终态卡」,是**夹具失真**而非产品
            // 缺陷(2026-11-05 真跑实测:工具卡在 21.9s 才进 DOM 且已 success)。
            // 正解:start() 同步立即返回,由独立异步泵逐帧推送。
            void (async () => {
              try {
                for (const [i, p] of parts.entries()) {
                  if (init?.signal?.aborted) break
                  // 逐行 enqueue:与真实 SSE runner 的按行读一致,避免「整块当一行」
                  // 让 parseToolCallArgsDeltaFrame 的 JSON.parse 吃到 id: 前缀。
                  for (const row of p.split('\n')) {
                    if (!row) continue
                    probe.__sseFrames?.push(row.slice(0, 100))
                    controller.enqueue(enc.encode(`${row}\n`))
                  }
                  probe.__sseEnqueueTimes?.push(Date.now())
                  const wait = delay + (i === 0 ? firstFrameDelay : 0)
                  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
                }
                controller.close()
              } catch {
                try {
                  controller.close()
                } catch {
                  /* 已关闭 */
                }
              }
            })()
          },
        })
        return new Response(body, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
        })
      }
    },
    { sse, delay, firstFrameDelay },
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
    args: { query: 'ab' },
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
  // 逐帧流按 chunkDelayMs 推进(9 帧 + 首片额外停留),默认 30s 测试超时会被流
  // 本身吃满 ⇒ 放宽到 90s。
  test.setTimeout(90000)

  // 2026-11-05 逐层二分定论(修复已落地,本用例即回归锁):
  //   ① api-client 帧分发完好(真实 dist 冒烟 3/3),handler 写 store 完好
  //      (浏览器真跑 5/5 回调、msgFound=true、toolCalls=1 逐帧可见);
  //   ② store → MessageList 投影完好(mode=steps,首帧后 76ms 即见 toolCalls=1);
  //   ③ 真因在 MessageItem 的**渲染结构**:活动组 StreamGroup 挂在 showTyping
  //      三元的 else 分支里 —— 助手正文为空且流式时只渲染 TypingIndicator,
  //      工具卡整段不进 DOM,直到正文 chunk 到达才一次性以 success 终态出现。
  //      修复 = stepSectionsCount 上移并作为退出 typing 占位的判据(showTyping
  //      须同时满足「零活动区段」),把活动组挂载与正文是否为空解耦。
  //   ④ 夹具侧另修一处:ReadableStream 的 async start() 里 await 会推迟 Response
  //      交付,逐帧数据被攒到流末 —— 改为 start() 同步返回 + 独立异步泵逐帧推送。
  //   断言不放宽(≥2 个不同文本、含首片 a 与后续 abc、长度递增、终态卸载)。
  test('逐帧推进 partial 预览,complete 后收敛为终态', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('pageerror', (err) => consoleErrors.push(err.message))

    await mockLoggedInUi(page)
    await installPartialArgsProbe(page)
    await mockConversation(page, 'e2e-conv-tool-args-delta')
    // 放慢逐帧节奏:预览块只在 running + argsStreaming 窗口内存在,且需先点开卡片,
    // 留足观察窗才能实证「同一预览块文本逐片增长」而非一次性到达。
    await mockToolCallArgsDeltaStream(page, DELTA_FRAMES, {
      chunkDelayMs: 1800,
      firstFrameDelayMs: 2500,
    })

    await page.goto('/chat')
    await page.waitForLoadState('domcontentloaded')
    // 硬断言:输入框没渲染出来就是本用例真失败,绝不能 catch 后 return 变成静默通过。
    const textarea = page.locator('textarea').first()
    await textarea.waitFor({ state: 'visible', timeout: 20000 })
    await textarea.fill('搜一下 abc')
    await page.keyboard.press('Enter')

    // 卡片随 delta 首片挂载(行级 testid 含 toolCallId c1)。此处**不做**硬等待:
    // 若卡片始终不挂载,先跑完流让页面内采样器留足分层证据,再由下方
    // expect(row).toBeAttached() 严格判失败,避免 waitFor 超时把证据吞掉。
    // 展开由页面内探针负责(自动点击且遇重挂载会补点),测试线程不再 click
    // —— 会与探针互相抵消成折叠。
    const row = page.getByTestId('tool-call-row-c1')

    const partial = page.getByTestId('tool-call-partial-args')
    // 先等 mock 流全部发出(9 帧 × id + data 两行 = 18 行)并被消费。若直接判
    // toHaveCount(0),预览块「从未渲染」也会立即通过 ⇒ 采样器还没记录任何文本
    // 就被读走,这是最容易漏掉的一型假绿。
    await page.waitForFunction(
      () => {
        const w = window as unknown as { __sseFrames?: string[] }
        return (w.__sseFrames?.length ?? 0) >= 18
      },
      undefined,
      { timeout: 45000 },
    )
    await page.waitForTimeout(600)
    // 收尾:complete 帧清预览、tool-result 收敛卡片、finally 兜底把残留 running
    // 卡置 cancelled ⇒ 预览块必须卸载且卡片仍挂载。
    await expect(partial).toHaveCount(0, { timeout: 10000 })
    await expect(row).toBeAttached()

    // 逐片证据:采样器见过至少 2 个不同文本,且确实出现过首片 a 与后续 abc,
    // 文本随帧变长 ⇒ 是逐片渐进渲染,而非一次性把完整 args 写进预览。
    const diag = await page.evaluate(() => {
      const w = window as unknown as {
        __sseFetchHits?: number
        __sseFrames?: string[]
      }
      return { hits: w.__sseFetchHits ?? 0, frames: w.__sseFrames ?? [] }
    })
    const { snapshots, rowStates } = await readPartialArgsSnapshots(page)
    const distinct = [...new Set(snapshots)]
    const diagText =
      `预览快照=${JSON.stringify(distinct)} 状态历史=${JSON.stringify(rowStates)} ` +
      `fetchHits=${diag.hits} frames=${diag.frames.length} ` +
      `first=${diag.frames[0] ?? ''} pageErrors=${JSON.stringify(consoleErrors)}`
    expect(distinct.length, diagText).toBeGreaterThanOrEqual(2)
    expect(distinct.some((t) => t.includes('"query": "a"'))).toBe(true)
    expect(distinct.some((t) => t.includes('abc'))).toBe(true)
    expect(Math.max(...distinct.map((t) => t.length))).toBeGreaterThan(
      Math.min(...distinct.map((t) => t.length)),
    )

    // 不应有未捕获页面异常
    expect(consoleErrors).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
