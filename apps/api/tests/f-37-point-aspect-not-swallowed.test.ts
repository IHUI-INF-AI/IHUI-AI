// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-37 回归:行为积分(PointAspect)发放失败不得被静默吞掉。
 *
 * 原缺陷:increasePoints 失败只 `log.warn`,外层 `.catch(() => {})` 直接吞掉,
 * 用户操作成功(200/201)但积分不入账且无任何可对账信号。
 *
 * 现语义(插件按设计不得抛错/阻塞主请求,见 point-aspect.ts 头注释):
 *   短退避有界重试(2 次)→ 仍失败写结构化 error 日志(userId/operation/points/reason/attempts)
 *   → 进进程内待补偿队列,下次任意规则触发时重放。
 * 断言口径:不连库,db 层与 increasePoints 全桩;logger 用 loggerInstance 捕获。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance, type FastifyPluginAsync } from 'fastify'
import type { FastifyBaseLogger } from 'fastify'

const USER_ID = '00000000-0000-4000-8000-000000000001'
const TARGET_USER_ID = '00000000-0000-4000-8000-000000000099'
const CHANNEL_ID = '00000000-0000-4000-8000-000000000020'
const POINT_ID = '00000000-0000-4000-8000-000000000030'

const H = vi.hoisted(() => ({
  selectResults: [] as unknown[][],
  increasePoints: vi.fn<(input: Record<string, unknown>) => Promise<unknown>>(),
}))

vi.mock('../src/db/index.js', () => {
  const makeChain = (rows: unknown[]) => {
    const step: Record<string, unknown> = {}
    for (const m of ['from', 'where', 'limit', 'orderBy', 'set', 'values', 'returning']) {
      step[m] = vi.fn(() => step)
    }
    step.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) =>
      Promise.resolve(rows).then(resolve, reject)
    return step
  }
  const dbMock = {
    select: vi.fn(() => makeChain(H.selectResults.shift() ?? [])),
    insert: vi.fn(() => makeChain([])),
    update: vi.fn(() => makeChain([])),
    delete: vi.fn(() => makeChain([])),
    execute: vi.fn().mockResolvedValue([]),
    transaction: vi.fn((fn: (tx: unknown) => Promise<unknown>) => fn(dbMock)),
  }
  return { db: dbMock, dbRead: dbMock }
})

vi.mock('../src/db/point-queries.js', () => ({
  increasePoints: H.increasePoints,
  decreasePoints: vi.fn(),
  fallbackPoints: vi.fn(),
}))

import pointAspectPlugin, { __test__ } from '../src/plugins/point-aspect.js'

interface CapturedLog {
  level: string
  obj: Record<string, unknown>
  msg: string
}

function makeCaptureLogger(sink: CapturedLog[]): Record<string, unknown> {
  const emit = (level: string) => (obj: unknown, msg?: string) => {
    sink.push({ level, obj: (obj ?? {}) as Record<string, unknown>, msg: String(msg ?? '') })
  }
  const logger: Record<string, unknown> = {
    trace: emit('trace'),
    debug: emit('debug'),
    info: emit('info'),
    warn: emit('warn'),
    error: emit('error'),
    fatal: emit('fatal'),
  }
  logger.child = () => logger
  return logger
}

const testRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/follows/:userId', async (request, reply) => {
    request.userId = USER_ID
    return reply.status(201).send({ code: 0, data: { followed: true } })
  })
  server.post('/api/checkin', async (request, reply) => {
    request.userId = USER_ID
    return reply.send({ code: 0, data: { checkedIn: true } })
  })
}

let app: FastifyInstance
let logs: CapturedLog[]

/** resolveRule 每次触发要 2 次 select:channel → point。 */
function stageRule(): void {
  H.selectResults.push([{ id: CHANNEL_ID }], [{ id: POINT_ID }])
}

async function triggerFollow(): Promise<number> {
  const res = await app.inject({ method: 'POST', url: `/api/follows/${TARGET_USER_ID}` })
  return res.statusCode
}

