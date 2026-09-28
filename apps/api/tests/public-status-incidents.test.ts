// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 本仓库以 Apache-2.0 授权分发，须保留本声明与 LICENSE / NOTICE。

// 公开状态页 incidents 端点回归(2026-09-28 立)。
//
// 病灶:postgres-js 在 `min(created_at)` 这类聚合列上返回的**不是 Date**,
// `r.startedAt.toISOString()` 抛 TypeError → 被外层 catch 吞成「200 + 空数组」,
// 状态页从 2026-09-13 起永远显示"无故障"(生产日志可查)。
// 本文件锁两件事:① 时间列归一化对 Date / string / number 三形态都给合法 ISO;
// ② 降级必须显式(degraded:true),不得再用裸空数组冒充"一切正常"。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Mock config:路由链上的 src/db/index.js 虽已被替换,config 仍可能被其他传递依赖加载,
// 统一给一份假配置,避免 env 校验触发 process.exit(1)。
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgres://localhost:8810/ihui_test',
    REDIS_URL: 'redis://localhost:8811',
  },
}))

// 共享状态必须放在 vi.hoisted 里:vi.mock 工厂在测试文件**体**执行之前就会被调用。
const h = vi.hoisted(() => ({
  /** 每次 dbRead.select(...) 收到的列描述符,用于锁住 SQL 形态(根因回归) */
  selectConfigs: [] as Record<string, unknown>[],
  /** 当前查询实现:resolve 给行,或 reject 模拟库不可用 */
  impl: { run: null as null | (() => Promise<unknown>) },
}))

// 链式 mock:dbRead.select().from().where().groupBy().orderBy().limit() 最终 await 走 h.impl.run
function createChainableMock() {
  const make = (): Record<string, unknown> =>
    new Proxy({} as Record<string, unknown>, {
      get(_target, prop: string) {
        if (prop === 'then') {
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => {
            const run = h.impl.run ?? (async () => [])
            run().then(resolve, reject)
          }
        }
        return (...args: unknown[]) => {
          if (prop === 'select' && args[0] && typeof args[0] === 'object') {
            h.selectConfigs.push(args[0] as Record<string, unknown>)
          }
          return make()
        }
      },
    })
  return make()
}

vi.mock('../src/db/index.js', () => ({
  db: createChainableMock(),
  dbRead: createChainableMock(),
  dbClient: {},
}))

import publicStatusRoutes, {
  mapIncidentRows,
  type IncidentRow,
} from '../src/routes/public-status.js'

// ===== 辅助:把 drizzle SQL 片段摊平成文本,断言"聚合列确实被显式转了 UTC ISO 文本" =====
// drizzle 0.45 的片段形态:SQL { queryChunks: [...] },文本装在 StringChunk { value: string[] }
// (构造器把非数组值包成一位数组),嵌套片段是 SQL { queryChunks }。
// 只认裸字符串会摊平成 '' —— 断言于是退化成"永远红"却看着像"没匹配上"。
function collectSqlText(chunk: unknown): string[] {
  if (typeof chunk === 'string') return [chunk]
  if (!chunk || typeof chunk !== 'object') return []
  if ('queryChunks' in chunk) {
    const nested = (chunk as { queryChunks: unknown[] }).queryChunks
    if (Array.isArray(nested)) return nested.flatMap(collectSqlText)
  }
  const value = (chunk as { value?: unknown }).value
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  return []
}

function sqlTextOf(fragment: unknown): string {
  return collectSqlText(fragment).join('')
}

const ISO_UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

/**
 * 生产实测形态:drizzle 经 dbRead 给出的聚合列**不是 Date**(svc-api 日志里的
 * `r.startedAt.toISOString is not a function` 即证据)。而同一张表用裸 postgres-js
 * 直连探针量到的却是 Date —— 形态随连接/协议路径而变,所以 Date/string/number 三种
 * 都必须能吃,而不是赌其中一种。
 */
function rowWithTimestamps(overrides: Partial<IncidentRow> = {}): IncidentRow {
  return {
    providerCode: 'openai',
    date: '2026-09-13',
    startedAt: '2026-09-12T18:54:03Z',
    resolvedAt: '2026-09-13T15:50:07Z',
    errorCount: 24,
    latestModel: 'gpt-5-mini',
    ...overrides,
  }
}

describe('status incidents — 时间列归一化(mapIncidentRows)', () => {
  it('① 字符串形态(生产故障复现)→ 合法 ISO 串,而不是抛 toISOString is not a function', () => {
    const [incident] = mapIncidentRows([rowWithTimestamps()])
    expect(incident).toBeDefined()
    expect(incident?.startedAt).toBe('2026-09-12T18:54:03.000Z')
    expect(incident?.resolvedAt).toBe('2026-09-13T15:50:07.000Z')
    expect(ISO_UTC.test(incident?.startedAt ?? '')).toBe(true)
    expect(incident?.id).toBe('incident-openai-2026-09-13')
    expect(incident?.severity).toBe('critical')
  })

  it('② Date 形态仍然可用(不得为修 string 而把 Date 判坏)', () => {
    const rows = [
      rowWithTimestamps({
        startedAt: new Date('2026-09-12T18:54:03Z'),
        resolvedAt: new Date('2026-09-13T15:50:07Z'),
      }),
    ]
    expect(mapIncidentRows(rows)[0]?.startedAt).toBe('2026-09-12T18:54:03.000Z')
    expect(mapIncidentRows(rows)[0]?.resolvedAt).toBe('2026-09-13T15:50:07.000Z')
  })

  it('③ epoch 毫秒形态同样收敛到 ISO', () => {
    const rows = [rowWithTimestamps({ startedAt: Date.parse('2026-09-12T18:54:03Z') })]
    expect(mapIncidentRows(rows)[0]?.startedAt).toBe('2026-09-12T18:54:03.000Z')
  })

  it('④ 可空列保持 null(resolvedAt 为空 ≠ 异常)', () => {
    expect(mapIncidentRows([rowWithTimestamps({ resolvedAt: null })])[0]?.resolvedAt).toBeNull()
  })

  it('⑤ 反向对照:解析不出来的时间必须抛,绝不产出 "Invalid Date"', () => {
    expect(() => mapIncidentRows([rowWithTimestamps({ startedAt: '不是时间' })])).toThrow(TypeError)
    const bad = (() => {
      try {
        return mapIncidentRows([rowWithTimestamps({ startedAt: '不是时间' })])[0]?.startedAt
      } catch {
        return 'THREW'
      }
    })()
    expect(bad).toBe('THREW')
    expect(bad).not.toBe('Invalid Date')
  })

  it('⑥ 文本列同档:dayCol 给出非字符串时不得被模板串蒙混成 "[object Object]"', () => {
    const lying = rowWithTimestamps({ date: 20260913 as unknown as string })
    expect(() => mapIncidentRows([lying])).toThrow(TypeError)
  })
})

