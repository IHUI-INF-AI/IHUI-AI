// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-815986(2026-09-30 立,不连库:mock db):**空集合参数必须在任何 IO 之前拒绝**。
 *
 * 缺陷形态(实测,不是假想):`DELETE /notice/:noticeIds` 旧写法把
 *   `noticeIds.split(',').filter(Boolean).map(Number).filter(!NaN)`
 * 的结果**原样**送进 `deleteNoticesBatch`。当参数是 `abc`(或全是非数字/纯逗号)时,归一后
 * 是**空数组**,而旧写法照样发出 `DELETE ... WHERE notice_id inArray([])`。
 * 实测 drizzle 把空 inArray 渲染成合法 SQL 里的 `false`(不是 `in ()`,所以既不报错也不回滚),
 * 于是这次请求:
 *   ① 为一个根本不存在的目标付了一次写 round-trip(IO 发生了,而它本该不发生);
 *   ② 回 `deleted: 0` —— 与"确有目标、但一条都没命中"在账面上**完全同形**,
 *     调用方读不出"没做成"与"没目标"(上游同族措辞:"空 Set ⇒ filter 保留全部并静默成功,
 *     调用方无法区分『撤销全部』与『没有目标』")。
 *
 * 现口径:唯一出口 `apps/api/src/utils/batch-outcome.ts` 的 `guardBatchTargets()`(纯函数,
 * 不 import 任何存储层 ⇒ 结构上发不出查询),拒绝发生在 db.delete 之前。
 *
 * 用例设计(各守一格,互不重复):
 *   A 组 空入参 ⇒ 400 + errorCode,**并且断言一条查询都没发出**(deleteCalls/whereCalls 均为 0);
 *        A5 是同组的机制对照:空数组直接喂 db 层 ⇒ 查询照样发生,
 *        证明 A1 的"零查询"来自路由前的闸,而不是 mock 或 SQL 自己不会跑;
 *   B 组 两态不同形 ⇒ 「没有目标」与「有目标但 0 命中」的状态码与响应体都不得相等;
 *   C 组 非空 ⇒ 行为逐字不变(正向对照:证明 A 组的"没查"不是因为根本没接线);
 *   D 组 出口侧机制锁:`batchWriteOutcome` 空 requested 时**不得消费 confirmed**
 *      (传一个被迭代就举旗的生成器 ⇒ 旗不落),这是"出口不为没有目标的请求拉数据"的证明;
 *   E 组 纯函数三态:空/全空白/含重复,归一结果与既有 dedupeIds 语义逐字一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'

// Mock config 避免 env 校验触发 process.exit(1)(与既有 api 测试同形)
vi.mock('jose', () => ({ decodeJwt: () => ({}) }))
vi.mock('../src/config/index.js', () => ({
  config: {
    NODE_ENV: 'test',
    PORT: 8802,
    HOST: '0.0.0.0',
    LOG_LEVEL: 'silent',
    CORS_ORIGIN: 'http://localhost:8801',
    DATABASE_URL: 'postgres://localhost:5432/test',
    REDIS_URL: 'redis://localhost:6379',
    JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long!!!',
    JWT_EXPIRES_IN: '7d',
    AI_SERVICE_URL: 'http://localhost:8803',
  },
}))

const { deleteCalls, whereCalls, mockReturning } = vi.hoisted(() => ({
  /** db.delete(table) 的调用记录 —— 空入参必须一条都不进(判"未发出查询"的唯一依据) */
  deleteCalls: [] as string[],
  /** db.delete(...).where(cond) 的调用记录:连 where 都不该被构造出来 */
  whereCalls: [] as string[],
  /** .returning() 的返回 = 库确认真的被删掉的行 */
  mockReturning: vi.fn(async (): Promise<{ noticeId: number }[]> => []),
}))

/** drizzle 表对象在夹具里只用来留个可读名字,不需要真类型 ⇒ 只问 getTableName。 */
function tableNameOf(t: unknown): string {
  if (t && typeof t === 'object' && 'getTableName' in t) {
    const fn = (t as { getTableName?: () => string }).getTableName
    if (typeof fn === 'function') return fn.call(t)
  }
  return '<未知表>'
}

vi.mock('../src/db/index.js', () => ({
  db: {
    delete: vi.fn((t: unknown) => {
      deleteCalls.push(tableNameOf(t))
      return {
        where: vi.fn((cond: unknown) => {
          whereCalls.push(String(cond ?? ''))
          return { returning: mockReturning }
        }),
      }
    }),
    select: vi.fn(() => {
      const step: Record<string, unknown> = {}
      for (const m of ['from', 'where', 'orderBy', 'limit', 'offset']) {
        step[m] = vi.fn(() => step)
      }
      step.then = (resolve: (v: unknown) => void) => resolve([])
      return step
    }),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn(),
  },
  dbRead: {},
  dbClient: {},
}))

import { noticeRoutes } from '../src/routes/admin-sys/notice-routes.js'
import { guardBatchTargets, batchWriteOutcome, EMPTY_BATCH_TARGET_CODE } from '../src/utils/batch-outcome.js'

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })
  await app.register(noticeRoutes, { prefix: '/ihui-test/notice' })
  await app.ready()
  return app
}

