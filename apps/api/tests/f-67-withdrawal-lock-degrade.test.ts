// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-67 回归锁(docs/tickets/2026-11/findings-api.md#F-67)。
 *
 * 缺陷:withLock 的 finally 把 release 异常抛给调用方,提现路由只按 statusCode 分流,
 * 凡无 statusCode 都当成「锁不可用 → 降级再跑一次 doApply()」;而 applyWithdrawal 已提交,
 * 第二次执行等于再插一笔提现并重复冻结(partnerTradeNo 服务端生成,客户端无幂等键)。
 *
 * 判据:
 *  - release 抛错 ⇒ 业务只执行一次,错误如实上抛(error 级留痕由路由负责);
 *  - 业务异常(有无 statusCode)一律原样上抛,绝不降级重跑;
 *  - acquire 失败(Redis 不可用)仍沿用既有降级语义;锁争用(423)仍原样拒绝;
 *  - 正常路径行为不变。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type { Redis } from 'ioredis'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const USER_ID = '44444444-4444-4444-8444-444444444444'
const APPLY_URL = '/api/finance/withdrawal/apply?amount=10000'
const FLOW = {
  id: 'wd-f67',
  userId: USER_ID,
  amount: 9800,
  fee: 200,
  originalAmount: 10000,
  status: 0,
  partnerTradeNo: 'WD1763000000000-f67',
}

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  stepUp: vi.fn(),
  evaluateRisk: vi.fn(),
  applyWithdrawal: vi.fn(),
  availableWithdrawal: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({ authenticate: mocks.authenticate }))

vi.mock('../src/plugins/require-permission.js', () => ({
  requireAdmin: vi.fn(),
  ADMIN_ROLE_ID: 1,
}))

vi.mock('../src/db/index.js', () => {
  function chain(): Record<string, unknown> {
    const c: Record<string, unknown> = {
      from: () => c,
      where: () => c,
      offset: () => c,
      limit: () => Promise.resolve([]),
      orderBy: () => Promise.resolve([]),
      set: () => c,
      values: () => c,
      returning: () => Promise.resolve([]),
      leftJoin: () => c,
      innerJoin: () => c,
    }
    return c
  }
  const dbMock = {
    select: vi.fn(() => chain()),
    update: vi.fn(() => chain()),
    insert: vi.fn(() => chain()),
    delete: vi.fn(() => chain()),
    execute: vi.fn().mockResolvedValue([]),
  }
  return { db: dbMock, dbRead: dbMock, dbClient: {} }
})

vi.mock('../src/db/commission-queries.js', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    applyWithdrawal: mocks.applyWithdrawal,
    availableWithdrawal: mocks.availableWithdrawal,
  }
})

vi.mock('../src/services/two-factor-step-up-store.js', () => ({
  requireStepUpForTwoFactorUser: mocks.stepUp,
}))

import { financeRoutes } from '../src/routes/finance.js'
import {
  DistributedLock,
  LockAcquireError,
  LockReleaseError,
} from '../src/utils/distributed-lock.js'

interface RedisStub {
  redis: Redis
  set: ReturnType<typeof vi.fn>
  eval: ReturnType<typeof vi.fn>
}

function makeRedisStub(): RedisStub {
  const set = vi.fn(async () => 'OK')
  const evalFn = vi.fn(async () => 1)
  return { redis: { set, eval: evalFn } as unknown as Redis, set, eval: evalFn }
}

const shared = makeRedisStub()

