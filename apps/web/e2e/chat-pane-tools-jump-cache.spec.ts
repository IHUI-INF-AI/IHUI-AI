// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 新文件(票 G-935 补测):普通注释头,不伪造溯源水印。

import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'

/**
 * 票 G-935 · 多窗格聊天四片中"窗格化续传 / 工具面板 / 缓存隔离 / 跳转总线门控"的真浏览器核验
 * (AGENTS.md §17:UI 改动必须真机验证)
 *
 * 差集口径(为什么是这四条用例):
 * - 片①事件面 paneId / 片②stream-handlers 注 store ⇒ 已由 `chat-pane-parallel-stream.spec.ts`(双流互不顶)覆盖;
 * - 滚动位 + DOM 隔离 ⇒ 已由 `chat-pane-split-scroll-restore.spec.ts` 覆盖;
 * - 本 spec 补的是剩下两格:
 *   片③ 工具面板窗格化 + 断点续传(窗格腿/根腿)
 *   片④ 持久缓存按窗格隔离 + 跳转总线窗格门控
 *
 * 反假绿/暴露缺口的两条硬断言(按票面"互不顶"口径,不代修生产码):
 * ① 工具面板:在 pane-1 内点「工具面板」开关,票面口径 = pane-1 的面板体亮、根格不亮。
 *    现读生产码取证(缺口A):mode-switcher.tsx:59-60 的开关读写的是**根单例** useAiToolsPanelStore,
 *    而面板体 ai-side-panel-tools.tsx:292 用 usePaneAiToolsPanelStore(Provider 内=窗格实例)。
 *    ⇒ 本用例预期红,红即证据;诊断快照(两格可见态 + 两枚 persist 键)在断言前落进 annotations。
 * ④b 窗格续传(G-935 缺口B 已修复):布局树持久化 ⇒ reload 后 pane-1 重挂载;
 *    ChatPaneBody recentMessages 预填充 ⇒ 半截助手消息仍能捕获;
 *    窗格 chat store persist 落盘 ⇒ reload 后 resume/status→resume 真续上,孤儿快照收尾为 true。
 *    同腿的根窗格对照(④a)必须真续上,证明两边共用同一套续接机制。
 *
 * 全链路 route mock + 页面内 fetch 泵(形态照抄 chat-pane-parallel-stream.spec.ts,不依赖活后端)。
 * 登录契约按票面:显式 seed(localStorage ihui-auth zustand persist 形态 + 非 httpOnly auth_token cookie)。
 */

const DRAG_TYPE = 'application/x-ihui-conversation'
/** 拆分入口文案:zh-CN「向右拆分」/ en "Split right" */
const SPLIT_ENTRY_RE = /向右拆分|split right/i

const ROOT_PANE = 'pane-root'
const SECOND_PANE = 'pane-1'

const CONV_A = 'e2e-tjc-conv-a'
const CONV_B = 'e2e-tjc-conv-b'
const CONV_LONG = 'e2e-tjc-conv-long'
const CONV_R = 'e2e-tjc-conv-resume'
const TITLE_A = 'E2E 窗格取证甲'
const TITLE_B = 'E2E 窗格取证乙'
const TITLE_LONG = 'E2E 窗格取证长会话'
const TITLE_R = 'E2E 窗格取证续传'

/** 流式增量探针(缓存隔离用例) */
const DELTA_COUNT = 3
const xMarker = (n: number): string => `TJC-X-DELTA-${n}`
const yMarker = (n: number): string => `TJC-Y-DELTA-${n}`
const X_PAYLOAD = Array.from({ length: DELTA_COUNT }, (_, i) => xMarker(i + 1)).join('')
const Y_PAYLOAD = Array.from({ length: DELTA_COUNT }, (_, i) => yMarker(i + 1)).join('')

const PROMPT_ROOT = 'e2e tjc root prompt'
const PROMPT_PANE = 'e2e tjc pane prompt'

/** 续传用例的前缀/续尾探针 */
const RESUME_PREFIX = 'TJC-RESUME-PREFIX'
const RESUME_TAIL = 'TJC-RESUME-TAIL'
const PANE_ORPHAN_PREFIX = 'TJC-PANE-ORPHAN-PREFIX'

type HistoryKind = 'pair' | 'long' | 'userOnly'

interface ConvSpec {
  readonly id: string
  readonly title: string
  readonly kind: HistoryKind
}

const SPEC_A: ConvSpec = { id: CONV_A, title: TITLE_A, kind: 'pair' }
const SPEC_B: ConvSpec = { id: CONV_B, title: TITLE_B, kind: 'pair' }
const SPEC_LONG: ConvSpec = { id: CONV_LONG, title: TITLE_LONG, kind: 'long' }
const SPEC_R: ConvSpec = { id: CONV_R, title: TITLE_R, kind: 'userOnly' }

