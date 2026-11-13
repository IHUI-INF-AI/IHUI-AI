// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-217 回归锁(2026-11-13)。
 *
 * 病灶:outbox 取任务用 `select ... where status='pending'` 后直接 dispatch,再按 id 无条件
 * `set({status:'processed', attempts: event.attempts + 1})` —— 多实例(N 个 onReady 扫描 +
 * BullMQ 周期任务)并发时同一批事件被重复投递;attempts 用读到的快照 +1,并发覆盖会丢更新
 * (事件永远到不了 failed 阈值)。
 *
 * 本文件锁:
 *   ① 认领是单语句 `UPDATE ... FOR UPDATE SKIP LOCKED ... RETURNING`,两个实例并发认领同一批
 *     时每条只被一个实例拿到(第二个实例的 SKIP LOCKED 子查询只能跳过,拿到空批);
 *   ② 完成/失败回写带所有权判据(id + status='processing' + 认领时刻),非持有者命中 0 行不计数;
 *   ③ attempts 是 SQL 原子自增表达式(`attempts + 1`),不是读改写的快照;
 *   ④ 正常投递成功仍如实标记 processed。
 *
 * 只 mock db(execute / update),用真实 @ihui/database schema 渲染 SQL 文本断言,不触达真实 PG。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { OutboxEvent } from '@ihui/database'

const { mockExecute, mockUpdate } = vi.hoisted(() => ({
  mockExecute: vi.fn(),
  mockUpdate: vi.fn(),
}))

vi.mock('../src/db/index.js', () => ({
  db: {
    execute: mockExecute,
    update: mockUpdate,
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}))

import { processOutbox, type OutboxDispatcher } from '../src/utils/outbox.js'

const dialect = new PgDialect()

/** drizzle SQL 对象 → { sql, params }(断言 SQL 文本与绑定参数的唯一口径)。 */
function toQuery(value: unknown) {
  return dialect.sqlToQuery(value as Parameters<PgDialect['sqlToQuery']>[0])
}

/** 构造认领语句 RETURNING 出来的行(camelCase 与 OutboxEvent 对齐)。 */
function makeClaimedRow(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    id: 'evt-1',
    type: 'order.created',
    payload: { orderId: 'o1' },
    status: 'processing',
    attempts: 0,
    lastError: null,
    lastAttemptAt: new Date('2026-11-13T00:00:00.000Z'),
    createdAt: new Date('2026-11-13T00:00:00.000Z'),
    processedAt: null,
    ...overrides,
  }
}

/** 配置 update→set→where→returning 链;rows=[] 模拟"非持有者命中 0 行"。 */
function mockUpdateChain(rows: Array<{ id: string }>) {
  const returning = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ returning })
  const set = vi.fn().mockReturnValue({ where })
  mockUpdate.mockReturnValue({ set })
  return { set, where, returning }
}

describe('F-217 outbox 原子认领', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('① 两实例并发认领同一批:每条只被一个实例拿到,无重复投递', async () => {
    const rows = [makeClaimedRow({ id: 'e1' }), makeClaimedRow({ id: 'e2' })]
    // 第一个实例整批认领(持有行锁),第二个实例的 SKIP LOCKED 子查询只能跳过 → 空批
    mockExecute.mockResolvedValueOnce(rows).mockResolvedValueOnce([])
    mockUpdateChain([{ id: 'e1' }, { id: 'e2' }])

    const dispatched: string[] = []
    const dispatcher: OutboxDispatcher = {
      dispatch: vi.fn(async (event: OutboxEvent) => {
        dispatched.push(event.id)
        await Promise.resolve()
      }),
    }

    const [first, second] = await Promise.all([
      processOutbox(dispatcher),
      processOutbox(dispatcher),
    ])

    expect(first.processed).toBe(2)
    expect(second.processed).toBe(0)
    // 两条各投递一次,没有一条被两个实例同时投递
    expect(dispatched.sort()).toEqual(['e1', 'e2'])
    expect(new Set(dispatched).size).toBe(2)

    // 认领是单语句:UPDATE + 子查询 FOR UPDATE SKIP LOCKED + RETURNING
    const claim = toQuery(mockExecute.mock.calls[0]![0])
    expect(claim.sql).toMatch(/UPDATE outbox_events\s+SET status = 'processing'/)
    expect(claim.sql).toContain('FOR UPDATE SKIP LOCKED')
    expect(claim.sql).toContain('RETURNING')
  })

  it('② 回写按 (id, status, 认领时刻) 判主:非持有者命中 0 行且不计数', async () => {
    mockExecute.mockResolvedValue([makeClaimedRow({ id: 'e1' })])
    const chain = mockUpdateChain([]) // 非持有者:UPDATE 命中 0 行

    const result = await processOutbox({
      dispatch: vi.fn().mockResolvedValue(undefined),
    })

    expect(result.processed).toBe(0)
    expect(result.failed).toBe(0)
    expect(chain.where).toHaveBeenCalledTimes(1)

    const fence = toQuery(chain.where.mock.calls[0]![0])
    expect(fence.sql).toContain('"outbox_events"."id" =')
    expect(fence.sql).toContain('"outbox_events"."status" =')
    expect(fence.sql).toContain('"outbox_events"."last_attempt_at" =')
    expect(fence.params).toContain('processing')

    // 判主用的认领时刻 = 认领语句写入的同一时刻(所有权标记)
    const claimParams = toQuery(mockExecute.mock.calls[0]![0]).params
    const fenceStamp = fence.params.filter((p) => typeof p === 'string').at(-1)
    expect(fenceStamp).toBe(claimParams[0])
  })

  it('③ attempts 是 SQL 原子自增表达式,不是读改写快照', async () => {
    // 成功路径
    mockExecute.mockResolvedValue([makeClaimedRow({ id: 'e1', attempts: 2 })])
    const successChain = mockUpdateChain([{ id: 'e1' }])
    await processOutbox({ dispatch: vi.fn().mockResolvedValue(undefined) })

    const successSet = successChain.set.mock.calls[0]![0]
    expect(typeof successSet.attempts).not.toBe('number')
    expect(toQuery(successSet.attempts).sql).toBe('"outbox_events"."attempts" + 1')

    // 失败路径(未达阈值退回 pending)同样原子,且 attempts 不被快照值覆盖
    vi.clearAllMocks()
    mockExecute.mockResolvedValue([makeClaimedRow({ id: 'e2', attempts: 1 })])
    const failChain = mockUpdateChain([{ id: 'e2' }])
    await processOutbox({ dispatch: vi.fn().mockRejectedValue(new Error('send fail')) })

    const failSet = failChain.set.mock.calls[0]![0]
    expect(failSet.status).toBe('pending')
    expect(toQuery(failSet.attempts).sql).toBe('"outbox_events"."attempts" + 1')
  })

  it('④ 正常投递成功仍标记 processed 并写 processedAt', async () => {
    mockExecute.mockResolvedValue([makeClaimedRow({ id: 'e1' })])
    const chain = mockUpdateChain([{ id: 'e1' }])
    const dispatch = vi.fn().mockResolvedValue(undefined)

    const result = await processOutbox({ dispatch })

    expect(result).toEqual({ processed: 1, failed: 0 })
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch.mock.calls[0]![0]).toMatchObject({ id: 'e1', type: 'order.created' })

    const setArgs = chain.set.mock.calls[0]![0]
    expect(setArgs.status).toBe('processed')
    expect(setArgs.processedAt).toBeInstanceOf(Date)
    expect(setArgs.lastAttemptAt).toBeInstanceOf(Date)
  })
})