/** 打真实端点:路径参数原样送出(空集与有效 id 走同一条路,差异只能由判据产生)。 */
async function deleteNotice(param: string) {
  const app = await buildApp()
  const res = await app.inject({ method: 'DELETE', url: `/ihui-test/notice/${param}` })
  const body = res.json() as { code: number; message?: string; errorCode?: string; data?: Record<string, unknown> }
  await app.close()
  return { res, body }
}

beforeEach(() => {
  deleteCalls.length = 0
  whereCalls.length = 0
  mockReturning.mockReset()
  mockReturning.mockResolvedValue([])
})

describe('A 组:空集合在任何 IO 之前拒绝', () => {
  it('A1 参数全是非数字(归一后空数组)⇒ 400 + 机器可读码,且 delete/where 一次都没发生', async () => {
    const { res, body } = await deleteNotice('abc')
    expect(res.statusCode).toBe(400)
    expect(body.code).toBe(400)
    expect(body.errorCode).toBe(EMPTY_BATCH_TARGET_CODE)
    // 「未发出查询」的断言:只断言抛错会放过"先查了再抛"那一型(AGENTS 硬约束)
    expect(deleteCalls).toEqual([])
    expect(whereCalls).toEqual([])
    expect(mockReturning).not.toHaveBeenCalled()
  })

  it('A2 参数是 NaN 与空段混排(如 ",,")⇒ 同样拒在 IO 之前', async () => {
    const { res, body } = await deleteNotice(',,')
    expect(res.statusCode).toBe(400)
    expect(body.errorCode).toBe(EMPTY_BATCH_TARGET_CODE)
    expect(deleteCalls).toEqual([])
  })

  it('A3 措辞必须点名是哪个参数为空(否则调用方只能猜是哪一层把 id 吞了)', async () => {
    const { body } = await deleteNotice('abc')
    expect(body.message).toContain('noticeIds')
  })

  it('A4 唯一出口是纯函数:空数组 / 只有一个空串 / 全是空白 ⇒ 一律 ok:false', () => {
    const cases: Array<readonly string[]> = [[], [''], ['', '   ', '\t']]
    for (const input of cases) {
      const g = guardBatchTargets(input, 'x')
      expect(g.ok).toBe(false)
      if (!g.ok) expect(g.code).toBe(EMPTY_BATCH_TARGET_CODE)
    }
  })

  it('A5 机制对照(这门的存在理由):db 层本身不拒空 —— 空数组照样发出一条查询', async () => {
    // 直接把空数组喂给被路由调用的那同一个函数:delete/where/returning 全部发生。
    // 这一条证明 A1 的"零查询"是**路由前的闸**给的,而不是 mock 恰好看不见、
    // 也不是"库里那条 SQL 自己就不会跑"(实测 drizzle 把空 inArray 渲染成 `false`,
    // 语句合法、命中 0 行、回 deleted:0 —— 与"有目标但没命中"同形,正是本票要消灭的)。
    const { deleteNoticesBatch } = await import('../src/db/admin-sys-queries.js')
    const n = await deleteNoticesBatch([])
    expect(n).toBe(0)
    expect(deleteCalls.length).toBe(1)
    expect(whereCalls.length).toBe(1)
    expect(mockReturning).toHaveBeenCalledTimes(1)
  })
})

