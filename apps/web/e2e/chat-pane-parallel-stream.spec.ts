// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

/**
 * 票60 / G-935 · 真并行多窗格的**双流式互不顶**(AGENTS.md §17:UI 改动必须真机验证)
 *
 * 票面点名的缺口逐字是:「两窗格承载不同会话 ⇒ 双流式互不顶」。
 * 既有实机件 `chat-pane-split-scroll-restore.spec.ts`(G-934)只证了滚动位与 DOM 隔离,
 * 一条流都没起过 ⇒ 本 spec 补的是"两条流同时在跑且互不顶"这一格。
 *
 * ── 为什么必须实机、且必须自己控流 ──
 * "互不顶"的失效型是**时序型**的(一条流的收尾把另一条的 abort 域/渲染态一起带走),
 * jsdom 里既没有真实布局也没有真实读环。而 `page.route` + `route.fulfill({ body })`
 * 在本仓 Playwright 版本里**只能一次性交整块 body**,没有"先冲第一段、停一停、再冲余下"
 * 的出口 ⇒ 用它永远证不出"两条流在同一瞬间都还在流式中"(只会出现"A 早已结束,B 才开始")。
 * 所以这里换一种取材面:在页面里包装 `globalThis.fetch`(init script,先于应用脚本装载),
 * 命中 `/ai/chat/stream` 时返回一个**由测试逐帧推送**的 `new Response(ReadableStream)`。
 * 被替掉的只有"网络那一段":传输层替身返回的仍是标准 Response,
 * `resp.body.getReader()` 读环、行缓冲、`parseStreamLine`、`streamChat` 的水位闸/去重/
 * abort 归因(`isAbortError`)、use-chat 的 batcher 与 store 写入**全部走生产码**
 * (取证:packages/api-client/src/client.ts:3026 `getStreamTransport()` →
 * stream-transport.ts:57 `createFetchStreamTransport()` 在调用时才解析 `fetch`,
 * 故 init script 的替换对 streamChat 生效)。
 * 由此得到三条只在"真逐帧"下才成立的判据:
 * ① 同一瞬间两个窗格各自 `stop-button` 在场(两枚 = 两条流同时活着,不是一条冒充两条);
 * ② 先结束的那条不改变另一条的流动态;
 * ③ 一格按"停止"只 abort 自己那一枚 AbortController(abort 域按 store 实例隔离,
 *    取证 use-chat/stream-runtime.ts:33 + use-chat.ts:43 `getStreamRuntime(chatStore).abortRef`)。
 *
 * ── 会话侧的既有事实(照抄 G-934 的实机结论,不重新推导)──
 * 拆分入口 = 面板头部 IconButton(aria-label「向右拆分」);窗格 DOM 钩子
 * `[data-pane-split-root]` / `[data-pane-leaf-count]` / `[data-pane-leaf="<paneId>"]`;
 * 空窗格落点 `[data-pane-empty]` 是**内层** div(React `onDrop` 挂这一层),
 * 自定义 MIME `application/x-ihui-conversation` 只有手搓 `DataTransfer` 才带得动;
 * 根窗格 id = `pane-root`,拆出来的那一格 = `pane-1`;窗格承载会话是写一次的
 * (`canDropToPane` 要求 `conversationId === null`)。
 * `[data-testid="message-list-inline-panel"]` 在多窗格下**每格一枚且 id 重复**
 * ⇒ 一律按 `[data-pane-leaf]` 作用域取,绝不裸取。
 * 登录态:`sidebar-visual.spec.ts:417-444` 的 localStorage `ihui-auth` + 非 httpOnly
 * `auth_token` cookie 先例(api 8802 本次不可用:另一席把 apps/api/src/constants.ts
 * 处于 staged-deletion,后端起不来 ⇒ 全链路 mock,不依赖任何真实响应)。
 *
 * ── 反假绿设计 ──
 * 每个断言都成对:甲的标记必须在根格**有**、在 pane-1 **无**;乙反之。
 * 且"两格同时在流式中"与"一格先收束另一格不受牵连"两次取证都走**同一次 DOM 读取**
 * (probePanes 单次 evaluate 快照),避免"先断言 A 成立、等 B 时 A 已翻"的串行假阳。
 */

