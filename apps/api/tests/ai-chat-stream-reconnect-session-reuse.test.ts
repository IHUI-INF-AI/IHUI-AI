// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * D690 网关触发面(承 2026-10-22 票):主对话断线重连必须存在
 * 「复用同一 streamSessionId 重 POST ai-service」的请求形态。
 *
 * 病根(票面原话):apps/api 每轮 randomUUID 新 streamSessionId、15s 宽限内接管原上游
 * 连接而非重 POST ⇒ ai-service 侧 `_approval_replay_frames` 重放臂零触发。
 * 本文件在**网关边界**取证(上游 fetch 全 mock,零真连):
 *
 * ① 端到复现(票面验收判据的测试形态):审批待决窗口断线(首流发出 tool-approval 帧后
 *    客户端断开、原上游保持存活)→ 重连(无 Last-Event-ID,落回再生路径)→
 *    重 POST 携带**同一** streamSessionId ∧ 原上游此刻尚未 abort(闸③可兑现的活等待者
 *    还在)→ 上游以重放臂回帧(`replay: true`)→ 该帧到达重连客户端。
 * ② 三闸对位·反例:原上游已 abort(宽限超时形态)⇒ 待决表必空(闸③不成立),
 *    重连必须换新 uuid —— 复用死 id 徒扰 _steer_sessions 注册且重放恒零帧。
 * ③ 接管路径零回归:带 Last-Event-ID 的宽限内重连仍走接管(不重 POST,fetch 调用数不变),
 *    缺失段经网关重放缓冲找回(与 ai-service 重放臂互不抢活)。
 *
 * 测试手法:真 `server.listen({port:0,host:'127.0.0.1'})` + 真 fetch 客户端(断线 =
 * AbortController.abort 真销毁连接;服务端摘除动作 = 直接调 detachOnClose —— 该
 * close→摘除接线由 sse-stream-registry.test.ts 单元面钉死,本票不复测),
 * 上游 mock 把每次 POST 的 body/signal 录进 calls,并把每个流的 controller 交给测试
 * 逐帧注入;signal 的 abort 事件被接成 body.error(AbortError),仿真 undici 取消形态。
 * Mock 块沿用 ai-chat-stream-open-timing.test.ts 的隔离面(config/auth/types/db 全桩)。
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Fastify from 'fastify'

// ── Mock 块(与 ai-chat-stream-open-timing.test.ts 同规)──────────────────────
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
import { detachOnClose, findSession } from '../src/utils/sse-stream-registry.js'