function convRow(spec: ConvSpec) {
  const now = new Date().toISOString()
  return {
    id: spec.id,
    userId: 'e2e',
    title: spec.title,
    model: 'test-model',
    systemPrompt: null,
    metadata: null,
    lastMessageAt: now,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * pair:两条历史(user+assistant),给拆分/工具/缓存用例;
 * long:60 条可滚出真实高度的历史(不超过 VIRTUAL_THRESHOLD=60,整块渲染),给跳转门控用例;
 * userOnly:末条是 user —— 这正是"半截流 reload"时服务端的真实形态(未落库的 assistant 不在快照里),
 *           续传守卫(resume-stream.ts:361-365)只在末条非"另一条 assistant"时才放行。
 */
function historyRows(spec: ConvSpec) {
  const base = Date.now() - 60 * 60_000
  if (spec.kind === 'userOnly') {
    return [
      {
        id: `${spec.id}-m-0`,
        conversationId: spec.id,
        role: 'user' as const,
        content: `${spec.id} 的历史提问(单条,末条=user)`,
        reasoning: null,
        tokens: 1,
        metadata: null,
        createdAt: new Date(base).toISOString(),
      },
    ]
  }
  if (spec.kind === 'long') {
    return Array.from({ length: 60 }, (_, i) => ({
      id: `${spec.id}-m-${i}`,
      conversationId: spec.id,
      role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
      content: Array.from({ length: 12 }, (_, k) =>
        `${spec.title} 第${i}段${k} —— 跳转门控取证正文,重复以撑出真实滚动高度。`.repeat(3),
      ).join('\n\n'),
      reasoning: null,
      tokens: 1,
      metadata: null,
      createdAt: new Date(base + i * 1000).toISOString(),
    }))
  }
  return [
    {
      id: `${spec.id}-m-0`,
      conversationId: spec.id,
      role: 'user' as const,
      content: `${spec.id} 的历史提问`,
      reasoning: null,
      tokens: 1,
      metadata: null,
      createdAt: new Date(base).toISOString(),
    },
    {
      id: `${spec.id}-m-1`,
      conversationId: spec.id,
      role: 'assistant' as const,
      content: `${spec.id} 的历史回答`,
      reasoning: null,
      tokens: 1,
      metadata: null,
      createdAt: new Date(base + 1000).toISOString(),
    },
  ]
}

function json(body: unknown): { status: number; headers: Record<string, string>; body: string } {
  return {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code: 0, message: 'ok', data: body }),
  }
}

/**
 * auth 面 + 会话面全量 mock(注册顺序 = 兜底在前、专档在后;形态抄自 parallel-stream)。
 * cost-estimate 必须给全字段,否则 CostEstimateBar 拿 undefined.toFixed 全局崩。
 */
async function mockBackend(page: Page, specs: readonly ConvSpec[]): Promise<void> {
  const rows = (id: string) => {
    const spec = specs.find((s) => s.id === id)
    return spec ? historyRows(spec) : []
  }

  await page.route('**/api/**', (route) => route.fulfill(json({})))
  await page.route('**/api/chat/cost-estimate**', (route) =>
    route.fulfill(
      json({ estimatedTokensIn: 0, estimatedTokensOut: 0, estimatedCostUsd: 0, priced: true }),
    ),
  )
  await page.route('**/auth/refresh**', (route) =>
    route.fulfill(
      json({
        accessToken: 'e2e-tjc-access',
        refreshToken: 'e2e-tjc-refresh',
        expiresIn: 3600,
      }),
    ),
  )
  await page.route('**/auth/me**', (route) =>
    route.fulfill(
      json({ user: { id: 'e2e', nickname: 'E2E', roleId: 1, avatar: null, phone: '' } }),
    ),
  )
  await page.route('**/api/chat/conversations**', async (route) => {
    const req = route.request()
    const method = req.method()
    const pathname = new URL(req.url()).pathname
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204 })
      return
    }
    const messagesMatch = pathname.match(/^\/api\/chat\/conversations\/([^/]+)\/messages$/)
    if (messagesMatch) {
      const list = rows(messagesMatch[1] ?? '')
      await route.fulfill(
        json({
          messages: list,
          page: 1,
          pageSize: 50,
          total: list.length,
          hasMore: false,
          nextCursor: list.length > 0 ? 'e2e-tjc-cursor' : null,
        }),
      )
      return
    }
    const detailMatch = pathname.match(/^\/api\/chat\/conversations\/([^/]+)$/)
    if (detailMatch) {
      const spec = specs.find((s) => s.id === (detailMatch[1] ?? ''))
      if (!spec) {
        await route.fulfill({
          status: 404,
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        return
      }
      await route.fulfill(json({ conversation: convRow(spec) }))
      return
    }
    if (pathname === '/api/chat/conversations' && method === 'GET') {
      await route.fulfill(
        json({
          conversations: specs.map(convRow),
          page: 1,
          pageSize: 20,
          total: specs.length,
        }),
      )
      return
    }
    if (method === 'POST') {
      const first = specs[0]
      await route.fulfill(json({ conversation: first ? convRow(first) : convRow(SPEC_A) }))
      return
    }
    await route.fulfill(json({}))
  })
}