describe('F-67 提现 apply 的锁降级分流', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    app = Fastify({ logger: false })
    app.decorate('distributedLock', new DistributedLock(shared.redis))
    app.decorate('riskEngine', { evaluateRisk: mocks.evaluateRisk })
    await app.register(financeRoutes, { prefix: '/api' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.authenticate.mockImplementation(async (request: { userId?: string }) => {
      request.userId = USER_ID
    })
    mocks.stepUp.mockResolvedValue({ ok: true, enforced: false })
    mocks.evaluateRisk.mockReturnValue({ totalScore: 0, action: 'ALLOW', hits: [] })
    mocks.availableWithdrawal.mockResolvedValue(1_000_000)
    mocks.applyWithdrawal.mockResolvedValue(FLOW)
    shared.set.mockReset().mockResolvedValue('OK')
    shared.eval.mockReset().mockResolvedValue(1)
  })

  const apply = () => app.inject({ method: 'POST', url: APPLY_URL })

  it('正常路径:持锁执行一次后释放,返回流水', async () => {
    const res = await apply()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ id: FLOW.id, amount: 9800 })
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
    expect(shared.eval).toHaveBeenCalledTimes(1)
  })

  it('release 抛错:不再二次执行 doApply,错误如实上抛', async () => {
    shared.eval.mockRejectedValueOnce(new Error('redis eval failed'))
    const res = await apply()
    expect(res.statusCode).toBe(500)
    expect(res.json().message).toContain('释放分布式锁失败')
    // 变异自证:退回「finally 里 await release + 无 statusCode 即降级」会调用 2 次并返回 200
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
    expect(mocks.availableWithdrawal).toHaveBeenCalledTimes(1)
  })

  it('业务异常(无 statusCode):原样上抛,不降级重跑', async () => {
    mocks.applyWithdrawal.mockRejectedValueOnce(new Error('DB connection lost'))
    const res = await apply()
    expect(res.statusCode).toBe(500)
    expect(res.json().message).toContain('DB connection lost')
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
  })

  it('业务异常(带 statusCode 400):原样上抛', async () => {
    mocks.applyWithdrawal.mockRejectedValueOnce(
      Object.assign(new Error('可提现余额不足'), { statusCode: 400 }),
    )
    const res = await apply()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('可提现余额不足')
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
  })

  it('业务异常且 release 也失败:上抛业务异常,仍不重跑', async () => {
    shared.eval.mockRejectedValueOnce(new Error('redis eval failed'))
    mocks.applyWithdrawal.mockRejectedValueOnce(
      Object.assign(new Error('可提现余额不足'), { statusCode: 400 }),
    )
    const res = await apply()
    expect(res.statusCode).toBe(400)
    expect(res.json().message).toContain('可提现余额不足')
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
  })

  it('acquire 失败(Redis 不可用):沿用既有降级语义,只执行一次', async () => {
    shared.set.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:6379'))
    const res = await apply()
    expect(res.statusCode).toBe(200)
    expect(res.json().data).toMatchObject({ id: FLOW.id })
    expect(mocks.applyWithdrawal).toHaveBeenCalledTimes(1)
    expect(mocks.availableWithdrawal).toHaveBeenCalledTimes(1)
    // 未持锁成功,不应进入释放
    expect(shared.eval).not.toHaveBeenCalled()
  })

  it('锁争用(acquire 423):原样拒绝,不执行任何提现逻辑', async () => {
    shared.set.mockResolvedValueOnce(null)
    const res = await apply()
    expect(res.statusCode).toBe(423)
    expect(mocks.applyWithdrawal).not.toHaveBeenCalled()
    expect(mocks.availableWithdrawal).not.toHaveBeenCalled()
  })
})

describe('F-67 withLock 三阶段失败语义', () => {
  it('acquire 失败 ⇒ LockAcquireError,业务未执行', async () => {
    const stub = makeRedisStub()
    stub.set.mockRejectedValueOnce(new Error('connect ECONNREFUSED'))
    const locker = new DistributedLock(stub.redis)
    const fn = vi.fn(async () => 1)

    const err = await locker.withLock('lock:acquire-fail', 1000, fn).catch((e) => e)

    expect(err).toBeInstanceOf(LockAcquireError)
    expect((err as LockAcquireError).statusCode).toBeUndefined()
    expect(fn).not.toHaveBeenCalled()
  })

  it('release 失败 ⇒ LockReleaseError 且保留业务结果', async () => {
    const stub = makeRedisStub()
    const releaseErr = new Error('redis eval failed')
    stub.eval.mockRejectedValueOnce(releaseErr)
    const locker = new DistributedLock(stub.redis)

    const err = await locker.withLock('lock:release-fail', 1000, async () => 42).catch((e) => e)

    expect(err).toBeInstanceOf(LockReleaseError)
    expect((err as LockReleaseError<number>).result).toBe(42)
    expect((err as LockReleaseError<number>).businessError).toBeUndefined()
    expect((err as Error).cause).toBe(releaseErr)
  })

  it('业务异常原样抛出,不被包装成锁错误', async () => {
    const stub = makeRedisStub()
    const locker = new DistributedLock(stub.redis)
    const biz = Object.assign(new Error('可提现余额不足'), { statusCode: 400 })

    await expect(
      locker.withLock('lock:biz-fail', 1000, async () => {
        throw biz
      }),
    ).rejects.toBe(biz)
  })
})
