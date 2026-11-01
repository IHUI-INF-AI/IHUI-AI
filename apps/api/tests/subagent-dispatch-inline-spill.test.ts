// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F4(2026-11-02)Inline & Spill 最小形态。
 *
 * 背景:`runDispatchDag` 把上游结果 `slice(0, 500)` 塞进下游 prompt —— 超过 500 字的部分
 * 被直接丢弃,下游没有任何办法取回全文。
 *
 * 本文件覆盖:
 *  ① 长结果(> 800 字):下游 prompt 只含摘要 inline + id/URL 引用,原文尾部不出现;
 *    产物可从 service.getArtifact 取回全文(Redis 键也可寻址),truncated=false;
 *  ② 短结果(≤ 800 字):整段 inline,不生成引用行(不为短结果制造无谓产物);
 *  ③ 长度上限保护:原文超过 ARTIFACT_MAX_CHARS(200000)时产物按上限截存并标记 truncated,
 *    prompt 的引用行注明「已按上限截存」。
 *
 * 反向例(实测):把 DAG 上游拼装改回 `upstreamResult.slice(0, 500)` ⇒ ① 红(尾部标记丢失、
 * 引用行不存在)。恢复后 sha256 一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { Redis } from 'ioredis'

const { mockFetch, mockInsert, mockInsertValues, mockUpdate, mockSet, mockSelectResult } = vi.hoisted(
  () => ({
    mockFetch: vi.fn(),
    mockInsert: vi.fn(),
    mockInsertValues: vi.fn(),
    mockUpdate: vi.fn(),
    mockSet: vi.fn(),
    mockSelectResult: vi.fn().mockResolvedValue([]),
  }),
)

vi.mock('../src/utils/logger.js', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: mockFetch,
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    insert: mockInsert,
    update: mockUpdate,
    select: vi.fn(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => mockSelectResult()),
        }),
      }),
    })),
  },
  dbRead: {},
}))

vi.mock('@ihui/database', () => ({
  agentTasks: { id: 'agent_tasks_id' },
}))

vi.mock('../src/services/workspace-lock-heartbeat.js', () => ({
  LOCK_HEARTBEAT_INTERVAL_MS: 30_000,
  startLockHeartbeat: vi.fn(),
  stopLockHeartbeat: vi.fn(),
  releaseLockToken: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockFromRow: vi.fn().mockResolvedValue(undefined),
  releaseTaskLockByTaskId: vi.fn().mockResolvedValue(undefined),
  _resetLockHeartbeats: vi.fn(),
  toLockReleaseOutcome: (status: string): string | null =>
    ['completed', 'failed', 'cancelled', 'preempted', 'quota_exceeded', 'deleted'].includes(status)
      ? status
      : null,
}))

import { SubagentDispatchService } from '../src/services/subagent-dispatch-service'

const KEY_ARTIFACT = 'subagent:artifact:'
const INLINE_MAX = 800
const ARTIFACT_MAX = 200_000