/** 续传两端点:status=未落库(走续生成腿),resume=一次性 SSE 尾帧;计数在 Node 侧闭包 */
interface ResumeCounters {
  statusGets: number
  resumePosts: number
}

async function mockResumeEndpoints(
  page: Page,
  counters: ResumeCounters,
  tail: string,
): Promise<void> {
  // dev 下 resolveStreamApiBaseUrl()=http://127.0.0.1:8802(api-base-url.ts:198)⇒ resume POST
  // 是跨源请求,预检 OPTIONS 与响应都必须带 CORS 头,否则浏览器拦下、POST 根本到不了 handler。
  const cors: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
  await page.route('**/api/chat/resume/status**', async (route) => {
    if (route.request().method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    counters.statusGets += 1
    await route.fulfill({
      ...json({ exists: true, completed: false, content: '', updatedAt: null }),
      headers: { 'Content-Type': 'application/json', ...cors },
    })
  })
  await page.route('**/api/chat/resume', async (route) => {
    const method = route.request().method()
    if (method === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors })
      return
    }
    if (method === 'POST') {
      counters.resumePosts += 1
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', ...cors },
        body: sseChunk(tail) + sseDone(),
      })
      return
    }
    await route.fulfill(json({}))
  })
}

/** 已登录态(先例:e2e/sidebar-visual.spec.ts:417-444;同 parallel-stream 的 seedLoggedIn) */
async function seedLoggedIn(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-tjc-access',
      url: 'http://localhost:8801',
      httpOnly: false,
      secure: false,
      sameSite: 'Lax' as const,
    },
  ])
  await page.addInitScript(() => {
    localStorage.setItem(
      'ihui-auth',
      JSON.stringify({
        state: {
          isAuthenticated: true,
          user: { id: 'e2e', nickname: 'E2E', roleId: 1, avatar: null, phone: '' },
        },
        version: 0,
      }),
    )
    localStorage.setItem('sidebar-collapsed', 'false')
  })
}

// ──────────────────────────────────────────────────────────────────────────
// 可控 SSE 泵(形态抄自 chat-pane-parallel-stream.spec.ts:262-433,账目/把手同构)
// ──────────────────────────────────────────────────────────────────────────

type PumpState = 'open' | 'closed' | 'aborted'

interface PumpWindow {
  __ihuiStreamPump?: {
    streams: Record<string, { frames: string[]; state: PumpState }>
    requests: Array<string | null>
  }
  __ihuiStreamPumps?: Record<string, { push: (frame: string) => boolean; close: () => boolean }>
}

