// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-203 口径 B:Coze workflow 扣费必须按定价折算成成本(分)。
 *
 * 旧行为:`Math.max(1, Math.ceil((输入字符 + 输出字符) / 1000))` 直接当钱包数量扣 ——
 * 既不是 token 也不是分,和 ai_pricing 完全脱节(8000 字符只扣 8,一次真实调用可能 ¥0.08)。
 * 现行为:字符按 4:1 估算 token(输入/输出分列),经 resolveAiCost 按定价折算成分,
 * 再按分扣钱包;模型取 COZE_PRICING_MODEL(未配置则沿用平台默认对话模型)。
 * Kling 固定 1500 属疑似「¥15 一次」的刻意定价,本夹具不动它。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  recordUsage: vi.fn(),
  resolveAiCost: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({ wsUpgradeRequiresCredential: () => () => undefined }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn() }))
vi.mock('jose', () => ({
  SignJWT: class {
    setProtectedHeader() {
      return this
    }
    setIssuer() {
      return this
    }
    setExpirationTime() {
      return this
    }
    setNotBefore() {
      return this
    }
    async sign() {
      return 'jwt'
    }
  },
}))
vi.mock('drizzle-orm', () => ({
  sql: Object.assign((s: TemplateStringsArray) => ({ sql: s.join('') }), { raw: (x: string) => x }),
}))
vi.mock('../src/utils/swagger.js', () => ({ buildSchema: (o: unknown) => o }))
vi.mock('../src/utils/crypto-random.js', () => ({ generateCompactId: () => 'gen-id' }))
vi.mock('../src/utils/n8n-env.js', () => ({
  readN8nBaseUrl: () => undefined,
  n8nBaseHint: () => '',
  resolveN8nWebhookUrl: () => undefined,
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: vi.fn(async () => ({})),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../src/db/video-task-queries.js', () => ({
  createVideoTask: vi.fn(),
  findVideoTasksByUser: vi.fn(),
  findVideoTaskById: vi.fn(),
  updateVideoTask: vi.fn(),
}))
vi.mock('../src/routes/ai-vendors/_shared.js', () => ({
  requireAuth: vi.fn(async () => true),
  callVendor: vi.fn(),
  recordUsage: mocks.recordUsage,
  createTask: vi.fn(),
  requireVendorKey: vi.fn(() => true),
  requireVendorKeys: vi.fn(() => true),
  fetchWithTimeout: mocks.fetchWithTimeout,
  volcengineSign: vi.fn(),
  pollVolcengineTask: vi.fn(),
  pageSizeQuery: z.object({}),
  botIdParam: z.object({ botId: z.string() }),
  tokenQuery: z.object({ token: z.string().optional() }),
  jimengBody: z.object({}),
  taskIdParam: z.object({ taskId: z.string() }),
  n8nAgentStore: new Map(),
  genId: (p: string) => `${p}-id`,
}))
vi.mock('../src/config/body-limits.js', () => ({ MEDIA_BASE64_BODY_LIMIT: 1024 }))
vi.mock('../src/plugins/ai-cost.js', () => ({ resolveAiCost: mocks.resolveAiCost }))

import { toolsVendorRoutes } from '../src/routes/ai-vendors/proxy-tools.js'

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const deductTokens = vi.fn()
const pushNotification = vi.fn()
const server = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
  tokenBalance: { deductTokens },
  pushNotification,
}
await toolsVendorRoutes(server as never, {} as never)

function makeReply() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    sent: false,
    status(c: number) {
      this.statusCode = c
      return this
    },
    send(b: unknown) {
      this.body = b
      this.sent = true
      return this
    },
  }
}

function cozeSse(answer: string) {
  return {
    ok: true,
    text: async () => `${JSON.stringify({ content: { answer } })}\n`,
  }
}

async function runCoze(text: string, answer: string) {
  mocks.fetchWithTimeout.mockResolvedValueOnce(cozeSse(answer))
  const reply = makeReply()
  await handlers.get('POST /coze/workflow/chat')!(
    { userId: 'u1', body: { text } },
    reply,
  )
  return reply
}

beforeEach(() => {
  process.env.COZE_WORKFLOW_URL = 'https://coze.test/workflow'
  process.env.COZE_WORKFLOW_TOKEN = 'token'
  process.env.COZE_PRICING_MODEL = 'coze-price-model'
  mocks.fetchWithTimeout.mockReset()
  mocks.resolveAiCost.mockReset()
  mocks.resolveAiCost.mockResolvedValue({ cost: 3.2, currency: 'CNY', pricing: null })
  deductTokens.mockReset().mockResolvedValue({ success: true, remaining: 900 })
})

describe('F-203 Coze workflow 按定价成本(分)扣费', () => {
  it('输入/输出分别按 4:1 估 token,再折算成分后扣费', async () => {
    const reply = await runCoze('abcd', 'efgh')

    expect(reply.statusCode).toBe(200)
    expect(mocks.resolveAiCost).toHaveBeenCalledWith({
      model: 'coze-price-model',
      promptTokens: 1,
      completionTokens: 1,
    })
    // 3.2 分 → ceil 4 分;旧口径是 ceil(8/1000)=1
    expect(deductTokens).toHaveBeenCalledWith('u1', 4, 'coze_workflow_chat')
  })

  it('长文本不再按 chars/1000 扣:8000 字符折 2000 token → 走定价,而非扣 8', async () => {
    mocks.resolveAiCost.mockResolvedValue({ cost: 48, currency: 'CNY', pricing: null })
    const reply = await runCoze('a'.repeat(4000), 'b'.repeat(4000))

    expect(reply.statusCode).toBe(200)
    expect(mocks.resolveAiCost).toHaveBeenCalledWith({
      model: 'coze-price-model',
      promptTokens: 1000,
      completionTokens: 1000,
    })
    expect(deductTokens).toHaveBeenCalledWith('u1', 48, 'coze_workflow_chat')
  })

  it('模型无定价(成本 0)时不扣费,不退回「至少扣 1」的错误口径', async () => {
    mocks.resolveAiCost.mockResolvedValue({ cost: 0, currency: 'CNY', pricing: null })
    const reply = await runCoze('abcd', 'efgh')

    expect(reply.statusCode).toBe(200)
    expect(deductTokens).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
