// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * GET /api/earnings/funnel 契约锁(2026-11-01 立,伴生改动:摘除假路由
 * /api/admin/monitor/funnel/:id,admin 漏斗页改读本端点)。
 *
 * 为什么要有这一档:消费方(apps/web 的 /admin/monitor/funnel 页与 /earnings 页)都在
 * 「返回 4 档、顺序即漏斗顺序、count 是数值」这三条假设上做投影与渲染,而这三条假设
 * 在仓里此前没有任何测试钉住 —— 后端改档位名/改顺序/把 count 变成字符串,前端只会静默错。
 *
 * 判据来源:apps/api/src/routes/earnings-routes.ts 的 GET /funnel handler(纯 mock dbRead)。
 * 档位码期望值 ['register','active','byok','vip'] 是本档要钉的**契约**,不是从源脚本复制的
 * 判据常量(源码侧只有 `type ConversionStageCode`,无可 import 的运行期常量,§22c 不适用)。
 *
 * 测试隔离(AGENTS.md §5):vi.mock 掉 db/dbRead/authenticate,不连生产库(PG 8810 / Redis 8811),
 * 全程零网络零 SQL;若哪天该端点只能连真库才测得通,这一档会因 mock 断言失败而暴露,不会静默放行。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { earningsRoutes } from '../src/routes/earnings-routes.js'
import { monitorRoutes } from '../src/routes/admin-extended/monitor-routes.js'

// mock authenticate(避免触发 JWT 解析;no-op 保留 request.jwtPayload,供真实 requireAdmin 判定)
const { mockAuthenticate } = vi.hoisted(() => ({
  mockAuthenticate: vi.fn(async () => {
    /* no-op */
  }),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mockAuthenticate,
}))

// mock dbRead.execute(返回数组,handler 里用 [row] 解构第一行)
const { mockDbReadExecute } = vi.hoisted(() => ({
  mockDbReadExecute: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {},
  dbRead: {
    execute: mockDbReadExecute,
  },
  dbClient: {},
}))

type Handler = (req: FastifyRequest, reply: FastifyReply) => Promise<unknown>

/**
 * 记录 handler 的最小 Fastify 替身:同时吃 2 参(server.get(path, handler))与
 * 3 参(server.get(path, opts, handler))两种签名 ⇒ 取「最后一个函数实参」当 handler。
 */
function buildMockServer(): { server: FastifyInstance; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>()
  const record = (method: string) =>
    vi.fn((path: string, ...rest: unknown[]) => {
      const fn = [...rest].reverse().find((a) => typeof a === 'function')
      handlers.set(`${method} ${path}`, fn as Handler)
    })
  const server = {
    get: record('GET'),
    post: record('POST'),
    put: record('PUT'),
    delete: record('DELETE'),
    addHook: vi.fn(),
  } as unknown as FastifyInstance
  return { server, handlers }
}

function makeRequest(roleId = 1): FastifyRequest {
  return {
    query: {},
    headers: {},
    method: 'GET',
    url: '/api/earnings/funnel',
    params: {},
    body: {},
    userId: 'user-admin-1',
    jwtPayload: { roleId },
    log: { error: vi.fn() },
  } as unknown as FastifyRequest
}

function makeReply(): FastifyReply & { sentPayload: unknown; sentStatus: number } {
  let sentPayload: unknown = undefined
  let sentStatus = 200
  const reply = {
    status: vi.fn((code: number) => {
      sentStatus = code
      return reply
    }),
    send: vi.fn((payload: unknown) => {
      sentPayload = payload
      return reply
    }),
    header: vi.fn(() => reply),
    get sentPayload() {
      return sentPayload
    },
    get sentStatus() {
      return sentStatus
    },
  } as unknown as FastifyReply & { sentPayload: unknown; sentStatus: number }
  return reply
}

interface FunnelPayload {
  code: number
  data: Array<{ stage: string; count: unknown }>
}

/** 驱动真 handler,取出响应体里的 stage 序列。 */
async function driveFunnel(sqlRow: Record<string, string | number | null>): Promise<FunnelPayload> {
  const { server, handlers } = buildMockServer()
  await earningsRoutes(server)
  const handler = handlers.get('GET /funnel')
  if (!handler) throw new Error('GET /funnel 未注册')
  mockDbReadExecute.mockResolvedValueOnce([sqlRow])
  const reply = makeReply()
  await handler(makeRequest(), reply)
  return reply.sentPayload as FunnelPayload
}

/** 漏斗的定义性性质:count 单调不增。 */
function isNonIncreasing(counts: number[]): boolean {
  return counts.every((c, i) => i === 0 || counts[i - 1] === undefined || counts[i - 1] >= c)
}