function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`
}

function sseDone(): string {
  return `data: ${JSON.stringify({ type: 'done' })}\n\n`
}

async function installStreamPump(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as PumpWindow & typeof window
    const registry: NonNullable<PumpWindow['__ihuiStreamPump']> = { streams: {}, requests: [] }
    w.__ihuiStreamPump = registry
    const originalFetch = window.fetch.bind(window)

    const makePump = (cid: string | null, signal?: AbortSignal | null) => {
      const encoder = new TextEncoder()
      let controller: ReadableStreamDefaultController | null = null
      const entry = { frames: [] as string[], state: 'open' as PumpState }
      const stream = new ReadableStream({
        start(c) {
          controller = c
        },
      })
      const key = cid ?? 'unknown'
      registry.streams[key] = entry
      registry.requests.push(cid)

      const abort = (): void => {
        if (entry.state !== 'open') return
        entry.state = 'aborted'
        try {
          controller?.error(new DOMException('e2e tjc stream aborted', 'AbortError'))
        } catch {
          /* 已关闭:状态照常落账 */
        }
      }
      if (signal) {
        if (signal.aborted) abort()
        else signal.addEventListener('abort', abort)
      }
      const pump = {
        push(frame: string): boolean {
          if (entry.state !== 'open' || !controller) return false
          entry.frames.push(frame)
          controller.enqueue(encoder.encode(frame))
          return true
        },
        close(): boolean {
          if (entry.state !== 'open' || !controller) return false
          entry.state = 'closed'
          try {
            controller.close()
          } catch {
            /* noop */
          }
          return true
        },
      }
      w.__ihuiStreamPumps = w.__ihuiStreamPumps ?? {}
      w.__ihuiStreamPumps[key] = pump
      return new Response(stream, {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
      })
    }

    w.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : (input as Request).url
      if (!url.includes('/ai/chat/stream')) return originalFetch(input as RequestInfo, init)

      let cid: string | null = null
      try {
        const raw = typeof init?.body === 'string' ? init.body : ''
        const parsed = JSON.parse(raw || '{}') as { metadata?: { conversationId?: unknown } }
        const value = parsed.metadata?.conversationId
        cid = typeof value === 'string' && value ? value : null
      } catch {
        cid = null
      }
      return Promise.resolve(makePump(cid, init?.signal))
    }
  })
}

async function pumpState(page: Page, cid: string): Promise<PumpState | 'none'> {
  return page.evaluate((key) => {
    const w = window as unknown as PumpWindow & typeof window
    return w.__ihuiStreamPump?.streams[key]?.state ?? 'none'
  }, cid)
}

async function pumpPush(page: Page, cid: string, frame: string): Promise<boolean> {
  return page.evaluate(
    ({ key, text }) => {
      const w = window as unknown as typeof window & {
        __ihuiStreamPumps?: Record<string, { push: (f: string) => boolean }>
      }
      return w.__ihuiStreamPumps?.[key]?.push(text) ?? false
    },
    { key: cid, text: frame },
  )
}

async function pumpClose(page: Page, cid: string): Promise<boolean> {
  return page.evaluate((key) => {
    const w = window as unknown as typeof window & {
      __ihuiStreamPumps?: Record<string, { close: () => boolean }>
    }
    return w.__ihuiStreamPumps?.[key]?.close() ?? false
  }, cid)
}

// ──────────────────────────────────────────────────────────────────────────
// DOM 探针 / 交互 helper(作用域纪律同 G-934/parallel-stream:绝不裸取重复 id)
// ──────────────────────────────────────────────────────────────────────────

function paneList(page: Page, pane: string): Locator {
  return page.locator(`[data-pane-leaf="${pane}"] [data-testid="message-list-inline-panel"]`)
}

function rootList(page: Page): Locator {
  return page.locator('[data-testid="message-list-inline-panel"]').first()
}

async function scrollTopOf(page: Page, pane: string): Promise<number> {
  return paneList(page, pane).evaluate((el) => el.scrollTop)
}

/** 把目标消息滚到列表视区顶部(几何算式,抄自 G-934) */
async function scrollToMessageTop(page: Page, pane: string, messageId: string): Promise<number> {
  await paneList(page, pane).evaluate((el, id) => {
    const target = el.querySelector<HTMLElement>(`[data-message-id="${id}"]`)
    if (!target) throw new Error(`目标消息未渲染进 DOM:${id}`)
    const box = el.getBoundingClientRect()
    const top = target.getBoundingClientRect().top - box.top + el.scrollTop
    el.scrollTop = top
    return el.scrollTop
  }, messageId)
  await page.waitForTimeout(250)
  return scrollTopOf(page, pane)
}

async function sendInPane(page: Page, pane: string, text: string): Promise<void> {
  const box = page.locator(`[data-pane-leaf="${pane}"] textarea`).first()
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill(text)
  await page.locator(`[data-pane-leaf="${pane}"] [data-testid="send-button"]`).first().click()
}

async function sendInRootSingle(page: Page, text: string): Promise<void> {
  const box = page.locator('textarea').first()
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill(text)
  await page.locator('[data-testid="send-button"]').first().click()
}

/** 合成一次 D22 拖拽落格(手搓 DataTransfer 才带得动自定义 MIME;落点在内层 [data-pane-empty]) */
async function dropConversationIntoPane(
  page: Page,
  paneId: string,
  conversationId: string,
  title: string,
): Promise<void> {
  const dropped = await page.evaluate(
    ({ paneId, payload, dragType }) => {
      const el = document.querySelector<HTMLElement>(
        `[data-pane-leaf="${paneId}"] [data-pane-empty]`,
      )
      if (!el) return 'no-drop-zone'
      const dt = new DataTransfer()
      dt.setData(dragType, payload)
      dt.dropEffect = 'copy'
      el.dispatchEvent(
        new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }),
      )
      el.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
      return 'dispatched'
    },
    { paneId, payload: JSON.stringify({ id: conversationId, title }), dragType: DRAG_TYPE },
  )
  expect(dropped, `${paneId} 必须暴露 [data-pane-empty] 落点`).toBe('dispatched')
}

async function splitFrom(page: Page): Promise<void> {
  const entry = page.getByRole('button', { name: SPLIT_ENTRY_RE })
  await expect(entry).toHaveCount(1, { timeout: 30_000 })
  await entry.first().click()
  await expect(page.locator('[data-pane-split-root]')).toHaveAttribute(
    'data-pane-leaf-count',
    '2',
    { timeout: 30_000 },
  )
}

/** 两格两会话(根=甲,pane-1=乙);返回时两格历史就位 */
async function prepareTwoPanes(page: Page): Promise<void> {
  await seedLoggedIn(page)
  await mockBackend(page, [SPEC_A, SPEC_B, SPEC_LONG, SPEC_R])
  await installStreamPump(page)
  await page.goto('/chat')

  await page.getByRole('button', { name: TITLE_A }).first().click()
  await expect(rootList(page)).toHaveAttribute('data-window-total', '2', { timeout: 30_000 })
  await splitFrom(page)
  await expect(page.locator(`[data-pane-leaf="${ROOT_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    CONV_A,
  )
  await dropConversationIntoPane(page, SECOND_PANE, CONV_B, TITLE_B)
  await expect(paneList(page, ROOT_PANE)).toHaveAttribute('data-window-total', '2', {
    timeout: 30_000,
  })
  await expect(paneList(page, SECOND_PANE)).toHaveAttribute('data-window-total', '2', {
    timeout: 30_000,
  })
}