const DRAG_TYPE = 'application/x-ihui-conversation'
/** 拆分入口文案:zh-CN「向右拆分」/ en "Split right" */
const SPLIT_ENTRY_RE = /向右拆分|split right/i

const ROOT_PANE = 'pane-root'
const SECOND_PANE = 'pane-1'

const CONV_A = 'e2e-parallel-conv-a'
const CONV_B = 'e2e-parallel-conv-b'
const TITLE_A = 'E2E 并行流式取证甲'
const TITLE_B = 'E2E 并行流式取证乙'

/** 历史行里的独占探针(ASCII:textContent 比对不吃 CJK 分词/换行的歧义) */
const HIST_A = 'HIST-AAA-ONLY-ROOT-PANE'
const HIST_B = 'HIST-BBB-ONLY-PANE-ONE'

/** 流式增量探针:甲格只该见到 X,乙格只该见到 Y */
const DELTA_COUNT = 3
const xMarker = (n: number): string => `PANE-X-DELTA-${n}`
const yMarker = (n: number): string => `PANE-Y-DELTA-${n}`
const X_MARKERS = Array.from({ length: DELTA_COUNT }, (_, i) => xMarker(i + 1))
const Y_MARKERS = Array.from({ length: DELTA_COUNT }, (_, i) => yMarker(i + 1))
/** 三帧增量在 store 里是逐字拼接的正文 ⇒ 期望的最终助手消息文本就是这一串(无分隔符) */
const X_PAYLOAD = X_MARKERS.join('')
const Y_PAYLOAD = Y_MARKERS.join('')

const PROMPT_ROOT = 'e2e parallel root prompt'
const PROMPT_PANE = 'e2e parallel pane prompt'

interface ConvSpec {
  readonly id: string
  readonly title: string
  /** 该会话独有的历史探针 */
  readonly probe: string
}

const SPEC_A: ConvSpec = { id: CONV_A, title: TITLE_A, probe: HIST_A }
const SPEC_B: ConvSpec = { id: CONV_B, title: TITLE_B, probe: HIST_B }

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

