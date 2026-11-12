// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-52 回归锁(2026-11-11)。
 *
 * 缺陷:GET /api/terminal/sessions/history 每次请求对全库 `terminal:session:*` 做 SCAN,
 *      再对每个 key 串行 hgetall + llen(2N 次 RTT),且无分页/上限。
 * 判据:
 *  1. 默认 limit=20,单页上限 100,越界直接 400(不静默截断);
 *  2. 已建索引时走 `terminal:user:{userId}:sessions` ZSET 分页,不 SCAN、不逐条 hgetall;
 *  3. 元数据批量 pipeline 读取;
 *  4. 无索引老数据退化 SCAN 也有硬上限(命中足够即停 / 扫描 key 数封顶)。
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

const redisMock = vi.hoisted(() => ({
  state: {
    index: {} as Record<string, string[]>,
    metas: {} as Record<string, Record<string, string>>,
    lines: {} as Record<string, number>,
  },
  zcard: vi.fn(),
  zrevrange: vi.fn(),
  zadd: vi.fn(),
  expire: vi.fn(),
  hset: vi.fn(),
  scan: vi.fn(),
  hgetall: vi.fn(),
  llen: vi.fn(),
  pipeline: vi.fn(),
}))

vi.mock('ioredis', () => ({
  default: class RedisStub {
    on() {
      return this
    }
    quit() {
      return Promise.resolve('OK')
    }
    zcard(...args: unknown[]) {
      return redisMock.zcard(...args)
    }
    zrevrange(...args: unknown[]) {
      return redisMock.zrevrange(...args)
    }
    zadd(...args: unknown[]) {
      return redisMock.zadd(...args)
    }
    expire(...args: unknown[]) {
      return redisMock.expire(...args)
    }
    hset(...args: unknown[]) {
      return redisMock.hset(...args)
    }
    scan(...args: unknown[]) {
      return redisMock.scan(...args)
    }
    hgetall(...args: unknown[]) {
      return redisMock.hgetall(...args)
    }
    llen(...args: unknown[]) {
      return redisMock.llen(...args)
    }
    pipeline() {
      return redisMock.pipeline()
    }
    lpush() {
      return Promise.resolve(1)
    }
    ltrim() {
      return Promise.resolve('OK')
    }
    lrange() {
      return Promise.resolve([])
    }
  },
}))

vi.mock('../src/config/index.js', () => ({
  config: { REDIS_URL: 'redis://127.0.0.1:6399' },
}))

// 路由层直连测试:跳过 JWT,固定 userId;terminal 路由只在 POST 用 requireAdmin
vi.mock('../src/plugins/auth.js', () => ({
  authenticate: async (request: { userId?: string }) => {
    request.userId = 'u1'
  },
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: async () => undefined,
}))

import { listHistorySessions } from '../src/services/terminal-service.js'
import { terminalRoutes } from '../src/routes/terminal.js'

const USER = 'u1'
const INDEX_KEY = `terminal:user:${USER}:sessions`

function seedIndexedHistory(userId: string, count: number, otherUserId?: string): string[] {
  const ids = Array.from({ length: count }, (_, i) => `s${i + 1}`)
  redisMock.state.index[`terminal:user:${userId}:sessions`] = ids
  ids.forEach((id, i) => {
    const createdAt = 1_700_000_000_000 - (i + 1) * 1000
    redisMock.state.metas[`terminal:session:${id}`] = {
      userId,
      shell: '/bin/bash',
      cwd: '/tmp',
      kind: 'local',
      createdAt: String(createdAt),
      lastActivityAt: String(createdAt),
      exitCode: '0',
    }
    redisMock.state.lines[`terminal:scrollback:${id}`] = 3
  })
  if (otherUserId) {
    redisMock.state.metas['terminal:session:s1'] = {
      ...redisMock.state.metas['terminal:session:s1']!,
      userId: otherUserId,
    }
  }
  return ids
}

function legacyKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `terminal:session:${prefix}${i + 1}`)
}

