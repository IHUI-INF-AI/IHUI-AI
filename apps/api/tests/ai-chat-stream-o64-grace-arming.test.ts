// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * O64(2026-10-22 立)生产接线面:真断连必须能武装宽限定时器(零直调)。
 *
 * 病根(票面原话):Node≥16 下 `request.raw`(IncomingMessage,Readable autoDestroy)的
 * 'close' 在请求体收全即触发、真断连不再二次触发 ⇒ 重连两处(修复前:接管分支与正常路径
 * 的 `request.raw.on('close', …)`)都在收体之后才注册监听,生产形态收不到断连信号 ⇒
 * 宽限定时器从不武装。单元面(sse-stream-registry.test.ts)与 D690 接线测试均直调
 * detachOnClose 摘除,绕过了路由接线,掩盖了这一缺口。
 *
 * 本文件是票面要求的生产接线面:真 `server.listen({port:0})` 环回 + 真 fetch 客户端 +
 * 真断连(AbortController.abort 销毁 socket),全程**不直调任何 registry 摘除 API**——
 * 武装完全依赖路由自身的 close→detach 接线。
 *
 * ① 正常再生路径:首帧后真断连 ⇒ session.raw 置 null ∧ graceTimer 已武装 ∧ 宽限内上游
 *    保持存活;再触发该已武装定时器到点动作 ⇒ 上游 abort、流收口出档。
 * ② 接管分支:带 Last-Event-ID 重连接管(宽限撤销、连接换绑)后,新连接真断连 ⇒
 *    同一 session 的 graceTimer 重新武装(钉接管分支的监听注册时序)。
 *
 * 宽限定时器观测:临时包一层 globalThis.setTimeout,只截获 delay=SSE_GRACE_PERIOD_MS
 * 的回调(句柄仍为可 clearTimeout 的真实定时器,但不让宽限动作真到点),用于武装断言与
 * 手动触发到点动作;其余延迟一律透传,finally 恢复。缓冲 60s 保留定时器(RELEASE_DELAY_MS)
 * 延迟不同,不受截获影响。Mock 块沿用 ai-chat-stream-reconnect-session-reuse.test.ts 同规。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// ── Mock 块(与 reconnect-session-reuse 测试同规)────────────────────────────