/** 每枚会话两条历史(user 探针 + assistant 复述),两个会话内容互不相同 */
function historyRows(spec: ConvSpec) {
  const base = Date.now() - 60 * 60_000
  return [
    {
      id: `${spec.id}-m-0`,
      conversationId: spec.id,
      role: 'user' as const,
      content: `${spec.probe} 的历史提问(会话 ${spec.id})`,
      reasoning: null,
      tokens: 1,
      metadata: null,
      createdAt: new Date(base).toISOString(),
    },
    {
      id: `${spec.id}-m-1`,
      conversationId: spec.id,
      role: 'assistant' as const,
      content: `${spec.probe} 的历史回答(会话 ${spec.id})`,
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
 * auth 面 + 会话面全量 mock(形态抄自 G-934 的 mockBackend,按 id 分派历史)。
 * 注册顺序 = 兜底在前、专档在后(Playwright 后注册者优先匹配)。
 */
async function mockBackend(page: Page, specs: readonly ConvSpec[]): Promise<void> {
  const rows = (id: string) => {
    const spec = specs.find((s) => s.id === id)
    return spec ? historyRows(spec) : []
  }

  await page.route('**/api/**', (route) => route.fulfill(json({})))
  // 成本预检必须给全字段:blanket 的 json({}) 解包成 data={} 后,r.success&&r.data 仍真值,
  // CostEstimateBar 会拿 undefined.estimatedCostUsd.toFixed 全局崩 → 页面重载洗掉两条流
  await page.route('**/api/chat/cost-estimate**', (route) =>
    route.fulfill(
      json({ estimatedTokensIn: 0, estimatedTokensOut: 0, estimatedCostUsd: 0, priced: true }),
    ),
  )
  await page.route('**/auth/refresh**', (route) =>
    route.fulfill(
      json({
        accessToken: 'e2e-parallel-access',
        refreshToken: 'e2e-parallel-refresh',
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
          nextCursor: list.length > 0 ? 'e2e-parallel-cursor' : null,
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

/** 已登录态(先例:e2e/sidebar-visual.spec.ts:417-444;同 G-934 的 seedLoggedIn) */
async function seedLoggedIn(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-parallel-access',
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
// 可控 SSE 泵:测试侧逐帧推送 / 收束 / 观察 abort
// ──────────────────────────────────────────────────────────────────────────

type PumpState = 'open' | 'closed' | 'aborted'

/** 泵在页面里挂的两枚全局:账目(状态 + 帧原文 + 请求归属)与操作把手(push/close) */
interface PumpWindow {
  __ihuiStreamPump?: {
    /** 按 metadata.conversationId 归位;读不到 id 的请求归入 'unknown'(用例反证它不该发生) */
    streams: Record<string, { frames: string[]; state: PumpState }>
    /** 每一次被拦下的流请求的会话归属(顺序 = 发起顺序) */
    requests: Array<string | null>
  }
  __ihuiStreamPumps?: Record<string, { push: (frame: string) => boolean; close: () => boolean }>
}

/** 帧形态取自 packages/api-client/src/client.ts:1773 parseStreamLine(`data: {json}\n\n`) */
function sseChunk(text: string): string {
  return `data: ${JSON.stringify({ type: 'chunk', content: text })}\n\n`
}

function sseDone(): string {
  // 刻意不带 content:parseStreamLine 会把 done 帧的 content 也当正文增量喷进消息
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
      entry.state = 'open'
      registry.streams[key] = entry
      registry.requests.push(cid)

      const abort = (): void => {
        if (entry.state !== 'open') return
        entry.state = 'aborted'
        try {
          // 名称必须是 AbortError:client.ts:830 isAbortError 只认这一型(认成别的会走重试/报错腿)
          controller?.error(new DOMException('e2e stream aborted', 'AbortError'))
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

/** 某枚会话的流当前处于哪一态(没建过流 = 'none') */
async function pumpState(page: Page, cid: string): Promise<PumpState | 'none'> {
  return page.evaluate((key) => {
    const w = window as unknown as PumpWindow & typeof window
    return w.__ihuiStreamPump?.streams[key]?.state ?? 'none'
  }, cid)
}

/** 该流实际收到过的帧原文(传输面取证:甲流里绝不该出现乙的帧) */
async function pumpFrames(page: Page, cid: string): Promise<string[]> {
  return page.evaluate((key) => {
    const w = window as unknown as PumpWindow & typeof window
    return w.__ihuiStreamPump?.streams[key]?.frames ?? []
  }, cid)
}

/**
 * 从帧原文里按契约抽出 content 再逐字拼接(账目存的是 `data: {json}\n\n` 整帧,
 * 直接 join 会把包装也算进正文 ⇒ 逐字等值断言只能在抽 content 之后成立)。
 * 非 chunk 帧(如 done)不带 content ⇒ 跳过,不注入空串以外的任何东西。
 */
function frameContents(frames: readonly string[]): string {
  const out: string[] = []
  for (const frame of frames) {
    const raw = frame.startsWith('data:') ? frame.slice(5).trim() : frame.trim()
    if (!raw || raw === '[DONE]') continue
    try {
      const parsed = JSON.parse(raw) as { content?: unknown }
      if (typeof parsed.content === 'string') out.push(parsed.content)
    } catch {
      throw new Error(`帧不是合法 JSON(说明取材面漂移):${frame.slice(0, 120)}`)
    }
  }
  return out.join('')
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

/** 拦下的流请求归属清单(用来反证"确实是两条独立的流,不是一条被复用两次") */
async function pumpRequests(page: Page): Promise<Array<string | null>> {
  return page.evaluate(() => {
    const w = window as unknown as PumpWindow
    return w.__ihuiStreamPump?.requests ?? []
  })
}

// ──────────────────────────────────────────────────────────────────────────
// DOM 探针
// ──────────────────────────────────────────────────────────────────────────

interface PaneProbe {
  streaming: boolean
  terminal: boolean
  found: Record<string, boolean>
}

/**
 * **一次** DOM 读取同时量出多格的"在流式中 / 已收束 / 各探针是否在场"。
 * 分成多次 locator 断言会让"同一瞬间"这一判据失去原子性(串行断言看不见中途翻转)。
 */
async function probePanes(
  page: Page,
  panes: readonly string[],
  markers: readonly string[],
): Promise<Record<string, PaneProbe>> {
  return page.evaluate(
    ({ panes, markers }) => {
      const out: Record<string, PaneProbe> = {}
      for (const pane of panes) {
        const leaf = document.querySelector<HTMLElement>(`[data-pane-leaf="${pane}"]`)
        if (!leaf) throw new Error(`缺少窗格 DOM:${pane}`)
        const list = leaf.querySelector<HTMLElement>('[data-testid="message-list-inline-panel"]')
        const text = list?.textContent ?? ''
        const found: Record<string, boolean> = {}
        for (const marker of markers) found[marker] = text.includes(marker)
        out[pane] = {
          // 流动态的可见证据 = 输入区那一枚 stop-button(isStreaming ? Stop : Send 二选一渲染)
          streaming: leaf.querySelector('[data-testid="stop-button"]') !== null,
          terminal: leaf.querySelector('[data-testid="send-button"]') !== null,
          found,
        }
      }
      return out
    },
    { panes, markers },
  )
}

/** 末条消息的正文文本:优先取含探针的那个 markdown 段落,取不到才退回整行 */
async function lastAssistantText(page: Page, pane: string, probe: string): Promise<string> {
  return page.evaluate(
    ({ pane, probe }) => {
      const leaf = document.querySelector<HTMLElement>(`[data-pane-leaf="${pane}"]`)
      if (!leaf) throw new Error(`缺少窗格 DOM:${pane}`)
      const rows = Array.from(leaf.querySelectorAll<HTMLElement>('[data-message-id]'))
      const last = rows[rows.length - 1]
      if (!last) throw new Error(`窗格 ${pane} 里没有消息行`)
      const paragraph = Array.from(last.querySelectorAll<HTMLElement>('p')).find((el) =>
        (el.textContent ?? '').includes(probe),
      )
      return ((paragraph ?? last).textContent ?? '').trim()
    },
    { pane, probe },
  )
}

function paneList(page: Page, pane: string) {
  return page.locator(`[data-pane-leaf="${pane}"] [data-testid="message-list-inline-panel"]`)
}

async function sendInPane(page: Page, pane: string, text: string): Promise<void> {
  const box = page.locator(`[data-pane-leaf="${pane}"] textarea`).first()
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill(text)
  await page.locator(`[data-pane-leaf="${pane}"] [data-testid="send-button"]`).first().click()
}

/** 合成一次 D22 拖拽落格(手搓 DataTransfer 才带得动自定义 MIME) */
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

/**
 * 铺好"两格两会话"的现场:根格承载甲(侧栏点开 → 拆分入口登记根格承载),
 * pane-1 承载乙(拖入落格)。返回时两格各自的历史已就位。
 */
async function prepareTwoPanes(page: Page): Promise<void> {
  await seedLoggedIn(page)
  await mockBackend(page, [SPEC_A, SPEC_B])
  await installStreamPump(page)
  await page.goto('/chat')

  await page.getByRole('button', { name: TITLE_A }).first().click()
  const single = page.locator('[data-testid="message-list-inline-panel"]').first()
  await expect(single).toHaveAttribute('data-window-total', '2', { timeout: 30_000 })

  // 拆分前全页只有一枚拆分入口(出现两枚说明容器已挂载,点的就不是同一件事)
  const entry = page.getByRole('button', { name: SPLIT_ENTRY_RE })
  await expect(entry).toHaveCount(1, { timeout: 30_000 })
  await entry.first().click()

  const root = page.locator('[data-pane-split-root]')
  await expect(root).toHaveAttribute('data-pane-leaf-count', '2', { timeout: 30_000 })
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
  await expect(page.locator(`[data-pane-leaf="${SECOND_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    CONV_B,
  )
  // 历史面先分家:两格的内容互不串(流式面的隔离断言与它同一条探针口径)
  await expect(paneList(page, ROOT_PANE)).toContainText(HIST_A)
  await expect(paneList(page, ROOT_PANE)).not.toContainText(HIST_B)
  await expect(paneList(page, SECOND_PANE)).toContainText(HIST_B)
  await expect(paneList(page, SECOND_PANE)).not.toContainText(HIST_A)
}

const ALL_MARKERS = [...X_MARKERS, ...Y_MARKERS]

test.describe('G-935 / 票60 两窗格双流式互不顶', () => {
  test.setTimeout(180_000)

  test('① 正向:两格并发流式,增量只进自己那一格,两条都走到终态', async ({ page }) => {
    await prepareTwoPanes(page)

    await sendInPane(page, ROOT_PANE, PROMPT_ROOT)
    await expect.poll(() => pumpState(page, CONV_A), { timeout: 30_000 }).toBe('open')
    await sendInPane(page, SECOND_PANE, PROMPT_PANE)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('open')

    // 交错推送(甲一帧、乙一帧……):任何"后起的流顶掉先起的流"的缺陷都会在这一段
    // 现出原形 —— 要么某一格的增量停止增长(流被顶断),要么两格出现同一族标记(串写)。
    for (let i = 0; i < DELTA_COUNT; i += 1) {
      expect(
        await pumpPush(page, CONV_A, sseChunk(X_MARKERS[i] as string)),
        `甲流第 ${i + 1} 帧推送失败(该流不在 open 态 ⇒ 已被顶断)`,
      ).toBe(true)
      expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[i] as string))).toBe(true)
    }

    // 逐帧落到渲染:两格都还没收尾时,各自的末帧必须已可见
    await expect(paneList(page, ROOT_PANE)).toContainText(X_PAYLOAD, { timeout: 20_000 })
    await expect(paneList(page, SECOND_PANE)).toContainText(Y_PAYLOAD, { timeout: 20_000 })

    // 成对反证:甲的标记一根都不许在乙格,反之亦然
    await expect(paneList(page, ROOT_PANE)).not.toContainText('PANE-Y-DELTA-1')
    await expect(paneList(page, SECOND_PANE)).not.toContainText('PANE-X-DELTA-1')

    // 传输面取证:两条流各自收到的帧原文也互不掺(渲染串了能看出来,发串了看不出来 ⇒ 两头都查)。
    // 账目里存的是**整帧原文**,所以要按契约抽出 content 再拼 ⇒ 逐字等值而不是"包含"。
    const framesA = frameContents(await pumpFrames(page, CONV_A))
    const framesB = frameContents(await pumpFrames(page, CONV_B))
    expect(framesA).toBe(X_PAYLOAD)
    expect(framesA).not.toContain('PANE-Y-DELTA-1')
    expect(framesB).toBe(Y_PAYLOAD)
    expect(framesB).not.toContain('PANE-X-DELTA-1')

    // 两条流在同一页面各自收束(收不到终态 = "一条流吃了另一条"能躲在超时后面)
    expect(await pumpPush(page, CONV_A, sseDone())).toBe(true)
    expect(await pumpPush(page, CONV_B, sseDone())).toBe(true)
    expect(await pumpClose(page, CONV_A)).toBe(true)
    expect(await pumpClose(page, CONV_B)).toBe(true)

    await expect.poll(() => pumpState(page, CONV_A), { timeout: 30_000 }).toBe('closed')
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('closed')
    const probe = await probePanes(page, [ROOT_PANE, SECOND_PANE], ALL_MARKERS)
    expect(probe[ROOT_PANE]?.streaming, '根格仍显示 stop-button ⇒ 它的流没有收束').toBe(false)
    expect(probe[SECOND_PANE]?.streaming, 'pane-1 仍显示 stop-button ⇒ 它的流没有收束').toBe(false)
    expect(probe[ROOT_PANE]?.terminal, '根格输入区应回到可发送态').toBe(true)
    expect(probe[SECOND_PANE]?.terminal, 'pane-1 输入区应回到可发送态').toBe(true)

    // 终态文本 = 自己那一条流的载荷(逐字相等,不是"包含就算")
    expect(await lastAssistantText(page, ROOT_PANE, xMarker(1))).toBe(X_PAYLOAD)
    expect(await lastAssistantText(page, SECOND_PANE, yMarker(1))).toBe(Y_PAYLOAD)
  })

  test('② 反证(关键):两条流在同一瞬间都活着,一条收束不牵动另一条', async ({ page }) => {
    await prepareTwoPanes(page)

    await sendInPane(page, ROOT_PANE, PROMPT_ROOT)
    await expect.poll(() => pumpState(page, CONV_A), { timeout: 30_000 }).toBe('open')
    expect(await pumpPush(page, CONV_A, sseChunk(X_MARKERS[0] as string))).toBe(true)
    await expect(paneList(page, ROOT_PANE)).toContainText(xMarker(1), { timeout: 20_000 })

    await sendInPane(page, SECOND_PANE, PROMPT_PANE)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('open')
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[0] as string))).toBe(true)

    // 同一瞬间量四件事:甲仍在流式中 + 乙仍在流式中 + 甲已见甲帧 + 乙已见乙帧。
    // 若实现是"单流复用"(后发的顶掉先发的),这里必然有一格 streaming=false。
    await expect
      .poll(
        async () => {
          const probe = await probePanes(page, [ROOT_PANE, SECOND_PANE], ALL_MARKERS)
          const root = probe[ROOT_PANE]
          const second = probe[SECOND_PANE]
          if (!root || !second) return 'missing-probe'
          return `${root.streaming ? 'R-live' : 'R-dead'}|${second.streaming ? 'P-live' : 'P-dead'}|${
            root.found[xMarker(1)] ? 'R-has-X1' : 'R-no-X1'
          }|${second.found[yMarker(1)] ? 'P-has-Y1' : 'P-no-Y1'}`
        },
        { timeout: 20_000, message: '两格未能在同一瞬间都处于流式中' },
      )
      .toBe('R-live|P-live|R-has-X1|P-has-Y1')

    // 只有甲收束:甲转终态的那一次读取里,乙必须仍在流式中(顶掉型缺陷在这里必翻)
    expect(await pumpPush(page, CONV_A, sseChunk(xMarker(2)))).toBe(true)
    expect(await pumpPush(page, CONV_A, sseDone())).toBe(true)
    expect(await pumpClose(page, CONV_A)).toBe(true)

    await expect
      .poll(
        async () => {
          const probe = await probePanes(page, [ROOT_PANE, SECOND_PANE], ALL_MARKERS)
          const root = probe[ROOT_PANE]
          const second = probe[SECOND_PANE]
          if (!root || !second) return 'missing-probe'
          return `${root.streaming ? 'R-live' : 'R-dead'}|${second.streaming ? 'P-live' : 'P-dead'}`
        },
        { timeout: 20_000, message: '甲流收束后把乙流一起带下去了(或甲自己没收束)' },
      )
      .toBe('R-dead|P-live')

    // 乙仍在场:继续喂完它自己那一条,内容与终态都归乙
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[1] as string))).toBe(true)
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[2] as string))).toBe(true)
    expect(await pumpPush(page, CONV_B, sseDone())).toBe(true)
    expect(await pumpClose(page, CONV_B)).toBe(true)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('closed')

    await expect(paneList(page, SECOND_PANE)).toContainText(Y_PAYLOAD, { timeout: 20_000 })
    await expect(paneList(page, SECOND_PANE)).not.toContainText('PANE-X-DELTA-1')
    await expect(paneList(page, ROOT_PANE)).toContainText(X_MARKERS[1] as string)
    await expect(paneList(page, ROOT_PANE)).not.toContainText('PANE-Y-DELTA-1')
    expect(await lastAssistantText(page, SECOND_PANE, yMarker(1))).toBe(Y_PAYLOAD)

    // 反证"其实只有一条流活着":两条流各自登记过独立的请求归属
    const requests = await pumpRequests(page)
    expect(
      requests.filter((r) => r === CONV_A).length,
      '甲会话的流请求归属数',
    ).toBeGreaterThanOrEqual(1)
    expect(requests.filter((r) => r === CONV_B).length).toBeGreaterThanOrEqual(1)
    expect(requests.includes(null), '存在读不出归属的流请求(metadata.conversationId 丢了)').toBe(
      false,
    )
    expect(requests.includes('unknown'), '存在归入 unknown 的流请求').toBe(false)
  })

  test('③ 停止只 abort 自己那一格:甲被停止,乙照样跑完', async ({ page }) => {
    await prepareTwoPanes(page)

    await sendInPane(page, ROOT_PANE, PROMPT_ROOT)
    await expect.poll(() => pumpState(page, CONV_A), { timeout: 30_000 }).toBe('open')
    await sendInPane(page, SECOND_PANE, PROMPT_PANE)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('open')
    expect(await pumpPush(page, CONV_A, sseChunk(X_MARKERS[0] as string))).toBe(true)
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[0] as string))).toBe(true)
    await expect(paneList(page, ROOT_PANE)).toContainText(xMarker(1), { timeout: 20_000 })
    await expect(paneList(page, SECOND_PANE)).toContainText(yMarker(1), { timeout: 20_000 })

    // 点根格的停止(控件唯一标识 [data-testid="stop-button"],必须按窗格作用域取)
    await page
      .locator(`[data-pane-leaf="${ROOT_PANE}"] [data-testid="stop-button"]`)
      .first()
      .click()

    // 甲的 abort 只掐甲自己那一条读环;乙在同一瞬间仍 open、仍在流式中
    await expect
      .poll(
        async () => {
          const probe = await probePanes(page, [ROOT_PANE, SECOND_PANE], ALL_MARKERS)
          const root = probe[ROOT_PANE]
          const second = probe[SECOND_PANE]
          if (!root || !second) return 'missing-probe'
          const stateA = await pumpState(page, CONV_A)
          const stateB = await pumpState(page, CONV_B)
          return `A=${stateA}|B=${stateB}|R=${root.streaming ? 'live' : 'dead'}|P=${
            second.streaming ? 'live' : 'dead'
          }`
        },
        { timeout: 20_000, message: '停止根格后,根格没停 / 或 pane-1 被连带停了' },
      )
      .toBe('A=aborted|B=open|R=dead|P=live')

    // 乙没被牵连:继续喂完,终态文本是乙自己的载荷
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[1] as string))).toBe(true)
    expect(await pumpPush(page, CONV_B, sseChunk(Y_MARKERS[2] as string))).toBe(true)
    expect(await pumpPush(page, CONV_B, sseDone())).toBe(true)
    expect(await pumpClose(page, CONV_B)).toBe(true)
    await expect.poll(() => pumpState(page, CONV_B), { timeout: 30_000 }).toBe('closed')
    await expect(paneList(page, SECOND_PANE)).toContainText(Y_PAYLOAD, { timeout: 20_000 })
    expect(await lastAssistantText(page, SECOND_PANE, yMarker(1))).toBe(Y_PAYLOAD)

    // 甲停在半途:只有它已推的那一帧,且乙的帧一根都不进甲(甲也没被乙的收束改写)
    await expect(paneList(page, ROOT_PANE)).toContainText(xMarker(1))
    await expect(paneList(page, ROOT_PANE)).not.toContainText(xMarker(2))
    await expect(paneList(page, ROOT_PANE)).not.toContainText('PANE-Y-DELTA-1')
    expect(await pumpFrames(page, CONV_A)).toEqual([sseChunk(X_MARKERS[0] as string)])
    expect(await pumpFrames(page, CONV_B)).toEqual([
      sseChunk(Y_MARKERS[0] as string),
      sseChunk(Y_MARKERS[1] as string),
      sseChunk(Y_MARKERS[2] as string),
      sseDone(),
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