describe('GET /api/public/status/incidents', () => {
  let app: FastifyInstance

  function makeFakeRedis() {
    const store = new Map<string, string>()
    return {
      async get(key: string) {
        return store.get(key) ?? null
      },
      async set(key: string, value: string) {
        store.set(key, value)
        return 'OK'
      },
      async ping() {
        return 'PONG'
      },
    }
  }

  beforeEach(async () => {
    h.selectConfigs.length = 0
    h.impl.run = null
    app = Fastify({ logger: false })
    // 用 string 通道 decorate 假 redis(与 src/plugins/redis.ts 的装饰签名对齐)
    const decorable = app as unknown as { decorate(name: string, value: unknown): void }
    decorable.decorate('redis', makeFakeRedis())
    await app.register(publicStatusRoutes, { prefix: '/api/public' })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
  })

  async function getIncidents() {
    const res = await app.inject({ method: 'GET', url: '/api/public/status/incidents' })
    return {
      status: res.statusCode,
      body: res.json() as { code: number; message: string; data: unknown },
    }
  }

  it('正常路径:真实数据产出条目,startedAt/resolvedAt 均为 ISO 串,degraded=false', async () => {
    h.impl.run = async () => [
      rowWithTimestamps(),
      rowWithTimestamps({
        providerCode: 'zhipu',
        date: '2026-09-13',
        startedAt: '2026-09-12T18:30:20Z',
        resolvedAt: '2026-09-12T18:43:20Z',
        errorCount: 4,
        latestModel: null,
      }),
    ]
    const { status, body } = await getIncidents()
    expect(status).toBe(200)
    expect(body.code).toBe(0)
    const data = body.data as { incidents: unknown[]; degraded: boolean }
    expect(data.degraded).toBe(false)
    expect(data.incidents).toHaveLength(2)
    const first = data.incidents[0] as {
      startedAt: string
      resolvedAt: string
      modelId: string | null
    }
    expect(ISO_UTC.test(first.startedAt)).toBe(true)
    expect(ISO_UTC.test(first.resolvedAt)).toBe(true)
    expect(first.modelId).toBe('gpt-5-mini')
  })

  it('根因回归:SQL 侧聚合列必须显式转 UTC ISO 文本(退回裸 min() 即红)', async () => {
    h.impl.run = async () => []
    await getIncidents()
    const columns = h.selectConfigs.at(-1)
    expect(columns).toBeDefined()
    for (const column of ['startedAt', 'resolvedAt']) {
      const text = sqlTextOf(columns?.[column])
      // 摊平本身要先成立:text 为空说明片段形态又变了,断言会退化成"永远红"
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('to_char')
      expect(text).toContain(`AT TIME ZONE 'UTC'`)
      expect(text).toContain(column === 'startedAt' ? 'min(' : 'max(')
    }
  })

  it('降级可见:查询失败时 degraded=true,且不再是读起来像"一切正常"的裸空数组', async () => {
    h.impl.run = async () => {
      throw new Error('column llm_call_logs.provider_code does not exist')
    }
    const { status, body } = await getIncidents()
    // 刻意保留 200(状态页整体可用性),但响应体必须能自证"这次是降级"
    expect(status).toBe(200)
    const data = body.data as { incidents: unknown[]; degraded?: boolean }
    expect(data.degraded).toBe(true)
    expect(data.incidents).toEqual([])
    expect(Object.keys(data)).toContain('degraded')
    // 反向:裸 { incidents: [] } 这种形态(无 degraded 键)就是本缺陷的原样
    expect('degraded' in data).toBe(true)
  })

  it('成对对照:确实没有事件时 degraded=false —— 与降级必须可区分', async () => {
    h.impl.run = async () => []
    const { status, body } = await getIncidents()
    expect(status).toBe(200)
    const data = body.data as { incidents: unknown[]; degraded: boolean }
    expect(data.incidents).toEqual([])
    expect(data.degraded).toBe(false)
  })

  it('驱动又给出无法解析的形态时,同样走可见降级而不是把 Invalid Date 交给前端', async () => {
    h.impl.run = async () => [rowWithTimestamps({ startedAt: '' })]
    const { status, body } = await getIncidents()
    expect(status).toBe(200)
    const data = body.data as { incidents: unknown[]; degraded: boolean }
    expect(data.degraded).toBe(true)
    expect(data.incidents).toEqual([])
  })
})