/** 最小 Redis 假件(含 F4 产物的 set/get) */
class FakeRedis {
  hashes = new Map<string, Record<string, string>>()
  sets = new Map<string, Set<string>>()
  lists = new Map<string, string[]>()
  zsets = new Map<string, Map<string, number>>()
  strings = new Map<string, string>()

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.sets.get(key) ?? [])
  }
  async sadd(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key) ?? new Set<string>()
    for (const m of members) set.add(m)
    this.sets.set(key, set)
    return members.length
  }
  async srem(key: string, ...members: string[]): Promise<number> {
    const set = this.sets.get(key)
    for (const m of members) set?.delete(m)
    return members.length
  }
  async hgetall(key: string): Promise<Record<string, string>> {
    return { ...(this.hashes.get(key) ?? {}) }
  }
  async hget(key: string, field: string): Promise<string | null> {
    return this.hashes.get(key)?.[field] ?? null
  }
  async hset(key: string, values: Record<string, unknown>): Promise<number> {
    const hash = this.hashes.get(key) ?? {}
    for (const [field, value] of Object.entries(values)) hash[field] = String(value)
    this.hashes.set(key, hash)
    return Object.keys(values).length
  }
  async hdel(key: string, ...fields: string[]): Promise<number> {
    const hash = this.hashes.get(key)
    for (const f of fields) delete hash?.[f]
    return fields.length
  }
  async lpush(key: string, ...values: string[]): Promise<number> {
    const list = this.lists.get(key) ?? []
    list.unshift(...values)
    this.lists.set(key, list)
    return list.length
  }
  async ltrim(key: string, start: number, stop: number): Promise<string> {
    const list = this.lists.get(key) ?? []
    const end = stop < 0 ? list.length + stop + 1 : stop + 1
    this.lists.set(key, list.slice(start, end))
    return 'OK'
  }
  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    const list = this.lists.get(key) ?? []
    const end = stop < 0 ? list.length + stop + 1 : stop + 1
    return list.slice(start, end)
  }
  async zadd(key: string, score: number, member: string): Promise<number> {
    const z = this.zsets.get(key) ?? new Map<string, number>()
    z.set(member, score)
    this.zsets.set(key, z)
    return 1
  }
  async zrem(key: string, ...members: string[]): Promise<number> {
    const z = this.zsets.get(key)
    for (const m of members) z?.delete(m)
    return members.length
  }
  async zrevrange(key: string, start: number, stop: number, withScores?: string): Promise<string[]> {
    const sorted = Array.from(this.zsets.get(key) ?? new Map<string, number>()).sort(
      (a, b) => b[1] - a[1],
    )
    const end = stop < 0 ? sorted.length + stop + 1 : stop + 1
    const slice = sorted.slice(start, end)
    return withScores ? slice.flatMap(([m, s]) => [m, String(s)]) : slice.map(([m]) => m)
  }
  async set(key: string, value: string): Promise<'OK'> {
    this.strings.set(key, value)
    return 'OK'
  }
  async get(key: string): Promise<string | null> {
    return this.strings.get(key) ?? null
  }
  async expire(): Promise<number> {
    return 1
  }
}

function asRedis(fake: FakeRedis): Redis {
  return fake as unknown as Redis
}

async function waitFor(predicate: () => boolean, timeoutMs = 2000): Promise<void> {
  const started = Date.now()
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error('waitFor timeout')
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

const okResponse = (output: string) => ({
  status: 200,
  ok: true,
  statusText: 'OK',
  json: async () => ({ code: 0, message: '', data: { final_output: output, steps: [] } }),
})

/** 从第 n 次 ai-service 调用的 body 里取出该节点的 prompt(items[0].input) */
function promptOfCall(index: number): string {
  const init = mockFetch.mock.calls[index]![1] as { body: string }
  return (JSON.parse(init.body) as { items: Array<{ input: string }> }).items[0]!.input
}

/** 两条节点的 DAG:a → b,用于验证 a 的结果如何进入 b 的 prompt */
const TWO_NODE_DAG = {
  nodes: [
    { id: 'a', agentRole: 'researcher' as const, task: '产出长文' },
    { id: 'b', agentRole: 'coder' as const, task: '消费上游' },
  ],
  edges: [{ from: 'a', to: 'b' }],
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSelectResult.mockResolvedValue([])
  mockFetch.mockReset()
  mockInsert.mockReturnValue({ values: mockInsertValues })
  mockInsertValues.mockReturnValue({
    returning: vi.fn().mockResolvedValue([{ id: 'task-1' }]),
  })
  mockUpdate.mockReturnValue({ set: mockSet })
  mockSet.mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) })
})