describe('GET /api/earnings/funnel 契约', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('① 档位:长度恰为 4,stage 集合等于 [register, active, byok, vip](顺序即漏斗顺序)', async () => {
    const payload = await driveFunnel({
      register_count: '23',
      active_count: '2',
      byok_count: '1',
      vip_count: '0',
    })

    expect(payload.code).toBe(0)
    expect(Array.isArray(payload.data)).toBe(true)
    expect(payload.data).toHaveLength(4)
    expect(payload.data.map((d) => d.stage)).toEqual(['register', 'active', 'byok', 'vip'])
  })

  it('①b 端点前缀:注册在 /api/earnings 下 ⇒ 对外全名 GET /api/earnings/funnel', async () => {
    const { server } = buildMockServer()
    await earningsRoutes(server)
    // 插件内相对路径必须是 '/funnel'(不带前缀),全名由承载层拼出
    expect(server.get).toHaveBeenCalledWith('/funnel', expect.any(Function))

    // 承载层登记唯一出口 = apps/api/src/routes/index.ts,前缀写死在此钉住
    const indexPath = fileURLToPath(new URL('../src/routes/index.ts', import.meta.url))
    const source = readFileSync(indexPath, 'utf8')
    expect(source).toContain("server.register(earningsRoutes, { prefix: '/api/earnings' })")
  })

  it('③ 类型:每个 count 都是 number(不是 Postgres 的 string),否则前端 .toFixed() 当场炸', async () => {
    const payload = await driveFunnel({
      register_count: '230',
      active_count: '145',
      byok_count: '42',
      vip_count: '9',
    })

    for (const stage of payload.data) {
      expect(typeof stage.count).toBe('number')
      expect(Number.isFinite(stage.count as number)).toBe(true)
    }
    expect(payload.data.map((d) => d.count)).toEqual([230, 145, 42, 9])
  })

  it('③b NULL 兜底:SQL 返回 NULL 时 count 落 0(number),不落 null/NaN', async () => {
    const payload = await driveFunnel({
      register_count: null,
      active_count: null,
      byok_count: null,
      vip_count: null,
    })
    // handler 的 `row?.x ?? 0` 是 NaN 的第二条来路:一旦这一兜底被摘掉,下游就是 null/NaN
    for (const stage of payload.data) {
      expect(typeof stage.count).toBe('number')
      expect(stage.count).toBe(0)
    }
  })

  // ===========================================================================
  // ② 单调不增 —— 如实记录实测结论:后端**没有任何**保证,handler 原样透传 SQL 结果
  // ===========================================================================

  it('② 正常形态:SQL 给出口径单调不增时,响应保持单调不增(消费方投影的前提)', async () => {
    const payload = await driveFunnel({
      register_count: '23',
      active_count: '2',
      byok_count: '1',
      vip_count: '0',
    })
    const counts = payload.data.map((d) => d.count as number)
    expect(isNonIncreasing(counts)).toBe(true)
  })

  it('②b 实测结论(阳性对照):喂一组非单调的 SQL 结果,handler 不夹紧、不排序、不报错 ⇒ 该性质无服务端守门', async () => {
    // 现实可发生:register=COUNT(*) FROM users 与 active=COUNT(DISTINCT user_id) FROM llm_call_logs
    // 来自两张表,没有任何外键/约束保证 register ≥ active;vip 档与 byok 档更是互不可比。
    const payload = await driveFunnel({
      register_count: '1',
      active_count: '5',
      byok_count: '3',
      vip_count: '7',
    })
    const counts = payload.data.map((d) => d.count as number)
    // 原样透传(既不夹紧成前档的上限,也不按大小重排)
    expect(counts).toEqual([1, 5, 3, 7])
    // 漏斗的定义性断言在这一组输入上**不成立** —— 本条钉的是"后端不管这件事"这一事实,
    // 不是"漏斗可以不单调"。修法(需改判据面,不在本票射程):在 handler 里对 SQL 结果取
    // running-min,或把口径改成同一张事件表的累计去重计数。
    expect(isNonIncreasing(counts)).toBe(false)
  })

  it('②c 结构性事实:SQL 只蕴含 byok ≤ active 与 vip ≤ register,不蕴含整链单调', () => {
    // 直接读源文件的四条子查询,钉住"蕴含关系从哪来"这件事,防止日后改写口径时误以为整链有保证
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/earnings-routes.ts', import.meta.url)),
      'utf8',
    )
    const registerQ = /\(SELECT COUNT\(\*\) FROM users\) AS register_count/.test(src)
    const activeQ = /\(SELECT COUNT\(DISTINCT user_id\) FROM llm_call_logs\) AS active_count/.test(
      src,
    )
    const byokQ =
      /\(SELECT COUNT\(DISTINCT user_id\) FROM llm_call_logs WHERE api_key_id IS NOT NULL[^)]*\) AS byok_count/.test(
        src,
      )
    const vipQ = /\(SELECT COUNT\(\*\) FROM users WHERE is_vip > 0\) AS vip_count/.test(src)
    expect({ registerQ, activeQ, byokQ, vipQ }).toEqual({
      registerQ: true,
      activeQ: true,
      byokQ: true,
      vipQ: true,
    })
    // byok 是 active 的加谓词子集 ⇒ byok ≤ active 成立;vip ⊆ users ⇒ vip ≤ register 成立;
    // 但 register ≥ active、byok ≥ vip 两侧都跨表/跨口径 ⇒ 无蕴含(见 ②b 的可构造反例)。
  })

  // ===========================================================================
  // 假路由不得回流:/admin/monitor/funnel/:id 把告警 id 当业务维度,已整条摘除
  // ===========================================================================

  it('④ 回归锁:monitorRoutes 不再注册任何 funnel 路由(占位假路由不得复活)', async () => {
    const { server, handlers } = buildMockServer()
    await monitorRoutes(server)

    const funnelPaths = [...handlers.keys()].filter((k) => /funnel/i.test(k))
    expect(funnelPaths).toEqual([])

    // 同批:契约产物 openapi.json 里也必须没有这条路径
    const openapi = JSON.parse(
      readFileSync(fileURLToPath(new URL('../openapi.json', import.meta.url)), 'utf8'),
    ) as { paths: Record<string, unknown> }
    expect(Object.keys(openapi.paths).filter((p) => /monitor\/funnel/.test(p))).toEqual([])
  })

  it('④b 同批:monitorRoutes 其余三条路由存续(摘一条不得顺手带走别个)', async () => {
    const { server, handlers } = buildMockServer()
    await monitorRoutes(server)
    expect([...handlers.keys()].sort()).toEqual([
      'GET /admin/monitor/redis',
      'GET /admin/monitoring/alerts',
      'POST /admin/monitor/alerts/:id/ack',
      'POST /admin/monitor/alerts/:id/resolve',
    ])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
