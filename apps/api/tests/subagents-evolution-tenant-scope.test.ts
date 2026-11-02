// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// @ihui-seat P0-4 2026-11-02

/**
 * P0-4 回归锁:`evolutionHistories` 的租户维度(2026-11-02)。
 *
 * 背景:该 Map 只用 `role` 作键 ⇒ 全站共享一份演化历史。任何登录用户对同一 role:
 *  `GET evolution-history` 读到别人的 prompt 版本与补丁,`evolve` 扫描别人的执行记录,
 *  `apply-evolution` 直接改写别人的 currentPrompt 并把 recentRecords 清空。
 *
 * 采用**复合键** `${userId}:${role}`(理由见生产源 evolutionHistories 注释):
 * 隔离写进键本身,所有读写点只做一次 O(1) 取用,不存在"忘了过滤 owner"这一档。
 *
 * 本文件钉住:
 *  ① B 应用补丁后,A 的 currentPrompt / versions / recentRecords 逐项不变(深比较);
 *  ② A 读不到 B 的补丁文本(evolution-history 响应体不含 B 的 suggestedReplacement);
 *  ③ B 的补丁确实进了 B 自己的历史(正例,证明上面的"不变"不是两边都没生效);
 *  ④ evolve 只扫描本人的 recentRecords(A 有 2 条 → scannedRecords=2,B 0 条 → 0);
 *  ⑤ A 后续 apply-evolution 的版本号接着自己的 v1 走(v2),没有被 B 的写入干扰。
 *
 * 反向例(实测见交付报告):把 evolutionKey 换回裸 role ⇒ ①②③④⑤ 立刻变红。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

vi.hoisted(() => {
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  checkAuth: async () => true,
}))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdminRouteGuard: async (request: { userId?: string; headers: Record<string, unknown> }) => {
    const raw = request.headers['x-probe-user']
    request.userId = typeof raw === 'string' && raw.length > 0 ? raw : 'tenant-a'
  },
  // dispatch-ownership 的 isAdminViewer 走这个唯一口径;本文件没有管理面用例,恒 false。
  isSystemAdmin: () => false,
}))

vi.mock('../src/services/subagent-dispatch-service.js', () => ({
  subagentDispatchService: {
    findById: () => null,
    getMessages: () => [],
    getDispatchStats: () => null,
  },
}))

// LLM 分析走 ai-service;测试里让它立即失败 ⇒ callAiService 返回 null,走空桩分支(不出网)
vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceFetch: async () => {
    throw new Error('ai-service offline in unit test')
  },
}))

import { subagentsExtendedRoutes, __test__ } from '../src/routes/subagents-extended-routes.js'

const asA = { 'x-probe-user': 'tenant-a' }
const asB = { 'x-probe-user': 'tenant-b' }

const ROLE = 'coder'
const B_SECRET = 'B-SECRET-PATCH-TEXT'

interface EvolutionRecord {
  dispatchId: string
  agentRole: string
  taskDescription: string
  result: string
  retryCount: number
  userFeedback: string | undefined
  success: boolean
  durationMs: number
  tokenUsage: number
  recordedAt: string
}

interface EvolutionHistoryLike {
  agentRole: string
  currentPrompt: string
  versions: Array<{ version: string; prompt: string; changes: unknown[]; createdAt: string }>
  recentRecords: EvolutionRecord[]
}

function record(n: number): EvolutionRecord {
  return {
    dispatchId: `a-rec-${n}`,
    agentRole: ROLE,
    taskDescription: `A-task-${n}`,
    result: `A-result-${n}`,
    retryCount: 0,
    userFeedback: undefined,
    success: true,
    durationMs: 10 * n,
    tokenUsage: 5 * n,
    recordedAt: '2026-11-01T00:00:00.000Z',
  }
}

function seedAHistory(): EvolutionHistoryLike {
  const history: EvolutionHistoryLike = {
    agentRole: ROLE,
    currentPrompt: 'A-PROMPT-V1',
    versions: [
      { version: 'v1', prompt: 'A-PROMPT-V1', changes: [], createdAt: '2026-11-01T00:00:00.000Z' },
    ],
    recentRecords: [record(1), record(2)],
  }
  __test__.evolutionHistories.set(__test__.evolutionKey('tenant-a', ROLE), history as never)
  return history
}

let app: FastifyInstance

async function getHistory(headers: Record<string, string>) {
  return app.inject({
    method: 'GET',
    url: `/api/subagents/agents/${ROLE}/evolution-history`,
    headers,
  })
}

async function apply(
  headers: Record<string, string>,
  originalText: string,
  suggestedReplacement: string,
) {
  return app.inject({
    method: 'POST',
    url: `/api/subagents/agents/${ROLE}/apply-evolution`,
    headers,
    payload: {
      patches: [{ originalText, suggestedReplacement, reason: 'test-reason' }],
    },
  })
}

beforeEach(async () => {
  __test__.customRoles.clear()
  __test__.evolutionHistories.clear()
  app = Fastify()
  await app.register(subagentsExtendedRoutes, { prefix: '/api' })
  await app.ready()
})

afterEach(async () => {
  await app.close()
  __test__.evolutionHistories.clear()
})

describe('P0-4 ① B 应用补丁后 A 的历史逐项不变', () => {
  it('A 的 currentPrompt / versions / recentRecords 深比较完全不变', async () => {
    const aHistory = seedAHistory()
    const snapshot = JSON.parse(JSON.stringify(aHistory)) as EvolutionHistoryLike

    // B 对同名 role 应用补丁(内置 coder 的初始 prompt 里有 "coding")
    const res = await apply(asB, 'coding', B_SECRET)
    expect(res.statusCode).toBe(200)

    const after = __test__.evolutionHistories.get(__test__.evolutionKey('tenant-a', ROLE)) as unknown as
      | EvolutionHistoryLike
      | undefined
    expect(after).toBeDefined()
    expect(after).toEqual(snapshot)
    expect(after!.currentPrompt).toBe('A-PROMPT-V1')
    expect(after!.versions).toHaveLength(1)
    // 最关键:别人的 apply-evolution 不能把 A 的 recentRecords 清空
    expect(after!.recentRecords).toHaveLength(2)
    expect(after!.recentRecords.map((r) => r.dispatchId)).toEqual(['a-rec-1', 'a-rec-2'])
  })
})

describe('P0-4 ② A 读不到 B 的补丁文本', () => {
  it('A 的 evolution-history 不含 B 的 suggestedReplacement;B 的 own 响应含它(正例)', async () => {
    seedAHistory()
    expect((await apply(asB, 'coding', B_SECRET)).statusCode).toBe(200)

    const aRes = await getHistory(asA)
    expect(aRes.statusCode).toBe(200)
    expect(aRes.body).not.toContain(B_SECRET)
    const aBody = aRes.json() as { data: EvolutionHistoryLike }
    expect(aBody.data.currentPrompt).toBe('A-PROMPT-V1')
    expect(aBody.data.versions).toHaveLength(1)

    const bRes = await getHistory(asB)
    expect(bRes.statusCode).toBe(200)
    expect(bRes.body).toContain(B_SECRET)
    const bBody = bRes.json() as { data: EvolutionHistoryLike }
    expect(bBody.data.currentPrompt).toContain(B_SECRET)
    expect(bBody.data.recentRecords).toEqual([])
  })
})

describe('P0-4 ④ evolve 只扫描本人的 recentRecords', () => {
  it('A 的 evolve 扫到自己的 2 条;B 的 evolve 扫到 0 条', async () => {
    seedAHistory()

    const aRes = await app.inject({
      method: 'POST',
      url: `/api/subagents/agents/${ROLE}/evolve`,
      headers: asA,
    })
    expect(aRes.statusCode).toBe(200)
    expect((aRes.json() as { data: { scannedRecords: number } }).data.scannedRecords).toBe(2)

    const bRes = await app.inject({
      method: 'POST',
      url: `/api/subagents/agents/${ROLE}/evolve`,
      headers: asB,
    })
    expect(bRes.statusCode).toBe(200)
    expect((bRes.json() as { data: { scannedRecords: number } }).data.scannedRecords).toBe(0)
  })
})

describe('P0-4 ⑤ A 的版本号不被 B 的写入干扰', () => {
  it('B 应用后 A 再应用,B 得到 v1、A 得到 v2(各自计数)', async () => {
    seedAHistory()

    const bRes = await apply(asB, 'coding', B_SECRET)
    expect((bRes.json() as { data: { version: { version: string } } }).data.version.version).toBe('v1')

    const aRes = await apply(asA, 'A-PROMPT-V1', 'A-PROMPT-V2')
    expect((aRes.json() as { data: { version: { version: string } } }).data.version.version).toBe('v2')
    expect(
      (__test__.evolutionHistories.get(__test__.evolutionKey('tenant-a', ROLE)) as unknown as EvolutionHistoryLike)
        .currentPrompt,
    ).toBe('A-PROMPT-V2')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