function seedMetas(keys: string[], userId: string): void {
  keys.forEach((key, i) => {
    const createdAt = 1_700_000_000_000 - i * 1000
    redisMock.state.metas[key] = {
      userId,
      shell: 'bash',
      cwd: '/',
      kind: 'local',
      createdAt: String(createdAt),
      lastActivityAt: String(createdAt),
    }
  })
}

/** 模拟 SCAN 分批返回;最后一批 next cursor 为 '0' */
function installScanBatches(batches: string[][]): void {
  let call = 0
  redisMock.scan.mockImplementation(async () => {
    const keys = batches[call] ?? []
    call += 1
    return [call < batches.length ? String(call) : '0', keys] as [string, string[]]
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  redisMock.state.index = {}
  redisMock.state.metas = {}
  redisMock.state.lines = {}

  redisMock.zcard.mockImplementation(async (key: string) => redisMock.state.index[key]?.length ?? 0)
  redisMock.zrevrange.mockImplementation(
    async (key: string, start: number, stop: number) =>
      (redisMock.state.index[key] ?? []).slice(start, stop + 1),
  )
  redisMock.zadd.mockResolvedValue(1)
  redisMock.expire.mockResolvedValue(1)
  redisMock.hset.mockResolvedValue(1)
  redisMock.hgetall.mockImplementation(
    async (key: string) => redisMock.state.metas[key] ?? {},
  )
  redisMock.llen.mockImplementation(async (key: string) => redisMock.state.lines[key] ?? 0)
  // pipeline:按登记顺序批量返回,模拟真实 ioredis exec 的 [err, value][] 形状
  redisMock.pipeline.mockImplementation(() => {
    const ops: Array<{ type: 'hgetall' | 'llen'; key: string }> = []
    const pipe = {
      hgetall(key: string) {
        ops.push({ type: 'hgetall', key })
        return pipe
      },
      llen(key: string) {
        ops.push({ type: 'llen', key })
        return pipe
      },
      async exec() {
        const replies: Array<[Error | null, unknown]> = []
        for (const op of ops) {
          const value =
            op.type === 'hgetall'
              ? (redisMock.state.metas[op.key] ?? {})
              : (redisMock.state.lines[op.key] ?? 0)
          replies.push([null, value])
        }
        return replies
      },
    }
    return pipe
  })
})

describe('F-52 终端历史列表分页(服务层)', () => {
  it('默认 limit=20,优先走 ZSET 索引,且用 pipeline 批量读取', async () => {
    seedIndexedHistory(USER, 25)

    const page = await listHistorySessions(USER)

    expect(page.sessions).toHaveLength(20)
    expect(page.nextCursor).toBe('20')
    // 多取 1 条用于判断是否有下一页
    expect(redisMock.zrevrange).toHaveBeenCalledWith(INDEX_KEY, 0, 20)
    expect(redisMock.zcard).toHaveBeenCalledWith(INDEX_KEY)
    // 不再全库 SCAN,也不再逐条 hgetall/llen
    expect(redisMock.scan).not.toHaveBeenCalled()
    expect(redisMock.hgetall).not.toHaveBeenCalled()
    expect(redisMock.llen).not.toHaveBeenCalled()
    expect(redisMock.pipeline).toHaveBeenCalledTimes(1)
    // 既有响应字段保持不变
    expect(page.sessions[0]).toMatchObject({
      id: 's1',
      shell: '/bin/bash',
      kind: 'local',
      cwd: '/tmp',
      scrollbackLines: 3,
    })
  })

  it('limit 超过 100 直接拒绝(400),不触达 Redis', async () => {
    await expect(listHistorySessions(USER, { limit: 101 })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'invalid_history_pagination',
    })
    expect(redisMock.zcard).not.toHaveBeenCalled()
    expect(redisMock.zrevrange).not.toHaveBeenCalled()
  })

  it('limit=100 为允许的上限边界', async () => {
    seedIndexedHistory(USER, 150)

    const page = await listHistorySessions(USER, { limit: 100 })

    expect(page.sessions).toHaveLength(100)
    expect(page.nextCursor).toBe('100')
    expect(redisMock.zrevrange).toHaveBeenCalledWith(INDEX_KEY, 0, 100)
  })

  it('cursor 分页取第二页,末页 nextCursor 为 null', async () => {
    seedIndexedHistory(USER, 25)

    const page = await listHistorySessions(USER, { limit: 20, cursor: '20' })

    expect(page.sessions).toHaveLength(5)
    expect(page.sessions.map((s) => s.id)).toEqual(['s21', 's22', 's23', 's24', 's25'])
    expect(page.nextCursor).toBeNull()
    expect(redisMock.zrevrange).toHaveBeenCalledWith(INDEX_KEY, 20, 40)
    expect(redisMock.scan).not.toHaveBeenCalled()
  })

  it('非法 cursor 直接拒绝(400)', async () => {
    await expect(listHistorySessions(USER, { cursor: 'abc' })).rejects.toMatchObject({
      statusCode: 400,
      errorCode: 'invalid_history_pagination',
    })
    expect(redisMock.zcard).not.toHaveBeenCalled()
  })

  it('索引命中但仍按 hash 内 userId 过滤(TTL 残留/他人条目不外泄)', async () => {
    seedIndexedHistory(USER, 3, 'u2')

    const page = await listHistorySessions(USER)

    expect(page.sessions.map((s) => s.id)).toEqual(['s2', 's3'])
    expect(page.nextCursor).toBeNull()
  })

  it('无索引时退化 SCAN:pipeline 批量读取且命中 offset+limit+1 条即停', async () => {
    const keys = legacyKeys('legacy', 100)
    seedMetas(keys, USER)
    installScanBatches([keys])

    const page = await listHistorySessions(USER)

    expect(page.sessions).toHaveLength(20)
    expect(page.nextCursor).toBe('20')
    expect(redisMock.scan).toHaveBeenCalledTimes(1)
    expect(redisMock.scan).toHaveBeenCalledWith('0', 'MATCH', 'terminal:session:*', 'COUNT', 100)
    expect(redisMock.pipeline).toHaveBeenCalledTimes(1)
    expect(redisMock.hgetall).not.toHaveBeenCalled()
    expect(redisMock.llen).not.toHaveBeenCalled()
  })

  it('退化扫描有硬上限:全是他人会话时最多扫 1000 个 key 即停', async () => {
    const batches = Array.from({ length: 12 }, (_, b) => {
      const keys = legacyKeys(`other${b}-`, 100)
      seedMetas(keys, 'u2')
      return keys
    })
    installScanBatches(batches)

    const page = await listHistorySessions(USER)

    expect(page.sessions).toEqual([])
    expect(page.nextCursor).toBeNull()
    expect(redisMock.scan).toHaveBeenCalledTimes(10)
    expect(redisMock.pipeline).toHaveBeenCalledTimes(10)
  })
})

describe('F-52 终端历史列表分页(路由层)', () => {
  const server: FastifyInstance = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(terminalRoutes, { prefix: '/api' })
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  it('GET /api/terminal/sessions/history 默认 20 条并返回 nextCursor', async () => {
    seedIndexedHistory(USER, 25)

    const res = await server.inject({ method: 'GET', url: '/api/terminal/sessions/history' })

    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      data: { sessions: Array<{ id: string }>; nextCursor: string | null }
    }
    expect(body.data.sessions).toHaveLength(20)
    expect(body.data.nextCursor).toBe('20')
    expect(redisMock.scan).not.toHaveBeenCalled()
  })

  it('GET /api/terminal/sessions/history?limit=101 返回 400 且不触达 Redis', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/terminal/sessions/history?limit=101',
    })

    expect(res.statusCode).toBe(400)
    expect(redisMock.zcard).not.toHaveBeenCalled()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
