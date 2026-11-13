// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-182 回归锁(2026-11-13)。
 *
 * 病灶:腾讯短信「回复」回调命中退订(如回复 TD)时,`addSmsUnsubscribe` 写库失败只让
 * `unsubscribeCount` 少加一,路由仍无条件 `200 {"result":0}`。厂商把 200 当「已处理」,
 * 不会重试 ⇒ 黑名单永久没落库,用户继续收营销短信(合规/投诉风险)。
 *
 * 本文件锁:
 *   ① 退订写入失败:回 5xx,响应体不得是成功态,且不得打出「已处理」的成功路径;
 *   ② 同一回调被厂商重试、这次写入成功:回 200 且退订真的落库(重试要能重做失败的那一步);
 *   ③ 写入成功后重复回调:仍 200,按 phone 幂等只留一行(既有去重语义不被破坏);
 *   ④ 成功路径:200 + {"result":0}(回包结构不变);
 *   ⑤ 非退订类回调(status 回执 / 非退订回复 / 缺手机号 / 无法判别)行为不变:200 且不调退订写入。
 *
 * 只 mock window-counter(避免连 Redis)、db 与 sms-compliance 的写库函数,
 * 不触达真实 PG / Redis / ai-service。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify, { type FastifyInstance } from 'fastify'
import type * as SmsCompliance from '../src/services/sms-compliance.js'

// 路由在放行路径上会打限流计数;这里只验退订落库语义,不要真去连 Redis / 走内存窗口。
vi.mock('../src/utils/window-counter.js', () => ({
  tryConsumeWindows: vi.fn().mockResolvedValue(0),
}))

vi.mock('../src/db/index.js', () => ({
  db: { execute: vi.fn(), select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn() },
  dbRead: { select: vi.fn() },
  dbClient: {},
}))

// 只替换真正写库的三个出口;isUnsubscribeReply / normalizeSmsPhone 等纯函数保留真实实现,
// 否则「回复 TD 算退订」这条判据会被 mock 掉,用例就锁不住触发路径。
vi.mock('../src/services/sms-compliance.js', async (importOriginal) => {
  const actual = await importOriginal<typeof SmsCompliance>()
  return {
    ...actual,
    addSmsUnsubscribe: vi.fn(),
    recordSmsInbound: vi.fn(),
    updateSmsDeliveryReport: vi.fn(),
  }
})

import { smsCallbackRoutes } from '../src/routes/sms-callback.js'
import {
  addSmsUnsubscribe,
  normalizeSmsPhone,
  recordSmsInbound,
  updateSmsDeliveryReport,
} from '../src/services/sms-compliance.js'

const URL_TENCENT = '/api/sms/callback/tencent'
const TOKEN = 'f182-callback-token'
const PHONE = '+8613800138000'
const PHONE_NORMALIZED = '13800138000'

const ORIGINAL_TOKEN = process.env.SMS_CALLBACK_TOKEN
const ORIGINAL_ALLOWLIST = process.env.SMS_CALLBACK_IP_ALLOWLIST

/** 退订表的假体:phone 唯一键 + upsert,用来表达真实服务里 ON CONFLICT (phone) DO UPDATE 的语义。 */
const unsubscribeRows = new Map<string, { reason?: string; rawContent?: string; writes: number }>()

const addSmsUnsubscribeMock = vi.mocked(addSmsUnsubscribe)
const recordSmsInboundMock = vi.mocked(recordSmsInbound)
const updateSmsDeliveryReportMock = vi.mocked(updateSmsDeliveryReport)

/** 每次写入都执行,但同一 phone 只留一行(writes 记录"确实又写了一次")。 */
function upsertUnsubscribe(input: {
  phone: string
  reason?: string
  rawContent?: string
}): Promise<boolean> {
  const key = normalizeSmsPhone(input.phone)
  const prev = unsubscribeRows.get(key)
  unsubscribeRows.set(key, {
    reason: input.reason,
    rawContent: input.rawContent ?? prev?.rawContent,
    writes: (prev?.writes ?? 0) + 1,
  })
  return Promise.resolve(true)
}