vi.mock('jose', () => ({
  decodeJwt: () => ({}),
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuer() {
      return this
    }
    setAudience() {
      return this
    }
    setSubject() {
      return this
    }
    setIssuedAt() {
      return this
    }
    setExpirationTime() {
      return this
    }
    async sign() {
      return 'mock-system-access-token'
    }
  },
}))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:8810/test',
    REDIS_URL: 'redis://localhost:8811',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://mock-ai-service:8803',
    CREDENTIALS_ENCRYPTION_KEY: 'a'.repeat(32),
  },
}))
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}))
vi.mock('@ihui/auth', () => ({
  signAccessToken: vi.fn().mockResolvedValue('mock-access-token'),
  signRefreshToken: vi.fn().mockResolvedValue('mock-refresh-token'),
  verifyAccessToken: mockVerifyAccessToken,
  createFamilyId: vi.fn().mockReturnValue('00000000-0000-4000-8000-000000000002'),
}))
vi.mock('../src/db/usercenter-queries.js', () => ({ getUserStatus: vi.fn().mockResolvedValue(1) }))
vi.mock('@ihui/types', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    repairMessages: (msgs: unknown[]) => ({ repaired: msgs, removed: 0 }),
  }
})
const { mockCompressContextIfNeeded } = vi.hoisted(() => ({
  mockCompressContextIfNeeded: vi.fn(),
}))
vi.mock('@ihui/context-compaction', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return { ...actual, compressContextIfNeeded: mockCompressContextIfNeeded }
})
vi.mock('../src/db/chat-queries.js', () => ({
  createMessage: vi.fn().mockResolvedValue({ id: 'mock-msg-id' }),
  patchConversationMetadata: vi.fn().mockResolvedValue(undefined),
  replaceMessages: vi.fn().mockResolvedValue(undefined),
  createConversation: vi.fn(),
  findConversationsByUser: vi.fn(),
  findConversationById: vi.fn(),
  updateConversation: vi.fn(),
  deleteConversation: vi.fn(),
  deleteConversationsBatch: vi.fn(),
  favoriteConversationsBatch: vi.fn(),
  unfavoriteConversationsBatch: vi.fn(),
  setConversationsArchivedBatch: vi.fn(),
  findMessages: vi.fn(),
  findMessageById: vi.fn(),
  deleteMessage: vi.fn(),
  clearMessages: vi.fn(),
  favoriteConversation: vi.fn(),
  unfavoriteConversation: vi.fn(),
  findFavoriteConversations: vi.fn(),
  archiveConversation: vi.fn(),
  unarchiveConversation: vi.fn(),
  findMessagesForExport: vi.fn().mockResolvedValue([]),
  findMessagesForShare: vi.fn(),
  saveCompressedContext: vi.fn(),
  setConversationShareToken: vi.fn(),
  findConversationByShareToken: vi.fn(),
  regenerateConversationMessages: vi.fn(),
  branchConversationFrom: vi.fn(),
  bindConversationWorkspace: vi.fn().mockResolvedValue(undefined),
  setConversationAdditionalDirectories: vi.fn(),
}))
vi.mock('../src/db/index.js', () => ({ db: {}, dbRead: {} }))
const { mockRecordAiCost, mockPersistMessageArchive } = vi.hoisted(() => ({
  mockRecordAiCost: vi.fn(),
  mockPersistMessageArchive: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../src/plugins/ai-cost.js', () => ({ recordAiCost: mockRecordAiCost }))
vi.mock('../src/utils/conversation-archive.js', () => ({
  persistMessageArchive: mockPersistMessageArchive,
}))
vi.mock('../src/services/repo-wiki-context.js', () => ({
  loadRepoWikiContext: vi.fn().mockResolvedValue(null),
}))
vi.mock('../src/services/knowledge-chat-context.js', () => ({
  loadKnowledgeContext: vi.fn().mockResolvedValue(null),
}))
// 半致态隔离(同 open-timing 测试第 9 条注记):require-permission 顶层 import '@ihui/shared'
// 主入口,当前工作树面 import 期即崩,与本票判据无关,用文件级 mock 隔离。
vi.mock('@ihui/shared', () => ({
  toUserFriendlyMessage: vi.fn((e: unknown) => (e instanceof Error ? e.message : 'error')),
  redactSecrets: vi.fn((s: string) => s),
  redactUserHomePathLiterals: vi.fn((s: string) => s),
}))

import { aiChatStreamRoutes } from '../src/routes/ai-chat-stream.js'
import { findSession, SSE_GRACE_PERIOD_MS } from '../src/utils/sse-stream-registry.js'

// ── 上游 mock:POST 录 body/signal,流由测试逐帧注入(同 reconnect 测试手法)──
type CapturedCall = {
  url: string
  body: Record<string, unknown>
  signal: AbortSignal | null
}

let calls: CapturedCall[] = []
let controllers: ReadableStreamDefaultController[] = []
const allControllers: ReadableStreamDefaultController[] = []
const originalFetch = globalThis.fetch

function installUpstreamMock(): void {
  calls = []
  controllers = []
  globalThis.fetch = vi.fn((url: unknown, init: unknown) => {
    const i = (init ?? {}) as { body?: string; signal?: AbortSignal | null }
    const u = String(url)
    // 测试客户端自己打到环回服务器的 fetch 必须透传,只拦 ai-service(mock host)调用
    if (!u.startsWith('http://mock-ai-service:8803')) {
      return (originalFetch as (input: unknown, init?: unknown) => Promise<Response>)(url, init)
    }
    // 只录主对话流 POST(/api/llm/complete/stream);其余 ai-service 调用一律 200 空 JSON 放行
    if (!u.includes('/api/llm/complete/stream')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        body: null,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{}',
        json: async () => ({}),
      })
    }
    const signal = i.signal ?? null
    calls.push({
      url: u,
      body: JSON.parse(String(i.body ?? '{}')) as Record<string, unknown>,
      signal,
    })
    let ctrl: ReadableStreamDefaultController | null = null
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        ctrl = c
      },
    })
    if (ctrl) {
      controllers.push(ctrl)
      allControllers.push(ctrl)
      // 仿真 undici:signal abort ⇒ 在途/后续 read 以 AbortError 拒绝
      signal?.addEventListener('abort', () => {
        try {
          ctrl?.error(new DOMException('Aborted', 'AbortError'))
        } catch {
          /* 已关闭的流重复 error 忽略 */
        }
      })
    }
    return Promise.resolve({
      ok: true,
      status: 200,
      body: stream,
      text: async () => '',
      json: async () => ({}),
    })
  }) as unknown as typeof globalThis.fetch
}