// ── 上游 mock:逐次 POST 录 body/signal,流由测试逐帧注入 ─────────────────────
type CapturedCall = {
  url: string
  body: Record<string, unknown>
  signal: AbortSignal | null
  /** 本次 POST 发出时,第一路(原)上游的 abort 状态;首次 POST 为 null */
  firstSignalAbortedAtIssue: boolean | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

let calls: CapturedCall[] = []
let controllers: ReadableStreamDefaultController[] = []
const allControllers: ReadableStreamDefaultController[] = []
let firstSignal: AbortSignal | null = null
const originalFetch = globalThis.fetch

function installUpstreamMock(): void {
  calls = []
  controllers = []
  firstSignal = null
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
    const idx = calls.length
    const signal = i.signal ?? null
    calls.push({
      url: u,
      body: JSON.parse(String(i.body ?? '{}')) as Record<string, unknown>,
      signal,
      firstSignalAbortedAtIssue: idx > 0 ? (firstSignal ? firstSignal.aborted : null) : null,
    })
    if (idx === 0) firstSignal = signal
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
    void url
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

function approvalFrame(approvalId: string, replay: boolean): string {
  const payload: Record<string, unknown> = {
    type: 'tool-approval',
    approval_id: approvalId,
    tool_name: 'run_command',
    tool_call_id: `call-${approvalId}`,
    args_preview: '{"argv":["ls"]}',
    danger_level: 'high',
    session_id: 'upstream-session',
  }
  if (replay) payload.replay = true
  return `event: tool-approval\ndata: ${JSON.stringify(payload)}\n\n`
}

const DONE_FRAME = `data: ${JSON.stringify({ type: 'done' })}\n\n`

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
 * 字节前不落任何字节到 socket(writeHead 被 Node 排队),响应头要等首帧写出才到客户端
 * ——若先 await fetch 再注入上游帧,测试与服务端互等成死锁。故 fetch 的兑现推迟到
 * 第一次 readUntil/finish,调用序必须是: startStream → 等 calls 录到 POST →
 * enqueueUpstream → await c.readUntil(...)。
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

describe('D690 网关触发面:断线重连复用同一 streamSessionId 重 POST', () => {
  it('① 端到复现:审批待决窗口断线 → 重连(无 Last-Event-ID)→ 同 id 重 POST → replay:true 帧到达', async () => {
    installUpstreamMock()
    const conv = 'd690-conv-1'
    const msg = 'd690-msg-1'
    const key = `${conv}:${msg}`
    try {
      // 首轮:上游发出 tool-approval 帧后进入"待决窗口"(流保持打开,审批未答)
      const c1 = startStream(conv, msg)
      await waitFor(() => calls.length === 1, '首轮上游 POST 发出')
      const s1 = calls[0]!.body.streamSessionId
      expect(
        typeof s1,
        `calls[0] url=${calls[0]!.url} body=${JSON.stringify(calls[0]!.body).slice(0, 400)}`,
      ).toBe('string')
      expect(s1).toMatch(UUID_RE)
      // 首个上游字节 ⇒ 服务端落首帧、响应头随之到达,fetch 方才兑现
      enqueueUpstream(0, approvalFrame('appr-1', false))
      await c1.readUntil((t) => t.includes('appr-1'))

      // 断线:客户端 abort 真销毁连接;服务端摘除 = detachOnClose 进 15s 宽限
      // (close→摘除接线属既有 #22 单元面,见文件头注记)
      c1.disconnect()
      await new Promise((r) => setTimeout(r, 50))
      detachOnClose(findSession(key)!)
      expect(findSession(key)!.raw).toBeNull()
      expect(firstSignal!.aborted).toBe(false) // 宽限内上游保持存活(票面前提)

      // 重连(不带 Last-Event-ID,落回再生路径)
      const c2 = startStream(conv, msg)
      await waitFor(() => calls.length === 2, '重连触发第二次上游 POST')
      // 触发形态成立:重 POST 复用同一 streamSessionId
      expect(calls[1]!.body.streamSessionId).toBe(s1)
      // 三闸对位·闸③:POST 发出时原上游仍存活(活等待者还在,重放臂读得到表)
      expect(calls[1]!.firstSignalAbortedAtIssue).toBe(false)

      // 上游重放臂回帧(以 mock 注入代表 ai-service 侧行为,判归 ai-service 测试钉死)
      enqueueUpstream(1, approvalFrame('appr-1', true))
      const seen = await c2.readUntil((t) => t.includes('"replay":true'))
      expect(seen).toContain('appr-1')
      // 首字节已过 ⇒ 原上游此刻被收口(单消费者不变量,交接窗口有界)
      await waitFor(() => firstSignal!.aborted, '原上游在新流首字节后取消')

      enqueueUpstream(1, DONE_FRAME)
      closeUpstream(1)
      await c2.finish()
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('② 反例对位:原上游已 abort(宽限超时形态)⇒ 表必空,重连换新 uuid 不复用死 id', async () => {
    installUpstreamMock()
    const conv = 'd690-conv-2'
    const msg = 'd690-msg-2'
    const key = `${conv}:${msg}`
    try {
      const c1 = startStream(conv, msg)
      await waitFor(() => calls.length === 1, '首轮上游 POST 发出')
      const s1 = calls[0]!.body.streamSessionId
      enqueueUpstream(0, approvalFrame('appr-2', false))
      await c1.readUntil((t) => t.includes('appr-2'))
      c1.disconnect()
      await new Promise((r) => setTimeout(r, 50))
      detachOnClose(findSession(key)!)

      // 模拟宽限超时:graceTimer 到点的动作 = controller.abort()(条目随之被取消 finally 摘除)
      findSession(key)!.controller.abort()
      await waitFor(() => findSession(key) === undefined, '原流收口出档')

      const c2 = startStream(conv, msg)
      await waitFor(() => calls.length === 2, '重连触发第二次上游 POST')
      expect(calls[1]!.body.streamSessionId).not.toBe(s1)
      expect(calls[1]!.body.streamSessionId).toMatch(UUID_RE)
      expect(calls[1]!.firstSignalAbortedAtIssue).toBe(true)

      enqueueUpstream(1, DONE_FRAME)
      closeUpstream(1)
      await c2.finish()
      closeUpstream(0)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('③ 零回归:带 Last-Event-ID 的宽限内重连仍走接管,不产生第二次上游 POST', async () => {
    installUpstreamMock()
    const conv = 'd690-conv-3'
    const msg = 'd690-msg-3'
    const key = `${conv}:${msg}`
    try {
      const c1 = startStream(conv, msg)
      await waitFor(() => calls.length === 1, '首轮上游 POST 发出')
      enqueueUpstream(0, approvalFrame('appr-3', false))
      await c1.readUntil((t) => t.includes('appr-3'))
      c1.disconnect()
      await new Promise((r) => setTimeout(r, 50))
      detachOnClose(findSession(key)!)

      // 标准 Last-Event-ID 重连:客户端只确认到 0 ⇒ 缺失段 = id:1 的审批帧
      // (接管路径同步写出缓冲帧,响应头随之落)
      const c2 = startStream(conv, msg, '0')
      const seen = await c2.readUntil((t) => t.includes('appr-3'))
      expect(seen).toContain('appr-3')
      expect(seen).not.toContain('"replay":true') // 网关缓冲重放,不经 ai-service 重放臂
      expect(calls.length).toBe(1) // 接管:零重 POST

      enqueueUpstream(0, DONE_FRAME)
      closeUpstream(0)
      await c2.finish()
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
