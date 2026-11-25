/**
 * F-203 / 2026-11-26:Coze workflow 只扣 AI 积分,平台成本另记 ai_cost_records。
 *
 * 旧行为:字符按 4:1 估 token 后直接按成本扣钱包,钱包与积分两本账混用。
 * 现行为:同一份 token 估算,用户积分按模型倍率扣;平台真实成本记 ai_cost_records。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

const mocks = vi.hoisted(() => ({
  fetchWithTimeout: vi.fn(),
  recordUsage: vi.fn(),
  resolveAiCost: vi.fn(),
  recordAiCost: vi.fn(),
  ensureLlmPointsBalance: vi.fn(),
  settleLlmPointsUsage: vi.fn(),
}))

vi.mock('../src/plugins/ws-helpers.js', () => ({ wsUpgradeRequiresCredential: () => () => undefined }))
vi.mock('@ihui/auth', () => ({ verifyAccessToken: vi.fn(), createBlacklist: vi.fn(() => ({ async has() { return false }, async add() {}, async revoke() {} })) }))
vi.mock('jose', () => ({
  SignJWT: class {
    setProtectedHeader() { return this }
    setIssuer() { return this }
    setExpirationTime() { return this }
    setNotBefore() { return this }
    async sign() { return 'jwt' }
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
  registerPoolTrackerCleanup: vi.fn(),
  db: { execute: vi.fn(async () => ({})), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
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
vi.mock('../src/plugins/ai-cost.js', () => ({
  resolveAiCost: mocks.resolveAiCost,
  recordAiCost: mocks.recordAiCost,
}))
vi.mock('../src/services/ai-points-billing.js', () => ({
  ensureLlmPointsBalance: mocks.ensureLlmPointsBalance,
  settleLlmPointsUsage: mocks.settleLlmPointsUsage,
}))

import { toolsVendorRoutes } from '../src/routes/ai-vendors/proxy-tools.js'

type Handler = (request: unknown, reply: unknown) => unknown
const handlers = new Map<string, Handler>()
const pushNotification = vi.fn()
const server = {
  addHook: () => undefined,
  get: (p: string, ...a: unknown[]) => handlers.set(`GET ${p}`, a[a.length - 1] as Handler),
  post: (p: string, ...a: unknown[]) => handlers.set(`POST ${p}`, a[a.length - 1] as Handler),
  delete: (p: string, ...a: unknown[]) => handlers.set(`DELETE ${p}`, a[a.length - 1] as Handler),
  pushNotification,
}
await toolsVendorRoutes(server as never, {} as never)

function makeReply() {
  return {
    statusCode: 200,
    body: undefined as unknown,
    sent: false,
    status(c: number) { this.statusCode = c; return this },
    send(b: unknown) { this.body = b; this.sent = true; return this },
  }
}

function cozeSse(answer: string) {
  return { ok: true, text: async () => `${JSON.stringify({ content: { answer } })}\n` }
}

async function runCoze(text: string, answer: string) {
  mocks.fetchWithTimeout.mockResolvedValueOnce(cozeSse(answer))
  const reply = makeReply()
  await handlers.get('POST /coze/workflow/chat')!(
    {
      userId: 'u1',
      body: { text },
      log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
    },
    reply,
  )
  return reply
}

beforeEach(() => {
  process.env.COZE_WORKFLOW_URL = 'https://coze.test/workflow'
  process.env.COZE_WORKFLOW_TOKEN = 'token'
  process.env.COZE_PRICING_MODEL = 'coze-price-model'
  mocks.fetchWithTimeout.mockReset()
  mocks.resolveAiCost.mockReset().mockResolvedValue({ cost: 3.2, currency: 'CNY', pricing: null })
  mocks.recordAiCost.mockReset().mockResolvedValue({ cost: 4, currency: 'CNY' })
  mocks.ensureLlmPointsBalance.mockReset().mockResolvedValue(true)
  mocks.settleLlmPointsUsage.mockReset().mockImplementation(
    async (input: { promptTokens: number; completionTokens: number }) => {
      const points = Math.ceil(input.promptTokens + input.completionTokens)
      return {
        deducted: points,
        remaining: 1000 - points,
        shortfall: 0,
        alreadySettled: false,
        quote: {
          promptTokens: input.promptTokens,
          completionTokens: input.completionTokens,
          totalTokens: input.promptTokens + input.completionTokens,
          multiplier: 10,
          points,
        },
      }
    },
  )
})

describe('Coze workflow 两本账计费', () => {
  it('输入/输出分别按 4:1 估 token,再按倍率扣积分;平台成本单独记账', async () => {
    const reply = await runCoze('abcd', 'efgh')

    expect(reply.statusCode).toBe(200)
    expect(mocks.ensureLlmPointsBalance).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1' }),
      expect.anything(),
      'coze-price-model',
      1,
      0,
    )
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith({
      userId: 'u1',
      modelId: 'coze-price-model',
      promptTokens: 1,
      completionTokens: 1,
      source: 'coze_workflow_chat',
      description: 'Coze 工作流对话',
      referenceId: 'coze:coze-id',
    })
    expect(mocks.recordAiCost).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'coze-price-model', cost: 4, totalTokens: 2 }),
    )
  })

  it('长文本不再按 chars/1000 扣:8000 字符折 2000 token → 按倍率结算', async () => {
    mocks.resolveAiCost.mockResolvedValue({ cost: 48, currency: 'CNY', pricing: null })
    const reply = await runCoze('a'.repeat(4000), 'b'.repeat(4000))

    expect(reply.statusCode).toBe(200)
    expect(mocks.settleLlmPointsUsage).toHaveBeenCalledWith(
      expect.objectContaining({ promptTokens: 1000, completionTokens: 1000 }),
    )
  })

  it('模型无定价(成本 0)时仍不产生钱包扣费', async () => {
    mocks.resolveAiCost.mockResolvedValue({ cost: 0, currency: 'CNY', pricing: null })
    const reply = await runCoze('abcd', 'efgh')

    expect(reply.statusCode).toBe(200)
    // 旧钱包链路已完全移除
    expect((server as unknown as { tokenBalance?: unknown }).tokenBalance).toBeUndefined()
  })
})
