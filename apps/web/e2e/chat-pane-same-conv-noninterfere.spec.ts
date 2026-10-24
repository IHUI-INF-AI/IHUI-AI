// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 票 G-1162551(原 G-935)· 同一会话承载在两个窗格 ⇒ 流式 / 工具面板 / 滚动位互不顶(AGENTS.md §17 真机核验)
//
// 差集口径(为什么是这三条用例,现读 HEAD 既有三枚同族 spec):
// - `chat-pane-parallel-stream.spec.ts`:两窗格 × **两个不同会话** 的双流互不顶;
// - `chat-pane-split-scroll-restore.spec.ts`:两窗格 × 同一会话,只量了滚动位(一条流都没起);
// - `chat-pane-tools-jump-cache.spec.ts`:工具面板窗格化(两格不同会话)+ 跳转总线门控 + 缓存隔离 + 续传。
// ⇒ 票面出路「两窗格承载**同一会话** ⇒ 各自流式/工具面板/滚动位互不顶」中,
//   "同一会话 × 流式" 与 "同一会话 × 工具面板开合" 两格此前在真浏览器里从未成立过。本 spec 补的就是这两格,
//   外加第三格(它只有实机能答):同一会话下,**一格的流式 append 会不会把另一格已经离开底部的滚动位拽走**。
//
// 全链路 route mock + 页面内 fetch 泵(形态抄自 chat-pane-parallel-stream.spec.ts,不依赖活后端;
// 共享机上起独立后端会与在跑席位抢 8802 watch 与 dev-lock,§12)。登录态 = localStorage `ihui-auth`
// (zustand persist 形态)+ 非 httpOnly `auth_token` cookie(先例 sidebar-visual.spec.ts:417-444)。
//
// 关键生产码事实(现读,非假设):
// - 根窗格(leaf id `pane-root`)在 PaneSplitContainer 里**不挂** ChatPaneProvider
//   (chat-pane-body.tsx:11 "非根窗格各自挂 ChatPaneProvider")⇒ pane-root 的消费面走根单例
//   (chat store 键 `ihui-chat`、工具面板键 `ihui-ai-tools-panel`);pane-1 走窗格实例
//   (`ihui-chat-pane-pane-1`、`ihui-ai-tools-panel-pane-1`,ai-tools-panel.ts:72-85)。
// - 发送防重是**按 store 实例**的(send-message.ts:216 `if (store.isStreaming) return false`)
//   ⇒ 两格同会话并发两条流在产品形态上可达,失效型才会是"串写/顶断"。
// - 工具面板开关(缺口A 已修):mode-switcher.tsx:62 读写 usePaneAiToolsPanelStore(窗格实例),
//   面板体 ai-side-panel-tools.tsx:746 `className={open ? undefined : 'hidden'}`(每格恒挂载,靠 hidden 收合)。
// - 窗格承载会话写一次:拆分后把同一枚会话拖进 pane-1(`[data-pane-empty]` 内层落点)。
// - 历史行数刻意用 56(不是 60):VIRTUAL_THRESHOLD=60,一轮流式 append(user+assistant=+2)后
//   单格最多 58 条,两格同会话各流一轮也各自停在 58,永不跨进虚拟化窗口 ⇒ 滚动目标的 DOM 恒在。
//
// 反假绿设计(每条判据都有对侧的牙):
// - 流式隔离走**单次 DOM 快照**同时量两格(串行断言看不见中途翻转);甲的标记在甲格"有"、在乙格"无"成对;
// - 泵按**请求体里的 prompt 标记**分键(prompt 唯一 ⇒ "两条流是两条独立的流"由 registry 计数自证,
//   requests 里出现 unknown/重复键即红);传输面帧原文账目与渲染面逐字断言两头都查;
// - 工具面板是**四步开合链**:pane-1 开→根开→pane-1 关→根关,每一步都同时断言两格状态
//   (合拢任何一格"开关共享"的回潮都会在其中一步翻红);persist 键值逐键核对;
// - 滚动位:一格流式时,对侧格的 scrollTop 必须 ≤2px 不动、data-window-total 不变、文本不含对方载荷;
//   同时正在流式的那格必须真的动(>60px 或内容增长)——"两边都纹丝不动"会被这条反证戳穿。

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

const DRAG_TYPE = 'application/x-ihui-conversation'
/** 拆分入口文案:zh-CN「向右拆分」/ en "Split right" */
const SPLIT_ENTRY_RE = /向右拆分|split right/i