describe('F4 ① 长结果:摘要 inline + 产物按 id 引用', () => {
  it('下游 prompt 只含前 800 字 + 引用;全文在 artifact 键里可取回,尾部不丢', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const longOutput = `${'L'.repeat(1500)}-TAIL-MARKER`
    mockFetch.mockImplementationOnce(async () => okResponse(longOutput))
    mockFetch.mockImplementationOnce(async () => okResponse('下游输出'))

    const created = await service.dispatch({
      goal: '带 DAG 的长文派单',
      affectedFiles: ['a.ts'],
      verifyCommands: [],
      constraints: '',
      deliverables: '',
      dag: TWO_NODE_DAG,
      ownerUserId: 'tenant-a',
    })
    const id = created.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'completed', 3000)

    const downstreamPrompt = promptOfCall(1)
    // 摘要 inline:只放前 800 字,尾部不再进入 prompt
    expect(downstreamPrompt).toContain(`[上游 a 结果摘要]: ${longOutput.slice(0, INLINE_MAX)}…`)
    expect(downstreamPrompt).not.toContain('TAIL-MARKER')

    // 引用行:下游拿得到全文的地址(id + 路由),而不是被截断丢弃
    expect(downstreamPrompt).toContain(`[上游 a 全文引用]: id=${id}:a`)
    expect(downstreamPrompt).toContain(`GET /api/subagents/${id}/artifacts/a`)

    // 服务侧按 id 取回全文(信息完整,truncated=false)
    const artifact = await service.getArtifact(id, 'a')
    expect(artifact).not.toBeNull()
    expect(artifact!.id).toBe(`${id}:a`)
    expect(artifact!.content).toBe(longOutput)
    expect(artifact!.truncated).toBe(false)

    // Redis 里也是可寻址全文(跨重启仍能取;不是只在进程内存)
    const stored = fake.strings.get(`${KEY_ARTIFACT}${id}:a`)
    expect(stored).toBeDefined()
    const parsed = JSON.parse(stored!) as { content: string; truncated: boolean }
    expect(parsed.content).toBe(longOutput)
    expect(parsed.truncated).toBe(false)
  })
})

describe('F4 ② 短结果:整段 inline,不生成无谓产物', () => {
  it('≤ 800 字的上游结果原样进 prompt,不出现「全文引用」行', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const shortOutput = '短结果:已完成登录流程梳理'
    mockFetch.mockImplementationOnce(async () => okResponse(shortOutput))
    mockFetch.mockImplementationOnce(async () => okResponse('下游输出'))

    const created = await service.dispatch({
      goal: '短结果 DAG',
      affectedFiles: ['a.ts'],
      verifyCommands: [],
      constraints: '',
      deliverables: '',
      dag: TWO_NODE_DAG,
      ownerUserId: 'tenant-a',
    })
    const id = created.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'completed', 3000)

    const downstreamPrompt = promptOfCall(1)
    expect(downstreamPrompt).toContain(`[上游 a 结果]: ${shortOutput}`)
    expect(downstreamPrompt).not.toContain('全文引用')
    expect(fake.strings.has(`${KEY_ARTIFACT}${id}:a`)).toBe(false)
  })
})

describe('F4 ③ 长度上限保护:超上限按上限截存并标记', () => {
  it('原文 250000 字 ⇒ 产物保留前 200000 字,truncated=true,引用行注明已截存', async () => {
    const fake = new FakeRedis()
    const service = new SubagentDispatchService()
    await service.setRedisClient(asRedis(fake))

    const hugeOutput = `${'H'.repeat(ARTIFACT_MAX + 50_000)}-HUGE-TAIL`
    mockFetch.mockImplementationOnce(async () => okResponse(hugeOutput))
    mockFetch.mockImplementationOnce(async () => okResponse('下游输出'))

    const created = await service.dispatch({
      goal: '超长结果 DAG',
      affectedFiles: ['a.ts'],
      verifyCommands: [],
      constraints: '',
      deliverables: '',
      dag: TWO_NODE_DAG,
      ownerUserId: 'tenant-a',
    })
    const id = created.dispatch!.id
    await waitFor(() => service.findById(id)?.status === 'completed', 5000)

    const downstreamPrompt = promptOfCall(1)
    expect(downstreamPrompt).toContain('已按上限截存')

    const artifact = await service.getArtifact(id, 'a')
    expect(artifact).not.toBeNull()
    expect(artifact!.content.length).toBe(ARTIFACT_MAX)
    expect(artifact!.truncated).toBe(true)
    expect(artifact!.content).not.toContain('HUGE-TAIL')
  })
})