/** 两格同一枚长会话(跳转总线门控的现场:消息 id 在两格各出现一次) */
async function prepareSameConversationTwoPanes(page: Page): Promise<void> {
  await seedLoggedIn(page)
  await mockBackend(page, [SPEC_A, SPEC_B, SPEC_LONG, SPEC_R])
  await page.goto('/chat')
  await page.getByRole('button', { name: TITLE_LONG }).first().click()
  await expect(rootList(page)).toHaveAttribute('data-window-total', '60', { timeout: 30_000 })
  await splitFrom(page)
  await dropConversationIntoPane(page, SECOND_PANE, CONV_LONG, TITLE_LONG)
  await expect(paneList(page, ROOT_PANE)).toHaveAttribute('data-window-total', '60', {
    timeout: 30_000,
  })
  await expect(paneList(page, SECOND_PANE)).toHaveAttribute('data-window-total', '60', {
    timeout: 30_000,
  })
  await expect(page.locator(`[data-pane-leaf="${ROOT_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    CONV_LONG,
  )
  await expect(page.locator(`[data-pane-leaf="${SECOND_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    CONV_LONG,
  )
}

/** localStorage persist 快照读取(zustand persist 形态 {state, version}) */
interface PersistedChatMessage {
  id?: string
  role?: string
  content?: string
  streamCompleted?: boolean
}

async function readPersistedChat(
  page: Page,
  key: string,
): Promise<{ conversationId: string | null; messages: PersistedChatMessage[] } | null> {
  return page.evaluate((k) => {
    const raw = localStorage.getItem(k)
    if (!raw) return null
    const blob = JSON.parse(raw) as {
      state?: {
        conversationId?: string | null
        recentMessages?: { conversationId: string; messages: PersistedChatMessage[] } | null
      }
    }
    const rm = blob.state?.recentMessages
    return { conversationId: blob.state?.conversationId ?? null, messages: rm?.messages ?? [] }
  }, key)
}

// ──────────────────────────────────────────────────────────────────────────
// 用例
// ──────────────────────────────────────────────────────────────────────────

test.describe('G-935 片③④ 工具面板窗格化 / 跳转总线门控 / 缓存隔离 / 续传', () => {
  test.setTimeout(180_000)

  test('① 工具面板窗格化:pane-1 内点「工具面板」只该点亮 pane-1 的面板体(票面口径;现码预期红=缺口A)', async ({
    page,
  }) => {
    await prepareTwoPanes(page)

    const panePanel = page.locator(
      `[data-pane-leaf="${SECOND_PANE}"] [data-testid="ai-side-panel-tools"]`,
    )
    const rootPanel = page.locator(
      `[data-pane-leaf="${ROOT_PANE}"] [data-testid="ai-side-panel-tools"]`,
    )
    // 初始:两格面板体都收着(每格恒挂载,靠 className hidden 收合)
    await expect(panePanel).toBeHidden()
    await expect(rootPanel).toBeHidden()

    // 在 pane-1 的输入区里打开模式切换器,点「工具面板」。
    // 缺口C(2026-10-22 已修,鼠标点击腿恢复):此前窄窗格下发送按钮与 mode-switcher
    // 触发器几何重叠,鼠标点击被 send-button 拦截(Playwright hit-target 3 分钟不通过,
    // 实机证据+截图),用例曾以键盘 Enter 绕行、重叠事实只落 annotations。
    // 修法=globals.css .ai-input-toolbar @container ≤335 档右簇换行避让,命中区留在本窗格内;
    // 本探针随之升级为硬断言(中心点必须命中自身),再走真实鼠标 click 腿。
    const trigger = page
      .locator(`[data-pane-leaf="${SECOND_PANE}"] [data-testid="mode-switcher"]`)
      .first()
    const overlap = await trigger.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      if (top === el || el.contains(top)) return 'self'
      const btn = top instanceof Element ? top.closest('button') : null
      return `covered-by:${top?.nodeName ?? '?'}#${btn?.getAttribute('data-testid') ?? ''}`
    })
    expect(
      overlap,
      '缺口C 回归防线:窄窗格下 mode-switcher 触发器中心命中点必须是自身(不得被 send-button 拦截)',
    ).toBe('self')
    await trigger.click()
    await page.locator('[data-testid="menu-tools-panel"]').click()

    // 诊断快照先落账(红也要带证据):两格可见态 + 两枚 persist 键
    const diag = await page.evaluate(() => {
      const read = (sel: string): string => {
        const el = document.querySelector(sel)
        if (!el) return 'missing'
        return el.classList.contains('hidden') ? 'hidden' : 'visible'
      }
      return {
        panePanel: read('[data-pane-leaf="pane-1"] [data-testid="ai-side-panel-tools"]'),
        rootPanel: read('[data-pane-leaf="pane-root"] [data-testid="ai-side-panel-tools"]'),
        rootKey: localStorage.getItem('ihui-ai-tools-panel'),
        paneKey: localStorage.getItem('ihui-ai-tools-panel-pane-1'),
      }
    })
    test.info().annotations.push({
      type: 'note',
      description: `pane-1 开关点击后的现场:${JSON.stringify(diag)}(缺口A 取证:mode-switcher.tsx:59-60 读写根单例,面板体 ai-side-panel-tools.tsx:292 读窗格实例)`,
    })

    // 票面口径断言(不代修):pane-1 亮、根格不亮 ⇒ 现码下预期红
    await expect(
      panePanel,
      '缺口A:pane-1 内的「工具面板」开关写的是根单例(mode-switcher.tsx:59-60),窗格自身面板体读窗格实例 ⇒ pane-1 自己的面板点不开',
    ).toBeVisible({ timeout: 5_000 })
    await expect(rootPanel, '缺口A 反证:根格面板体被 pane-1 的开关点亮(互不顶被破坏)').toBeHidden()
  })

  test('② 跳转总线门控:定向 pane-1 的事件根格不接;不带 paneId 的事件只根格接', async ({ page }) => {
    await prepareSameConversationTwoPanes(page)

    // 根格钉在 60% 处(m-36);pane-1 保持"落会话后自动跟随到底"的稳态 ⇒ 目标 m-24(40%):
    // 两格都该"向上"滚到中段,而基线一律用派发前实测值(不写死 0,防"本来就不在 0"假 moved)。
    const rootRecorded = await scrollToMessageTop(page, ROOT_PANE, `${CONV_LONG}-m-36`)
    expect(rootRecorded, '根格必须先有一个明显非 0 的基线位(否则"没动"没有牙)').toBeGreaterThan(200)
    const pane1Before = await scrollTopOf(page, SECOND_PANE)
    const target = `${CONV_LONG}-m-24`

    /** 单次原子快照:两格的目标消息高亮态 + 相对基线的位移(>60px 记 moved) */
    const jumpProbe = (baselines: Record<string, number>): Promise<string> =>
      page.evaluate(
        ({ target, baselines }) => {
          const parts: string[] = []
          for (const pane of ['pane-root', 'pane-1']) {
            const leaf = document.querySelector<HTMLElement>(`[data-pane-leaf="${pane}"]`)
            if (!leaf) throw new Error(`缺少窗格 DOM:${pane}`)
            const list = leaf.querySelector<HTMLElement>(
              '[data-testid="message-list-inline-panel"]',
            )
            if (!list) throw new Error(`窗格 ${pane} 没有消息列表`)
            const msg = leaf.querySelector<HTMLElement>(`[data-message-id="${target}"]`)
            if (!msg) throw new Error(`窗格 ${pane} 里目标消息未渲染:${target}`)
            const hl = msg.classList.contains('animate-message-highlight-pulse')
            const moved = Math.abs(list.scrollTop - (baselines[pane] ?? 0)) > 60
            parts.push(`${pane}:${hl ? 'hl' : 'no'}:${moved ? 'moved' : 'still'}`)
          }
          return parts.join('|')
        },
        { target, baselines },
      )

    const dispatchJump = (detail: { messageId: string; paneId?: string | null }): Promise<void> =>
      page.evaluate((d) => {
        window.dispatchEvent(new CustomEvent('ihui:scroll-to-message', { detail: d }))
      }, detail)

    // 腿1:定向 pane-1 ⇒ 只有 pane-1 滚 + 高亮;根格纹丝不动、不高亮
    await dispatchJump({ messageId: target, paneId: SECOND_PANE })
    await expect
      .poll(() => jumpProbe({ [ROOT_PANE]: rootRecorded, [SECOND_PANE]: pane1Before }), {
        timeout: 10_000,
        message: '定向 pane-1 的跳转没有只落 pane-1(门控失效)',
      })
      .toBe('pane-root:no:still|pane-1:hl:moved')

    // 等平滑滚动落定,记下 pane-1 的稳态位,再走腿2
    await page.waitForTimeout(800)
    const pane1Settled = await scrollTopOf(page, SECOND_PANE)

    // 腿2:不带 paneId(历史形态)⇒ matchesPaneEvent(undefined??null, null) 只放行根格;
    // pane-1 不得再动、不得再亮
    await dispatchJump({ messageId: target })
    await expect
      .poll(() => jumpProbe({ [ROOT_PANE]: rootRecorded, [SECOND_PANE]: pane1Settled }), {
        timeout: 10_000,
        message: '不带 paneId 的跳转没有只落根窗格(门控口径被破坏)',
      })
      .toBe('pane-root:hl:moved|pane-1:no:still')
  })

  test('③ 缓存隔离:两格各流一轮后,两枚 persist 快照各存各的、互不掺', async ({ page }) => {
    await prepareTwoPanes(page)

    await sendInPane(page, ROOT_PANE, PROMPT_ROOT)
    await expect.poll(() => pumpState(page, CONV_A), { timeout: 30_000 }).toBe('open')
    await sendInPane(page, SECOND_PANE, PROMPT_PANE)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('open')

    for (let i = 0; i < DELTA_COUNT; i += 1) {
      expect(await pumpPush(page, CONV_A, sseChunk(xMarker(i + 1)))).toBe(true)
      expect(await pumpPush(page, CONV_B, sseChunk(yMarker(i + 1)))).toBe(true)
    }
    expect(await pumpPush(page, CONV_A, sseDone())).toBe(true)
    expect(await pumpPush(page, CONV_B, sseDone())).toBe(true)
    expect(await pumpClose(page, CONV_A)).toBe(true)
    expect(await pumpClose(page, CONV_B)).toBe(true)

    // 渲染面先就位(证明两条流都写进了各自窗格的 store)
    await expect(paneList(page, ROOT_PANE)).toContainText(X_PAYLOAD, { timeout: 20_000 })
    await expect(paneList(page, SECOND_PANE)).toContainText(Y_PAYLOAD, { timeout: 20_000 })

    // 落盘面:根键 ihui-chat 只含甲载荷,窗格键 ihui-chat-pane-pane-1 只含乙载荷
    await expect
      .poll(
        async () => {
          const rootSnap = await readPersistedChat(page, 'ihui-chat')
          const paneSnap = await readPersistedChat(page, 'ihui-chat-pane-pane-1')
          const rootText = (rootSnap?.messages ?? []).map((m) => m.content ?? '').join('')
          const paneText = (paneSnap?.messages ?? []).map((m) => m.content ?? '').join('')
          return `${rootText.includes(X_PAYLOAD) ? 'R-has-X' : 'R-no-X'}|${
            rootText.includes(Y_PAYLOAD) ? 'R-has-Y' : 'R-no-Y'
          }|${paneText.includes(Y_PAYLOAD) ? 'P-has-Y' : 'P-no-Y'}|${
            paneText.includes(X_PAYLOAD) ? 'P-has-X' : 'P-no-X'
          }`
        },
        { timeout: 20_000, message: '两枚 persist 快照没有各自归位(缓存按窗格隔离被破坏)' },
      )
      .toBe('R-has-X|R-no-Y|P-has-Y|P-no-X')

    const rootSnap = await readPersistedChat(page, 'ihui-chat')
    const paneSnap = await readPersistedChat(page, 'ihui-chat-pane-pane-1')
    expect(rootSnap?.conversationId, '根键的 conversationId 归甲').toBe(CONV_A)
    expect(paneSnap?.conversationId, '窗格键的 conversationId 归乙').toBe(CONV_B)
  })

  test('④a 根窗格续传:半截流 reload ⇒ resume/status→resume 真续上(prefix+tail 同条消息)', async ({
    page,
  }) => {
    const counters: ResumeCounters = { statusGets: 0, resumePosts: 0 }
    await seedLoggedIn(page)
    await mockBackend(page, [SPEC_A, SPEC_B, SPEC_LONG, SPEC_R])
    await installStreamPump(page)
    // 续传端点必须在 reload 之前就注册(route 跨导航存活)
    await mockResumeEndpoints(page, counters, RESUME_TAIL)

    await page.goto('/chat')
    await page.getByRole('button', { name: TITLE_R }).first().click()
    await expect(rootList(page)).toHaveAttribute('data-window-total', '1', { timeout: 30_000 })

    await sendInRootSingle(page, 'e2e tjc resume prompt')
    await expect.poll(() => pumpState(page, CONV_R), { timeout: 30_000 }).toBe('open')
    expect(await pumpPush(page, CONV_R, sseChunk(RESUME_PREFIX))).toBe(true)
    // 前缀进 DOM = 已写 store = persist 同步落盘(reload 后 recentMessages 里带 streamCompleted:false)
    await expect(rootList(page)).toContainText(RESUME_PREFIX, { timeout: 20_000 })

    await page.reload()

    // 续接闭环:末条助手消息 = 前缀 + 续尾 逐字相连(ensureMessagePresent 补回 + appendToMessage)
    await expect(rootList(page)).toContainText(`${RESUME_PREFIX}${RESUME_TAIL}`, {
      timeout: 30_000,
    })
    expect(counters.statusGets, 'reload 后必须问过 resume/status').toBeGreaterThanOrEqual(1)
    expect(counters.resumePosts, '未落库 ⇒ 必须发起恰好一次 POST /api/chat/resume').toBe(1)
  })

  test('④b 窗格续传:半截流 reload ⇒ 布局重挂载 + pane-1 resume/status→resume 真续上', async ({
    page,
  }) => {
    const counters: ResumeCounters = { statusGets: 0, resumePosts: 0 }
    await seedLoggedIn(page)
    await mockBackend(page, [SPEC_A, SPEC_B, SPEC_LONG, SPEC_R])
    await installStreamPump(page)
    // 续传端点必须在 reload 之前就注册(route 跨导航存活)
    await mockResumeEndpoints(page, counters, RESUME_TAIL)

    await page.goto('/chat')
    await page.getByRole('button', { name: TITLE_R }).first().click()
    await expect(rootList(page)).toHaveAttribute('data-window-total', '1', { timeout: 30_000 })
    await splitFrom(page)
    // 必须落 CONV_R(userOnly,末条=user):CONV_B(pair,末条=另一条 assistant)会被
    // 续接守卫(resume-stream.ts:361-365)直接标 completed 不续 —— 那是守卫语义,不是缺腿。
    await dropConversationIntoPane(page, SECOND_PANE, CONV_R, TITLE_R)
    await expect(paneList(page, SECOND_PANE)).toHaveAttribute('data-window-total', '1', {
      timeout: 30_000,
    })

    await sendInPane(page, SECOND_PANE, PROMPT_PANE)
    await expect.poll(() => pumpState(page, CONV_R), { timeout: 30_000 }).toBe('open')
    expect(await pumpPush(page, CONV_R, sseChunk(PANE_ORPHAN_PREFIX))).toBe(true)
    // 前缀进 DOM = 已写窗格 store = persist/窗格缓存同步落盘(reload 后捕获孤儿的腿都在)
    await expect(paneList(page, SECOND_PANE)).toContainText(PANE_ORPHAN_PREFIX, {
      timeout: 20_000,
    })
    // 2026-10-23 修:窗格缓存落盘不是同步的 —— use-conversation-pane-cache.ts 的 persistCache
    // 是 200ms 合批。立刻 reload 会读到"孤儿到达前"的旧快照,而 reload 后 cacheHit 会跳过
    // recentMessages 预填充(chat-pane-body.tsx 的 shouldPrefillRecentMessages),孤儿捕获不到
    // ⇒ resume/status 一次都不问(CI 实测:reload 后窗格只剩历史 1 条)。这里把落盘面等到
    // 含孤儿再 reload —— 判的是"快照真进盘",不是加固定延时。
    await expect
      .poll(
        async () =>
          page.evaluate(() => window.localStorage.getItem('ihui-conversation-pane-cache') ?? ''),
        { timeout: 10_000, message: 'reload 前窗格缓存快照必须已落盘到含孤儿前缀' },
      )
      .toContain(PANE_ORPHAN_PREFIX)

    await page.reload()

    // 契约1:布局树持久化 ⇒ reload 后两叶重挂载,pane-1 仍绑 CONV_R(续传代码有宿主可点火)
    await expect(page.locator('[data-pane-leaf]')).toHaveCount(2, { timeout: 30_000 })
    await expect(page.locator(`[data-pane-leaf="${SECOND_PANE}"]`)).toHaveAttribute(
      'data-pane-conversation',
      CONV_R,
    )

    // 契约2:续接闭环 —— 窗格侧预填充/缓存捕获半截消息,历史结算后续尾逐字相连
    await expect(paneList(page, SECOND_PANE)).toContainText(`${PANE_ORPHAN_PREFIX}${RESUME_TAIL}`, {
      timeout: 30_000,
    })
    expect(counters.statusGets, 'reload 后 pane-1 必须问过 resume/status').toBeGreaterThanOrEqual(1)
    expect(counters.resumePosts, 'pane-1 未落库 ⇒ 必须发起恰好一次 POST /api/chat/resume').toBe(1)

    // 契约3:续接完成后窗格快照把孤儿消息收尾(不再是永挂的 streamCompleted:false)
    await expect
      .poll(
        async () => {
          const snap = await readPersistedChat(page, 'ihui-chat-pane-pane-1')
          const orphan = (snap?.messages ?? []).find((m) =>
            (m.content ?? '').includes(PANE_ORPHAN_PREFIX),
          )
          return orphan?.streamCompleted ?? 'missing'
        },
        { timeout: 20_000, message: 'pane-1 快照的孤儿消息必须写回 streamCompleted:true' },
      )
      .toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