const ROOT_PANE = 'pane-root'
const SECOND_PANE = 'pane-1'

const CONV_S = 'e2e-sip-conv-same'
const TITLE_S = 'E2E 双格同席取证'
const CONV_LONG = 'e2e-sip-conv-long'
const TITLE_LONG = 'E2E 双格同席长会话'

/** 会话历史里的共同探针:两格都该见到它 ⇒ "同一枚会话挂在两格"的渲染面立据 */
const HIST_PROBE = 'SIP-HIST-SAME-CONV'

/** 泵的分键标记(prompt 原文会被逐字带进 stream 请求体;两格各用一枚,互不掺) */
const PUMP_ROOT_MARK = 'SIP-PUMP-ROOT'
const PUMP_PANE_MARK = 'SIP-PUMP-PANE'

/** 流式增量探针(测试 ①) */
const DELTA_COUNT = 3
const xMarker = (n: number): string => `SIP1-X-DELTA-${n}`
const yMarker = (n: number): string => `SIP1-Y-DELTA-${n}`
/** 末帧带多段正文:渲染高度才够把"跟随到底"的窗格明显下移(③ 的反证腿要吃这个高度) */
const filler = (mark: string): string =>
  `${mark} ${'同席流式互不顶取证正文,重复以撑出真实滚动高度。'.repeat(6)}`

/** 测试 ③ 的增量探针(与 ① 不同族,避免跨用例误命中) */
const rootDelta = (n: number): string => `SIP3-ROOT-${n}`
const paneDelta = (n: number): string => `SIP3-PANE-${n}`

interface ConvSpec {
  readonly id: string
  readonly title: string
  readonly messageCount: number
}

const SPEC_S: ConvSpec = { id: CONV_S, title: TITLE_S, messageCount: 2 }
const SPEC_LONG: ConvSpec = { id: CONV_LONG, title: TITLE_LONG, messageCount: 56 }

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
 * 历史行:messageCount=2 给"短会话"(流式/工具面板用例);=56 给"长会话"(滚动几何用例,
 * 每条 12 个空行分段,足以把列表撑出真实可滚高度,抄自 chat-pane-split-scroll-restore)。
 */
function historyRows(spec: ConvSpec) {
  const base = Date.now() - 60 * 60_000
  if (spec.messageCount === 2) {
    return [
      {
        id: `${spec.id}-m-0`,
        conversationId: spec.id,
        role: 'user' as const,
        content: `${HIST_PROBE} 的历史提问(会话 ${spec.id})`,
        reasoning: null,
        tokens: 1,
        metadata: null,
        createdAt: new Date(base).toISOString(),
      },
      {
        id: `${spec.id}-m-1`,
        conversationId: spec.id,
        role: 'assistant' as const,
        content: `${HIST_PROBE} 的历史回答(会话 ${spec.id})`,
        reasoning: null,
        tokens: 1,
        metadata: null,
        createdAt: new Date(base + 1000).toISOString(),
      },
    ]
  }
  return Array.from({ length: spec.messageCount }, (_, i) => ({
    id: `${spec.id}-m-${i}`,
    conversationId: spec.id,
    role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
    content: Array.from({ length: 12 }, (_, k) =>
      `${k === 0 && i === 0 ? `${HIST_PROBE} ` : ''}${spec.title} 第${i}段${k} —— 同席滚动互不顶取证正文,重复以撑出真实滚动高度。`.repeat(
        3,
      ),
    ).join('\n\n'),
    reasoning: null,
    tokens: 1,
    metadata: null,
    createdAt: new Date(base + i * 1000).toISOString(),
  }))
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
 * cost-estimate 必须给全字段,否则 CostEstimateBar 拿 undefined.toFixed 全局崩 → 页面重载洗掉流。
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
        accessToken: 'e2e-sip-access',
        refreshToken: 'e2e-sip-refresh',
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
          nextCursor: list.length > 0 ? 'e2e-sip-cursor' : null,
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
      await route.fulfill(json({ conversation: first ? convRow(first) : convRow(SPEC_S) }))
      return
    }
    await route.fulfill(json({}))
  })
}