describe('B 组:两态不得同形', () => {
  it('B1 「没有目标」与「有目标但库里 0 命中」的状态码与响应体都必须不相等', async () => {
    const empty = await deleteNotice('abc')
    const noHit = await deleteNotice('123') // 有效 id,库里没有 ⇒ returning 空 ⇒ deleted:0
    expect(empty.res.statusCode).not.toBe(noHit.res.statusCode)
    expect(empty.body.code).not.toBe(noHit.body.code)
    // 「有目标但 0 命中」这一侧仍走既有契约(200 + deleted:0),而"没目标"绝不能长得像它
    expect(noHit.body).toEqual({ code: 0, message: 'success', data: { deleted: 0 } })
    expect(noHit.body.errorCode).toBeUndefined()
  })

  it('B2 正向对照:非空请求确实发出了一次查询(A 组的"没查"不是因为没接线)', async () => {
    mockReturning.mockResolvedValue([{ noticeId: 7 }])
    const { res, body } = await deleteNotice('7')
    expect(res.statusCode).toBe(200)
    expect(deleteCalls.length).toBe(1)
    expect(whereCalls.length).toBe(1)
    expect(body).toEqual({ code: 0, message: 'success', data: { deleted: 1 } })
  })

  it('B3 等价回归:重复 id 去重后仍是一次往返、响应形态逐字不变', async () => {
    mockReturning.mockResolvedValue([{ noticeId: 1 }, { noticeId: 2 }])
    const { res, body } = await deleteNotice('1,2,1')
    expect(res.statusCode).toBe(200)
    expect(deleteCalls.length).toBe(1)
    expect(body).toEqual({ code: 0, message: 'success', data: { deleted: 2 } })
  })

  it('B4 部分有效(1,abc)⇒ 按"有目标"走原路径,不因半个坏值整批拒', async () => {
    mockReturning.mockResolvedValue([{ noticeId: 1 }])
    const { res, body } = await deleteNotice('1,abc')
    expect(res.statusCode).toBe(200)
    expect(deleteCalls.length).toBe(1)
    expect(body.data).toEqual({ deleted: 1 })
  })
})

describe('D/E 组:出口侧的机制锁(不得为没有目标的请求去消费 confirmed)', () => {
  it('D1 空 requested ⇒ batchWriteOutcome 不得迭代 confirmed(传一个被迭代就举旗的生成器)', () => {
    let consumed = false
    const flagging = (function* gen(): Generator<string> {
      consumed = true
      yield 'a'
    })()
    const r = batchWriteOutcome([], flagging)
    expect(consumed).toBe(false)
    expect(r).toEqual({ requestedIds: [], affected: 0, missedIds: [] })
  })

  it('D2 非空 requested ⇒ 必须真去消费 confirmed(反向对照:D1 不是"永远不迭代")', () => {
    let consumed = false
    const flagging = (function* gen(): Generator<string> {
      consumed = true
      yield 'a'
    })()
    const r = batchWriteOutcome(['a', 'b'], flagging)
    expect(consumed).toBe(true)
    expect(r).toEqual({ requestedIds: ['a', 'b'], affected: 1, missedIds: ['b'] })
  })

  it('E1 guardBatchTargets 的归一语义与 dedupeIds 逐字一致(去空白 + 去重 + 保序)', () => {
    const g = guardBatchTargets(['a', 'a', '', 'b', '  '], 'ids')
    expect(g.ok).toBe(true)
    if (g.ok) expect(g.ids).toEqual(['a', 'b'])
    const n = guardBatchTargets([2, 2, 1], 'ids')
    expect(n.ok).toBe(true)
    if (n.ok) expect(n.ids).toEqual([2, 1])
  })

  it('E2 拒与放行两态互斥:同一份输入不可能既 ok:true 又带 code', () => {
    const g = guardBatchTargets([1], 'ids')
    expect(g.ok).toBe(true)
    if (g.ok) expect('code' in g).toBe(false)
    const e = guardBatchTargets([], 'ids')
    expect(e.ok).toBe(false)
    if (!e.ok) expect('ids' in e).toBe(false)
  })

  it('E3 边界如实登记:闸只判"归一后有没有目标",值的合法性仍归各端点校验', () => {
    // NaN / 非 UUID 这类"有形状但没有意义"的值**不算空**,本闸故意不替端点做值校验 ——
    // 那会造出第二份校验层(与 registerCrud 的 UUID 校验、route 侧的 !Number.isNaN 过滤撞车)。
    // 记录这一格,是为了下一个人不把"闸放过了 NaN"当成 bug 去闸里加判断。
    const g = guardBatchTargets([Number.NaN], 'ids')
    expect(g.ok).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