function enqueueUpstream(index: number, frame: string): void {
  controllers[index]!.enqueue(new TextEncoder().encode(frame))
}

function closeUpstream(index: number): void {
  try {
    controllers[index]!.close()
  } catch {
    /* 已被 abort 置错的流无需再关 */
  }
}

function approvalFrame(approvalId: string): string {
  return `event: tool-approval\ndata: ${JSON.stringify({
    type: 'tool-approval',
    approval_id: approvalId,
    tool_name: 'run_command',
    tool_call_id: `call-${approvalId}`,
    args_preview: '{"argv":["ls"]}',
    danger_level: 'high',
    session_id: 'upstream-session',
  })}\n\n`
}

// ── 宽限定时器截获:只捕 delay=SSE_GRACE_PERIOD_MS 的回调,其余透传 ──────────
type GraceCapture = {
  /** 已截获且尚未触发的宽限回调数(= 已武装且未撤销到点动作的定时器数) */
  armedCount: () => number
  /** 触发最近一次武装的宽限到点动作(等价 15s 真到点) */
  fire: () => void
  restore: () => void
}

function captureGraceTimers(): GraceCapture {
  const real = globalThis.setTimeout
  const pending: Array<() => void> = []
  const wrapper = (cb: unknown, ms?: number, ...rest: unknown[]): unknown => {
    if (ms === SSE_GRACE_PERIOD_MS && typeof cb === 'function') {
      pending.push(cb as () => void)
      // 占位句柄:真实定时器(可被 takeoverStream/finishSession 的 clearTimeout 正常撤销),
      // 但回调为空 —— 宽限到点动作改由 fire() 手动触发,测试不真等 15s。
      return real(() => {}, ms, ...(rest as []))
    }
    return (real as (cb: unknown, ms?: number, ...a: unknown[]) => unknown)(cb, ms, ...rest)
  }
  globalThis.setTimeout = wrapper as unknown as typeof setTimeout
  return {
    armedCount: () => pending.length,
    fire: () => {
      const cb = pending.pop()
      if (cb) cb()
    },
    restore: () => {
      globalThis.setTimeout = real
      pending.length = 0
    },
  }
}

// ── 测试服务器(真环回 HTTP,inject 无法模拟中途断连)─────────────────────────
const server = Fastify({ logger: false })
let port = 0

beforeAll(async () => {
  mockVerifyAccessToken.mockResolvedValue({
    userId: '00000000-0000-4000-8000-000000000001',
    phone: '13800000001',
    familyId: '00000000-0000-4000-8000-000000000002',
    roleId: 0,
  })
  await server.register(aiChatStreamRoutes, { prefix: '/api/ai' })
  await server.listen({ port: 0, host: '127.0.0.1' })
  const addr = server.server.address()
  port = typeof addr === 'object' && addr !== null ? addr.port : 0
})

afterAll(async () => {
  globalThis.fetch = originalFetch
  // 防失败用例遗留挂起:先关尽所有上游 mock 流(转发循环随之收口),再切残余客户端连接
  for (const c of allControllers) {
    try {
      c.close()
    } catch {
      /* 已被 abort 置错的流无需再关 */
    }
  }
  server.server.closeAllConnections()
  await server.close()
})

async function waitFor(pred: () => boolean, msg: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!pred()) {
    if (Date.now() > deadline) throw new Error(`超时等待:${msg}`)
    await new Promise((r) => setTimeout(r, 10))
  }
}

type ClientStream = {
  disconnect: () => void
  readUntil: (pred: (text: string) => boolean) => Promise<string>
  finish: () => Promise<string>
}

/**
 * 发起一路客户端流。**同步返回**(fetch 已发出但未 await):再生路径在收到首个上游
 * 字节前不落任何字节到 socket,响应头要等首帧写出才到客户端 —— 若先 await fetch 再注入
 * 上游帧,测试与服务端互等成死锁(同 reconnect-session-reuse 测试注记)。
 */