/** 已登录态(先例 e2e/sidebar-visual.spec.ts:417-444;同 parallel-stream 的 seedLoggedIn) */
async function seedLoggedIn(page: Page): Promise<void> {
  await page.context().addCookies([
    {
      name: 'auth_token',
      value: 'e2e-sip-access',
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
// 可控 SSE 泵:按 **prompt 标记** 分键(同会话两格并发时 conversationId 相同,
// parallel-stream 那套"按 cid 归位"的键在这里会撞车 ⇒ 键必须换到请求体的另一维)
// ──────────────────────────────────────────────────────────────────────────

type PumpState = 'open' | 'closed' | 'aborted'

interface PumpWindow {
  __ihuiStreamPump?: {
    streams: Record<string, { frames: string[]; state: PumpState }>
    requests: string[]
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
  await page.addInitScript(
    (marks) => {
      const w = window as unknown as PumpWindow & typeof window
      const registry: NonNullable<PumpWindow['__ihuiStreamPump']> = { streams: {}, requests: [] }
      w.__ihuiStreamPump = registry
      const originalFetch = window.fetch.bind(window)

      const makePump = (key: string, signal?: AbortSignal | null) => {
        const encoder = new TextEncoder()
        let controller: ReadableStreamDefaultController | null = null
        const entry = { frames: [] as string[], state: 'open' as PumpState }
        const stream = new ReadableStream({
          start(c) {
            controller = c
          },
        })
        registry.streams[key] = entry
        registry.requests.push(key)

        const abort = (): void => {
          if (entry.state !== 'open') return
          entry.state = 'aborted'
          try {
            controller?.error(new DOMException('e2e sip stream aborted', 'AbortError'))
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
        const raw = typeof init?.body === 'string' ? init.body : ''
        // 键 = 请求体里命中的 prompt 标记;都命不中归 'unknown'(用例反证它不该发生)
        const key = raw.includes(marks.root)
          ? 'root'
          : raw.includes(marks.pane)
            ? 'pane'
            : 'unknown'
        return Promise.resolve(makePump(key, init?.signal))
      }
    },
    { root: PUMP_ROOT_MARK, pane: PUMP_PANE_MARK },
  )
}

async function pumpStateOf(page: Page, key: string): Promise<PumpState | 'none'> {
  return page.evaluate((k) => {
    const w = window as unknown as PumpWindow & typeof window
    return w.__ihuiStreamPump?.streams[k]?.state ?? 'none'
  }, key)
}

async function pumpFrames(page: Page, key: string): Promise<string[]> {
  return page.evaluate((k) => {
    const w = window as unknown as PumpWindow & typeof window
    return w.__ihuiStreamPump?.streams[k]?.frames ?? []
  }, key)
}

async function pumpRequests(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const w = window as unknown as PumpWindow
    return w.__ihuiStreamPump?.requests ?? []
  })
}

async function pumpPush(page: Page, key: string, frame: string): Promise<boolean> {
  return page.evaluate(
    ({ k, text }) => {
      const w = window as unknown as typeof window & {
        __ihuiStreamPumps?: Record<string, { push: (f: string) => boolean }>
      }
      return w.__ihuiStreamPumps?.[k]?.push(text) ?? false
    },
    { k: key, text: frame },
  )
}

async function pumpClose(page: Page, key: string): Promise<boolean> {
  return page.evaluate((k) => {
    const w = window as unknown as typeof window & {
      __ihuiStreamPumps?: Record<string, { close: () => boolean }>
    }
    return w.__ihuiStreamPumps?.[k]?.close() ?? false
  }, key)
}

// ──────────────────────────────────────────────────────────────────────────
// DOM 探针(作用域纪律同 G-934/parallel-stream:`message-list-inline-panel` 的 id 在两格重复,
// 一律按 [data-pane-leaf] 作用域取,绝不裸取)
// ──────────────────────────────────────────────────────────────────────────

interface PaneSnapshot {
  streaming: boolean
  terminal: boolean
  windowTotal: number | null
  textLen: number
  has: Record<string, boolean>
}

/** 单次 DOM 读取同时量两格的 流动态/装载条数/探针在场性("同一瞬间"的判据不许拆成多次断言) */
async function probePanes(
  page: Page,
  markers: readonly string[],
): Promise<Record<string, PaneSnapshot>> {
  return page.evaluate(
    ({ markers }) => {
      const out: Record<string, PaneSnapshot> = {}
      for (const pane of ['pane-root', 'pane-1']) {
        const leaf = document.querySelector<HTMLElement>(`[data-pane-leaf="${pane}"]`)
        if (!leaf) throw new Error(`缺少窗格 DOM:${pane}`)
        const list = leaf.querySelector<HTMLElement>('[data-testid="message-list-inline-panel"]')
        const raw = list?.getAttribute('data-window-total')
        const found: Record<string, boolean> = {}
        const text = list?.textContent ?? ''
        for (const m of markers) found[m] = text.includes(m)
        out[pane] = {
          streaming: leaf.querySelector('[data-testid="stop-button"]') !== null,
          terminal: leaf.querySelector('[data-testid="send-button"]') !== null,
          windowTotal: raw === null ? null : Number(raw),
          textLen: text.length,
          has: found,
        }
      }
      return out
    },
    { markers },
  )
}

function paneList(page: Page, pane: string) {
  return page.locator(`[data-pane-leaf="${pane}"] [data-testid="message-list-inline-panel"]`)
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
  // scroll 事件在下一帧派发:observedScrollTopRef / 跟随权解除靠它记账(抄 G-934 的成因注)
  await page.waitForTimeout(250)
  return scrollTopOf(page, pane)
}

/** 合成一次 D22 拖拽落格(自定义 MIME 只有手搓 DataTransfer 带得动;落点 = 内层 [data-pane-empty]) */
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

async function sendInPane(page: Page, pane: string, text: string): Promise<void> {
  const box = page.locator(`[data-pane-leaf="${pane}"] textarea`).first()
  await expect(box).toBeVisible({ timeout: 30_000 })
  await box.fill(text)
  await page.locator(`[data-pane-leaf="${pane}"] [data-testid="send-button"]`).first().click()
}

/** 在某格的 mode-switcher 里点「工具面板」(菜单经 portal 渲染,打开态下全页唯一) */
async function toggleToolsPanelIn(page: Page, pane: string): Promise<void> {
  await page.locator(`[data-pane-leaf="${pane}"] [data-testid="mode-switcher"]`).first().click()
  const item = page.locator('[data-testid="menu-tools-panel"]')
  await expect(item).toHaveCount(1, { timeout: 10_000 })
  await item.click()
}

function toolsPanelBody(page: Page, pane: string) {
  return page.locator(`[data-pane-leaf="${pane}"] [data-testid="ai-side-panel-tools"]`)
}

/** 两枚工具面板 persist 键的 open 实读(pane-root=根单例键;pane-1=窗格实例键) */
async function readToolsPersist(page: Page): Promise<{ rootOpen: boolean; paneOpen: boolean }> {
  return page.evaluate(() => {
    const read = (key: string): boolean => {
      const raw = localStorage.getItem(key)
      if (!raw) return false
      try {
        const blob = JSON.parse(raw) as { state?: { open?: boolean } }
        return blob.state?.open === true
      } catch {
        return false
      }
    }
    return {
      rootOpen: read('ihui-ai-tools-panel'),
      paneOpen: read('ihui-ai-tools-panel-pane-1'),
    }
  })
}

/**
 * 铺"同一枚会话挂在两格"的现场:侧栏点开 → 拆分(根叶登记该会话)→ 把同一枚会话拖进 pane-1。
 * 返回时两格 data-pane-conversation 同值、两格历史都含同一探针(渲染面立据)。
 */
async function prepareSameConversationTwoPanes(page: Page, spec: ConvSpec): Promise<void> {
  await seedLoggedIn(page)
  await mockBackend(page, [SPEC_S, SPEC_LONG])
  // 泵必须在 goto 之前挂(addInitScript 只作用于注册之后的导航;parallel-stream 同纪律)
  await installStreamPump(page)
  await page.goto('/chat')

  await page.getByRole('button', { name: spec.title }).first().click()
  const single = page.locator('[data-testid="message-list-inline-panel"]').first()
  await expect(single).toHaveAttribute('data-window-total', String(spec.messageCount), {
    timeout: 30_000,
  })

  const entry = page.getByRole('button', { name: SPLIT_ENTRY_RE })
  await expect(entry).toHaveCount(1, { timeout: 30_000 })
  await entry.first().click()
  await expect(page.locator('[data-pane-split-root]')).toHaveAttribute(
    'data-pane-leaf-count',
    '2',
    { timeout: 30_000 },
  )
  await expect(page.locator(`[data-pane-leaf="${ROOT_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    spec.id,
  )
  await dropConversationIntoPane(page, SECOND_PANE, spec.id, spec.title)

  await expect(paneList(page, ROOT_PANE)).toHaveAttribute(
    'data-window-total',
    String(spec.messageCount),
    { timeout: 30_000 },
  )
  await expect(paneList(page, SECOND_PANE)).toHaveAttribute(
    'data-window-total',
    String(spec.messageCount),
    { timeout: 30_000 },
  )
  await expect(page.locator(`[data-pane-leaf="${SECOND_PANE}"]`)).toHaveAttribute(
    'data-pane-conversation',
    spec.id,
  )
  // "同一会话"的渲染面:两格都含同一枚历史探针
  await expect(paneList(page, ROOT_PANE)).toContainText(HIST_PROBE)
  await expect(paneList(page, SECOND_PANE)).toContainText(HIST_PROBE)
}

const ALL_X = [1, 2, 3].map(xMarker)
const ALL_Y = [1, 2, 3].map(yMarker)

test.describe('G-1162551 同一会话双窗格:流式 / 工具面板 / 滚动位互不顶', () => {
  test.setTimeout(180_000)

  test('① 同一会话在两格并发流式:两条流各自活、增量各归各格、一格收束不顶另一格', async ({
    page,
  }) => {
    await prepareSameConversationTwoPanes(page, SPEC_S)
    test.info().annotations.push({
      type: 'note',
      description:
        '已知抖动取证(2026-10-23):同一会话双格并发流式期间,pane-1 的打字机回放存在"重挂回退"瞬态' +
        '(store persist 快照恒为全文,snapHasY3=true;DOM 尾态短暂回退后再聚齐,done/close 冲刷后稳定)。' +
        '⇒ 本用例收束前的可见性判据一律走 expect.poll(采样重试),终态逐字断言放在收束之后;单次快照读会咬到瞬态假红。' +
        '该抖动的根因(疑为同会话并发流下 MessageItem 重挂重启回放)不在本票射程,若需立案另派。',
    })
    await sendInPane(page, ROOT_PANE, `${PUMP_ROOT_MARK} same-conv run`)
    await expect.poll(() => pumpStateOf(page, 'root'), { timeout: 30_000 }).toBe('open')
    await sendInPane(page, SECOND_PANE, `${PUMP_PANE_MARK} same-conv run`)
    await expect.poll(() => pumpStateOf(page, 'pane'), { timeout: 30_000 }).toBe('open')

    // 立据 0(反证"其实只有一条流"):registry 必须登记到两枚独立键,且没有 unknown 归属
    const requests = await pumpRequests(page)
    expect(requests.filter((r) => r === 'root')).toHaveLength(1)
    expect(requests.filter((r) => r === 'pane')).toHaveLength(1)
    expect(
      requests.includes('unknown'),
      '存在分不了键的流请求(prompt 标记没进请求体 ⇒ 取材面漂移)',
    ).toBe(false)

    // 交错推送(甲一帧、乙一帧):任何"后起的流顶掉先起的流"都会让某一格的 push 返回 false
    for (let i = 0; i < DELTA_COUNT; i += 1) {
      expect(
        await pumpPush(page, 'root', sseChunk(xMarker(i + 1))),
        `根格流第 ${i + 1} 帧推送失败(该流不在 open 态 ⇒ 被同会话的另一格顶断了)`,
      ).toBe(true)
      expect(await pumpPush(page, 'pane', sseChunk(yMarker(i + 1)))).toBe(true)
    }

    // 逐帧落到渲染:末帧可见性由下方"同一瞬间"的合成快照 poll 兜(单次 toContainText 在
    // 打字机回放期可能被回退瞬态咬到;expect.poll 的采样重试形态才匹配"边播边重挂"的现实)。
    // 终态逐字断言放在 done/close 之后(收束冲刷后文本不再回退)。

    // 同一瞬间:两格都在流式中(单次快照;串写/顶断在这一步必翻)
    await expect
      .poll(
        async () => {
          const snap = await probePanes(page, [...ALL_X, ...ALL_Y])
          return `${snap['pane-root']?.streaming ? 'R-live' : 'R-dead'}|${
            snap['pane-1']?.streaming ? 'P-live' : 'P-dead'
          }|${snap['pane-root']?.has[xMarker(3)] ? 'R-has-X3' : 'R-no-X3'}|${
            snap['pane-1']?.has[yMarker(3)] ? 'P-has-Y3' : 'P-no-Y3'
          }|${snap['pane-root']?.has[yMarker(1)] ? 'R-BLED-Y' : 'R-clean'}|${
            snap['pane-1']?.has[xMarker(1)] ? 'P-BLED-X' : 'P-clean'
          }|${snap['pane-root']?.windowTotal === 4 ? 'R-wt4' : `R-wt${snap['pane-root']?.windowTotal}`}|${
            snap['pane-1']?.windowTotal === 4 ? 'P-wt4' : `P-wt${snap['pane-1']?.windowTotal}`
          }`
        },
        { timeout: 45_000, message: '同一会话双窗格并发流式未同时成立' },
      )
      .toBe('R-live|P-live|R-has-X3|P-has-Y3|R-clean|P-clean|R-wt4|P-wt4')

    // 传输面账目:各自流里只有自己的帧(渲染串了看得见,发串了看不见 ⇒ 两头都查)
    const framesRoot = await pumpFrames(page, 'root')
    const framesPane = await pumpFrames(page, 'pane')
    expect(framesRoot.every((f) => f.includes('SIP1-X-'))).toBe(true)
    expect(framesRoot.some((f) => f.includes('SIP1-Y-'))).toBe(false)
    expect(framesPane.every((f) => f.includes('SIP1-Y-'))).toBe(true)
    expect(framesPane.some((f) => f.includes('SIP1-X-'))).toBe(false)

    // 只有根格收束:收束那一刻的同一瞬间,pane-1 必须仍在流式中(顶掉型缺陷在这里必翻)
    expect(await pumpPush(page, 'root', sseDone())).toBe(true)
    expect(await pumpClose(page, 'root')).toBe(true)
    await expect
      .poll(
        async () => {
          const snap = await probePanes(page, [...ALL_X, ...ALL_Y])
          return `${snap['pane-root']?.streaming ? 'R-live' : 'R-dead'}|${
            snap['pane-1']?.streaming ? 'P-live' : 'P-dead'
          }`
        },
        { timeout: 20_000, message: '根格收束把 pane-1 一起带下去了(或根格自己没收束)' },
      )
      .toBe('R-dead|P-live')

    // pane-1 继续跑完自己的流
    expect(await pumpPush(page, 'pane', sseDone())).toBe(true)
    expect(await pumpClose(page, 'pane')).toBe(true)
    await expect.poll(() => pumpStateOf(page, 'pane'), { timeout: 30_000 }).toBe('closed')

    // 终态:两格各自的末条助手消息正文含且仅含自己那条流的载荷;对侧终态互不掺
    // 终态逐字断言(收束冲刷后文本稳定):三帧在 store 里逐字拼接 ⇒ 末条正文必须逐字等于序列
    await expect(paneList(page, ROOT_PANE)).toContainText([1, 2, 3].map(xMarker).join(''), {
      timeout: 20_000,
    })
    await expect(paneList(page, SECOND_PANE)).toContainText([1, 2, 3].map(yMarker).join(''), {
      timeout: 20_000,
    })
    await expect(paneList(page, ROOT_PANE)).not.toContainText('SIP1-Y-')
    await expect(paneList(page, SECOND_PANE)).not.toContainText('SIP1-X-')
    const final = await probePanes(page, [])
    expect(final['pane-root']?.terminal, '根格应回到可发送态').toBe(true)
    expect(final['pane-1']?.terminal, 'pane-1 应回到可发送态').toBe(true)
    // 两格的会话归属仍钉在同一枚会话上(流式没有把任何一格甩去别的会话)
    await expect(page.locator(`[data-pane-leaf="${ROOT_PANE}"]`)).toHaveAttribute(
      'data-pane-conversation',
      CONV_S,
    )
    await expect(page.locator(`[data-pane-leaf="${SECOND_PANE}"]`)).toHaveAttribute(
      'data-pane-conversation',
      CONV_S,
    )
  })

  test('② 同一会话在两格:工具面板四步开合链互不顶(pane-1 开→根开→pane-1 关→根关)', async ({
    page,
  }) => {
    await prepareSameConversationTwoPanes(page, SPEC_S)

    const paneBody = toolsPanelBody(page, SECOND_PANE)
    const rootBody = toolsPanelBody(page, ROOT_PANE)
    // AiSidePanelTools 是 dynamic({ssr:false}) 异步块:dev 冷编译 + 并发 worker 下挂载可晚于秒级,
    // 必须先等两枚面板体**在场**(60s 窗),再谈收合态 —— 否则 toBeHidden 对 0 枚元素是空洞真(假绿源),
    // 而切换后的 toBeVisible(10s) 会死于"块还没编出来"而非产品红(2026-10-23 实测同型)。
    await expect(paneBody, 'pane-1 的工具面板体应挂载(异步块)').toHaveCount(1, { timeout: 60_000 })
    await expect(rootBody, '根窗格的工具面板体应挂载(异步块)').toHaveCount(1, { timeout: 60_000 })
    await expect(paneBody).toBeHidden()
    await expect(rootBody).toBeHidden()

    // 步 1:在 pane-1 里开 ⇒ 只有 pane-1 亮;persist 只动窗格键
    await toggleToolsPanelIn(page, SECOND_PANE)
    await expect(paneBody, 'pane-1 的开关没点亮 pane-1 自己的面板体').toBeVisible({
      timeout: 10_000,
    })
    await expect(rootBody, 'pane-1 的开关顶亮了根窗格面板体(互不顶被破坏)').toBeHidden()
    let persist = await readToolsPersist(page)
    expect(persist.paneOpen, 'pane-1 键应记 open=true').toBe(true)
    expect(persist.rootOpen, '根单例键不该被 pane-1 的开关写入').toBe(false)

    // 步 2:在根格里开 ⇒ 两格同亮,pane-1 不许被顶关
    await toggleToolsPanelIn(page, ROOT_PANE)
    await expect(rootBody).toBeVisible({ timeout: 10_000 })
    await expect(paneBody, '根格的开顶掉了 pane-1 已展开的面板').toBeVisible()
    persist = await readToolsPersist(page)
    expect(persist.rootOpen).toBe(true)
    expect(persist.paneOpen).toBe(true)

    // 步 3:在 pane-1 里关 ⇒ 只有 pane-1 收;根格保持展开
    await toggleToolsPanelIn(page, SECOND_PANE)
    await expect(paneBody).toBeHidden({ timeout: 10_000 })
    await expect(rootBody, 'pane-1 的关闭把根格一起关了(开关共享的回潮形态)').toBeVisible()
    persist = await readToolsPersist(page)
    expect(persist.paneOpen).toBe(false)
    expect(persist.rootOpen).toBe(true)

    // 步 4:在根格里关 ⇒ 双双收合,账目归零
    await toggleToolsPanelIn(page, ROOT_PANE)
    await expect(rootBody).toBeHidden({ timeout: 10_000 })
    await expect(paneBody).toBeHidden()
    persist = await readToolsPersist(page)
    expect(persist.rootOpen).toBe(false)
    expect(persist.paneOpen).toBe(false)
  })

  test('③ 同一长会话在两格:一格的流式 append 不拽动另一格的滚动位(双向)', async ({ page }) => {
    await prepareSameConversationTwoPanes(page, SPEC_LONG)

    // 甲腿:根格滚离底部钉在 ~20% 处;pane-1 停在"落会话后自动跟随到底"的稳态
    const rootRecorded = await scrollToMessageTop(page, ROOT_PANE, `${CONV_LONG}-m-11`)
    expect(rootRecorded, '根格基线必须明显非 0(否则"没被拽动"没有牙)').toBeGreaterThan(200)
    const pane1Baseline = await scrollTopOf(page, SECOND_PANE)

    // pane-1 流式一整条
    await sendInPane(page, SECOND_PANE, `${PUMP_PANE_MARK} scroll-leg run`)
    await expect.poll(() => pumpStateOf(page, 'pane'), { timeout: 30_000 }).toBe('open')
    for (let i = 1; i <= DELTA_COUNT; i += 1) {
      expect(await pumpPush(page, 'pane', sseChunk(filler(paneDelta(i))))).toBe(true)
    }
    // 末帧先落完再收尾。形态必须用 expect.poll:同会话并发流下打字机有"重挂回放"型抖动
    // (2026-10-23 取证:store 快照始终全文,DOM 尾态短暂回退后再聚齐;单次 toContainText 会咬到瞬态假红,
    // 见本 spec 头部"已知抖动"注记)
    await expect
      .poll(
        async () => {
          const text = await paneList(page, SECOND_PANE).evaluate((el) => el.textContent ?? '')
          return text.includes(filler(paneDelta(DELTA_COUNT)))
        },
        {
          // 2026-10-24 真跑取证(8801):共享机高负载下三次 pumpPush 的 delta 间隔实测
          // ~4.6–5.8s(SSE-DEBUG),末帧落到 DOM 又在末帧 ~30s 后才聚齐 —— 恰与 api-client
          // 的 30s 空闲读超时重连同刻。30s poll 与这条重连赛跑,实测连续咬到 deadline;
          // 判据不动,只把窗口放宽一倍(测试级 timeout 180s 仍兜底)。
          timeout: 60_000,
          message: 'pane-1 末帧始终未落完(收束前)',
        },
      )
      .toBe(true)
    expect(await pumpPush(page, 'pane', sseDone())).toBe(true)
    expect(await pumpClose(page, 'pane')).toBe(true)

    // pane-1 必须"真的动了"(跟随新内容下移 >60px)——反证"两边都纹丝不动"的假绿
    await expect
      .poll(() => scrollTopOf(page, SECOND_PANE), { timeout: 15_000 })
      .toBeGreaterThan(pane1Baseline + 60)
    // 对侧(同一枚会话!)纹丝不动:滚动位 ≤2px 不漂、条数不变、正文不含对方载荷
    // (probe 用 poll 到稳态,单次快照会被回放抖动咬到)
    await expect
      .poll(
        async () => {
          const p = await probePanes(page, [paneDelta(3), rootDelta(1)])
          return `${p['pane-root']?.has[paneDelta(3)] ? 'R-BLED' : 'R-clean'}|${
            p['pane-root']?.windowTotal === 56 ? 'R-wt56' : `R-wt${p['pane-root']?.windowTotal}`
          }|${p['pane-1']?.windowTotal === 58 ? 'P-wt58' : `P-wt${p['pane-1']?.windowTotal}`}|${
            p['pane-1']?.has[paneDelta(3)] ? 'P-hasY3' : 'P-noY3'
          }`
        },
        { timeout: 20_000, message: '甲腿隔离稳态未达成(串写/装载数被改变)' },
      )
      .toBe('R-clean|R-wt56|P-wt58|P-hasY3')
    const rootAfterPane = await scrollTopOf(page, ROOT_PANE)
    expect(
      Math.abs(rootAfterPane - rootRecorded),
      `pane-1 的流式把根格滚动位拽动了 ${rootAfterPane - rootRecorded}px`,
    ).toBeLessThanOrEqual(2)

    // 乙腿(反向):pane-1 滚离底部钉在 ~60% 处,根格流式一整条
    const pane1Recorded = await scrollToMessageTop(page, SECOND_PANE, `${CONV_LONG}-m-33`)
    expect(pane1Recorded).toBeGreaterThan(200)
    await sendInPane(page, ROOT_PANE, `${PUMP_ROOT_MARK} scroll-leg run`)
    await expect.poll(() => pumpStateOf(page, 'root'), { timeout: 30_000 }).toBe('open')
    for (let i = 1; i <= DELTA_COUNT; i += 1) {
      expect(await pumpPush(page, 'root', sseChunk(filler(rootDelta(i))))).toBe(true)
    }
    // 末帧先落完再收尾(poll 形态,同甲腿注记)
    await expect
      .poll(
        async () => {
          const text = await paneList(page, ROOT_PANE).evaluate((el) => el.textContent ?? '')
          return text.includes(filler(rootDelta(DELTA_COUNT)))
        },
        {
          // 同甲腿注记:30s 窗口与 api-client 的空闲读超时重连同刻,判据不动只放宽窗口。
          timeout: 60_000,
          message: '根格末帧始终未落完(收束前)',
        },
      )
      .toBe(true)
    expect(await pumpPush(page, 'root', sseDone())).toBe(true)
    expect(await pumpClose(page, 'root')).toBe(true)
    await expect(paneList(page, ROOT_PANE)).toContainText(filler(rootDelta(3)), {
      timeout: 15_000,
    })

    await expect
      .poll(
        async () => {
          const p = await probePanes(page, [rootDelta(3), paneDelta(3)])
          return `${p['pane-1']?.has[rootDelta(3)] ? 'P-BLED' : 'P-clean'}|${
            p['pane-1']?.windowTotal === 58 ? 'P-wt58' : `P-wt${p['pane-1']?.windowTotal}`
          }|${p['pane-root']?.windowTotal === 58 ? 'R-wt58' : `R-wt${p['pane-root']?.windowTotal}`}`
        },
        { timeout: 20_000, message: '乙腿隔离稳态未达成(串写/装载数被改变)' },
      )
      .toBe('P-clean|P-wt58|R-wt58')
    const pane1AfterRoot = await scrollTopOf(page, SECOND_PANE)
    expect(
      Math.abs(pane1AfterRoot - pane1Recorded),
      `根格的流式把 pane-1 的滚动位拽动了 ${pane1AfterRoot - pane1Recorded}px(同一会话下滚动权不得跨格)`,
    ).toBeLessThanOrEqual(2)
    // 两格的落账键是 (paneId, conversationId) 二元:此刻两格同一会话、两个不同的稳定落点
    expect(
      Math.abs(pane1AfterRoot - rootAfterPane),
      '两格同一会话却收敛到同一个滚动位 ⇒ 滚动身份被并成了一格',
    ).toBeGreaterThan(200)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