describe('F-182 短信退订回执写库失败不得回 200', () => {
  let app: FastifyInstance

  beforeAll(async () => {
    process.env.SMS_CALLBACK_TOKEN = TOKEN
    delete process.env.SMS_CALLBACK_IP_ALLOWLIST
    app = Fastify({ logger: false })
    await app.register(smsCallbackRoutes, { prefix: '/api/sms/callback' })
    await app.ready()
  })

  afterAll(async () => {
    await app.close()
    if (ORIGINAL_TOKEN === undefined) delete process.env.SMS_CALLBACK_TOKEN
    else process.env.SMS_CALLBACK_TOKEN = ORIGINAL_TOKEN
    if (ORIGINAL_ALLOWLIST === undefined) delete process.env.SMS_CALLBACK_IP_ALLOWLIST
    else process.env.SMS_CALLBACK_IP_ALLOWLIST = ORIGINAL_ALLOWLIST
  })

  beforeEach(() => {
    unsubscribeRows.clear()
    addSmsUnsubscribeMock.mockReset()
    recordSmsInboundMock.mockReset().mockResolvedValue(true)
    updateSmsDeliveryReportMock.mockReset().mockResolvedValue(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  const call = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'POST',
      url: URL_TENCENT,
      headers: { 'x-sms-callback-token': TOKEN },
      payload,
    })

  const replyPayload = { phone_number: PHONE, content: 'TD' }

  it('① 退订写库失败:回 5xx,响应体不是成功态,且不落库', async () => {
    addSmsUnsubscribeMock.mockResolvedValue(false)

    const res = await call(replyPayload)

    expect(res.statusCode).toBeGreaterThanOrEqual(500)
    const body = res.json() as { result?: number; errmsg?: string }
    expect(body.result).not.toBe(0)
    expect(body.errmsg).toBeTruthy()
    expect(unsubscribeRows.size).toBe(0)
    // 上行台账是旁路,失败方向不应把它一起算成"没收到"
    expect(recordSmsInboundMock).toHaveBeenCalledTimes(1)
  })

  it('② 写入失败后厂商重试、这次写成功:回 200 且退订真的落库', async () => {
    addSmsUnsubscribeMock.mockResolvedValueOnce(false)
    addSmsUnsubscribeMock.mockImplementationOnce(upsertUnsubscribe)

    const failed = await call(replyPayload)
    expect(failed.statusCode).toBeGreaterThanOrEqual(500)

    const retried = await call(replyPayload)
    expect(retried.statusCode).toBe(200)
    expect(retried.json()).toEqual({ result: 0 })

    // 重试必须真正重做失败的那一步,而不是被"已处理"短路
    expect(addSmsUnsubscribeMock).toHaveBeenCalledTimes(2)
    expect(addSmsUnsubscribeMock.mock.calls[1]?.[0]).toMatchObject({
      phone: PHONE,
      source: 'reply',
    })
    expect(unsubscribeRows.get(PHONE_NORMALIZED)?.writes).toBe(1)
  })

  it('③ 写入成功后重复回调:仍 200,按 phone 幂等只留一行', async () => {
    addSmsUnsubscribeMock.mockImplementation(upsertUnsubscribe)

    const first = await call(replyPayload)
    const second = await call(replyPayload)

    expect(first.statusCode).toBe(200)
    expect(second.statusCode).toBe(200)
    expect(first.json()).toEqual({ result: 0 })
    expect(second.json()).toEqual({ result: 0 })
    expect(addSmsUnsubscribeMock).toHaveBeenCalledTimes(2)
    expect(unsubscribeRows.size).toBe(1)
    expect(unsubscribeRows.get(PHONE_NORMALIZED)?.writes).toBe(2)
  })

  it('④ 成功路径:回包结构仍是 200 + {"result":0}', async () => {
    addSmsUnsubscribeMock.mockImplementation(upsertUnsubscribe)

    const res = await call({ data: { phone_number: PHONE, content: '退订' } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ result: 0 })
    expect(addSmsUnsubscribeMock).toHaveBeenCalledTimes(1)
    expect(addSmsUnsubscribeMock.mock.calls[0]?.[0]).toMatchObject({
      phone: PHONE,
      source: 'reply',
      rawContent: '退订',
    })
    expect(unsubscribeRows.get(PHONE_NORMALIZED)?.writes).toBe(1)
  })

  it('⑤ 非退订类回调行为不变:200 且不碰退订写入', async () => {
    addSmsUnsubscribeMock.mockResolvedValue(true)

    // status 回执:即使对不上本地流水(返回 false),也只是 warn + 200
    updateSmsDeliveryReportMock.mockResolvedValue(false)
    const status = await call({ phone_number: PHONE, result: 0, serial_no: 'sn-f182' })
    expect(status.statusCode).toBe(200)
    expect(status.json()).toEqual({ result: 0 })
    expect(updateSmsDeliveryReportMock).toHaveBeenCalledTimes(1)

    // 上行回复但不是退订表达
    const normalReply = await call({ phone_number: PHONE, content: '好的谢谢' })
    expect(normalReply.statusCode).toBe(200)
    expect(normalReply.json()).toEqual({ result: 0 })

    // 缺手机号 / 无法判别类型:丢弃 + 200
    const noPhone = await call({ content: 'TD' })
    expect(noPhone.statusCode).toBe(200)
    expect(noPhone.json()).toEqual({ result: 0 })

    const unknownKind = await call({ phone_number: PHONE })
    expect(unknownKind.statusCode).toBe(200)
    expect(unknownKind.json()).toEqual({ result: 0 })

    expect(addSmsUnsubscribeMock).not.toHaveBeenCalled()
  })
})