function startStream(
  conversationId: string,
  messageId: string,
  lastEventId?: string,
): ClientStream {
  const ac = new AbortController()
  const headers: Record<string, string> = {
    authorization: 'Bearer user-token',
    'content-type': 'application/json',
  }
  if (lastEventId !== undefined) headers['last-event-id'] = lastEventId
  const opened = fetch(`http://127.0.0.1:${port}/api/ai/chat/stream`, {
    method: 'POST',
    headers,
    signal: ac.signal,
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'hi' }],
      model: 'gpt-4o',
      metadata: { conversationId, messageId },
    }),
  }).then((res) => {
    if (!res.ok) throw new Error(`stream HTTP ${res.status}`)
    return res.body!.getReader()
  })
  const decoder = new TextDecoder()
  let text = ''
  async function pump(pred: (t: string) => boolean): Promise<string> {
    const reader = await opened
    while (!pred(text)) {
      const { done, value } = await reader.read()
      if (done) break
      text += decoder.decode(value, { stream: true })
    }
    return text
  }
  return {
    disconnect: () => ac.abort(),
    readUntil: (pred) => pump(pred),
    finish: () => pump(() => false),
  }
}

describe('O64 生产接线:真断连武装宽限定时器(全程零直调 detachOnClose)', () => {
  it('① 正常再生路径:真断连 ⇒ raw 置 null + graceTimer 武装 + 宽限内上游存活;到点动作 abort 收口', async () => {
    installUpstreamMock()
    const conv = 'o64-conv-1'
    const msg = 'o64-msg-1'
    const key = `${conv}:${msg}`
    const cap = captureGraceTimers()
    try {
      const c1 = startStream(conv, msg)
      await waitFor(() => calls.length === 1, '首轮上游 POST 发出')
      enqueueUpstream(0, approvalFrame('appr-o64-1'))
      await c1.readUntil((t) => t.includes('appr-o64-1'))

      // 真断连:仅销毁客户端连接,不调任何 registry API
      c1.disconnect()

      const session = findSession(key)
      expect(session, '断线后原会话应仍在档(宽限等待重连)').toBeDefined()
      // O64 核心判据:路由接线(reply.raw close → detachOnClose)把宽限定时器武装起来
      await waitFor(() => session!.graceTimer !== null, '生产形态真断连武装宽限定时器')
      expect(session!.raw).toBeNull()
      expect(cap.armedCount()).toBe(1)
      expect(calls[0]!.signal!.aborted).toBe(false) // 宽限内上游保持存活(#22 语义)

      // 触发已武装定时器的到点动作(等价 15s 真到点):abort 上游 + 流收口出档
      cap.fire()
      await waitFor(() => calls[0]!.signal!.aborted, '宽限到点 abort 上游')
      await waitFor(() => findSession(key) === undefined, '原流收口出档')
    } finally {
      cap.restore()
      closeUpstream(0)
      globalThis.fetch = originalFetch
    }
  })

  it('② 接管分支:Last-Event-ID 接管后新连接真断连 ⇒ 同一 session 重新武装宽限', async () => {
    installUpstreamMock()
    const conv = 'o64-conv-2'
    const msg = 'o64-msg-2'
    const key = `${conv}:${msg}`
    const cap = captureGraceTimers()
    try {
      const c1 = startStream(conv, msg)
      await waitFor(() => calls.length === 1, '首轮上游 POST 发出')
      enqueueUpstream(0, approvalFrame('appr-o64-2'))
      await c1.readUntil((t) => t.includes('appr-o64-2'))

      // 第一次真断连:主路径接线武装宽限
      c1.disconnect()
      const session = findSession(key)!
      await waitFor(() => session.graceTimer !== null, '主路径接线武装宽限')

      // 标准 Last-Event-ID 重连 → 接管:撤销宽限、换绑新连接(缓冲缺失段随接管下发)
      const c2 = startStream(conv, msg, '0')
      const seen = await c2.readUntil((t) => t.includes('appr-o64-2'))
      expect(seen).toContain('appr-o64-2')
      expect(session.graceTimer).toBeNull() // takeoverStream 撤销宽限定时器
      expect(session.raw).not.toBeNull() // 已换绑到接管连接
      expect(calls.length).toBe(1) // 接管零重 POST

      // 接管连接真断连:O64 钉的就是这条接线 —— 修复前挂 request.raw,此处永不武装
      c2.disconnect()
      await waitFor(() => session.graceTimer !== null, '接管分支接线重新武装宽限定时器')
      expect(session.raw).toBeNull()
      expect(cap.armedCount()).toBeGreaterThanOrEqual(1)
      expect(calls[0]!.signal!.aborted).toBe(false)

      // 到点动作收口
      cap.fire()
      await waitFor(() => calls[0]!.signal!.aborted, '宽限到点 abort 上游')
      await waitFor(() => findSession(key) === undefined, '原流收口出档')
    } finally {
      cap.restore()
      closeUpstream(0)
      globalThis.fetch = originalFetch
    }
  })
})