beforeEach(async () => {
  logs = []
  H.selectResults.length = 0
  H.increasePoints.mockReset()
  __test__.resetPending()
  app = Fastify({ loggerInstance: makeCaptureLogger(logs) as unknown as FastifyBaseLogger })
  await app.register(pointAspectPlugin)
  await app.register(testRoutes)
  await app.ready()
})

afterEach(async () => {
  __test__.resetPending()
  await app.close()
})

describe('F-37 积分失败不再被静默吞掉', () => {
  it('首次失败后短退避重试成功 ⇒ 最终只入账一次,无 error 日志', async () => {
    H.increasePoints
      .mockRejectedValueOnce(new Error('connection reset'))
      .mockResolvedValueOnce({ record: { id: 'rec-1' } })
    stageRule()

    expect(await triggerFollow()).toBe(201)

    await vi.waitFor(() => expect(H.increasePoints).toHaveBeenCalledTimes(2))
    expect(logs.filter((l) => l.level === 'error')).toHaveLength(0)
    expect(__test__.pendingPointOps).toHaveLength(0)
    expect(H.increasePoints.mock.calls[0]![0]).toMatchObject({
      memberId: USER_ID,
      channelId: CHANNEL_ID,
      pointId: POINT_ID,
      amount: 5,
    })
  })

  it('连续失败 ⇒ 结构化 error 日志(userId/operation/points/reason/attempts),主请求仍 201 不抛错', async () => {
    H.increasePoints.mockRejectedValue(new Error('db unavailable'))
    stageRule()

    expect(await triggerFollow()).toBe(201)

    await vi.waitFor(() =>
      expect(
        logs.filter(
          (l) => l.level === 'error' && l.msg.includes('increasePoints failed after retries'),
        ),
      ).toHaveLength(1),
    )
    const failed = logs.find((l) => l.msg.includes('increasePoints failed after retries'))!
    expect(failed.obj).toMatchObject({
      userId: USER_ID,
      operation: 'follow',
      pointCode: 'follow',
      points: 5,
      attempts: 2,
      reason: 'db unavailable',
    })
    // 有界重试:2 次尝试后放弃
    expect(H.increasePoints).toHaveBeenCalledTimes(2)
    // 落进进程内待补偿队列,可对账
    expect(__test__.pendingPointOps).toHaveLength(1)
    expect(__test__.pendingPointOps[0]!.operation).toBe('follow')
    expect(__test__.pendingPointOps[0]!.input.amount).toBe(5)
  })

  it('成功路径 ⇒ 只发一次,不产生 warn/error', async () => {
    H.increasePoints.mockResolvedValue({ record: { id: 'rec-1' } })
    stageRule()

    expect(await triggerFollow()).toBe(201)

    await vi.waitFor(() => expect(H.increasePoints).toHaveBeenCalledTimes(1))
    // 给足再次触发的窗口,确认没有重复发放
    await new Promise((resolve) => setTimeout(resolve, 80))
    expect(H.increasePoints).toHaveBeenCalledTimes(1)
    expect(logs.filter((l) => l.level === 'error' || l.level === 'warn')).toHaveLength(0)
    expect(__test__.pendingPointOps).toHaveLength(0)
  })

  it('下次触发时补偿上次失败的积分(进程内待重试队列)', async () => {
    H.increasePoints.mockRejectedValue(new Error('db unavailable'))
    stageRule()
    expect(await triggerFollow()).toBe(201)
    await vi.waitFor(() => expect(__test__.pendingPointOps).toHaveLength(1))
    expect(H.increasePoints).toHaveBeenCalledTimes(2)

    // DB 恢复:下一次触发先补偿旧账,再发本次(mockReset 已清空调用计数)
    H.increasePoints.mockReset()
    H.increasePoints.mockResolvedValue({ record: { id: 'rec-2' } })
    stageRule()
    expect(await triggerFollow()).toBe(201)

    await vi.waitFor(() => expect(H.increasePoints).toHaveBeenCalledTimes(2))
    expect(__test__.pendingPointOps).toHaveLength(0)
    expect(logs.some((l) => l.msg.includes('pending points compensated'))).toBe(true)
  })
})
