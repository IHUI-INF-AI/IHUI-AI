// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Fastify from 'fastify'

// 放行路径会打限流计数;这里只验鉴权闸,不要真去连 Redis / 走内存窗口。
vi.mock('../src/utils/window-counter.js', () => ({
  tryConsumeWindows: vi.fn().mockResolvedValue(0),
}))

import { smsCallbackRoutes } from '../src/routes/sms-callback.js'
import {
  isSmsCallbackAuthorized,
  isSmsCallbackGateConfigured,
} from '../src/services/sms-callback-parse.js'

/**
 * SDB-25 回归锁:空白/逗号形态的配置曾让两道闸同时失效。
 *
 * 旧形态:路由用未 trim 的原值判「已配置」(`Boolean(expectedToken || allowlist)`),
 * 而服务内 trim 后为空就跳过该闸 ⇒ `SMS_CALLBACK_TOKEN='   '` 或
 * `SMS_CALLBACK_IP_ALLOWLIST=','` 时两闸皆为假、函数返回 true,回调端点无鉴权对外开放。
 * 所以每例都要成对:失败形态拒绝,合法形态仍要放行(否则「修好」等于把端点关死)。
 */

const URL_STATUS = '/api/sms/callback/tencent/status'
const ORIGINAL_TOKEN = process.env.SMS_CALLBACK_TOKEN
const ORIGINAL_ALLOWLIST = process.env.SMS_CALLBACK_IP_ALLOWLIST

function setEnv(token: string | undefined, allowlist: string | undefined): void {
  if (token === undefined) delete process.env.SMS_CALLBACK_TOKEN
  else process.env.SMS_CALLBACK_TOKEN = token
  if (allowlist === undefined) delete process.env.SMS_CALLBACK_IP_ALLOWLIST
  else process.env.SMS_CALLBACK_IP_ALLOWLIST = allowlist
}

beforeEach(() => {
  setEnv(undefined, undefined)
})

afterEach(() => {
  setEnv(ORIGINAL_TOKEN, ORIGINAL_ALLOWLIST)
  vi.clearAllMocks()
})

describe('服务层:归一化判「已配置」', () => {
  it('纯空白 token / 无有效项的 allowlist 都不算已配置', () => {
    expect(isSmsCallbackGateConfigured({ expectedToken: '   ', allowlist: undefined })).toBe(false)
    expect(isSmsCallbackGateConfigured({ expectedToken: undefined, allowlist: ',' })).toBe(false)
    expect(isSmsCallbackGateConfigured({ expectedToken: '  ', allowlist: ' , , ' })).toBe(false)
    expect(isSmsCallbackGateConfigured({ expectedToken: undefined, allowlist: '' })).toBe(false)
  })

  it('任一闸规范化后非空即算已配置', () => {
    expect(isSmsCallbackGateConfigured({ expectedToken: ' s3cret ', allowlist: undefined })).toBe(
      true,
    )
    expect(isSmsCallbackGateConfigured({ expectedToken: undefined, allowlist: '1.2.3.4, ,' })).toBe(
      true,
    )
  })
})

describe('服务层:两闸判据', () => {
  it('① token 纯空白 ⇒ 拒绝(fail-closed)', () => {
    expect(
      isSmsCallbackAuthorized({ expectedToken: '   ', providedToken: '   ', ip: '1.2.3.4' }),
    ).toBe(false)
    expect(isSmsCallbackAuthorized({ expectedToken: '   ', ip: '1.2.3.4' })).toBe(false)
  })

  it('② allowlist 为 "," ⇒ 拒绝(fail-closed)', () => {
    expect(isSmsCallbackAuthorized({ allowlist: ',', ip: '1.2.3.4' })).toBe(false)
    expect(isSmsCallbackAuthorized({ allowlist: ' , , ', ip: '1.2.3.4' })).toBe(false)
  })

  it('③ 合法 token 必须完全一致', () => {
    expect(
      isSmsCallbackAuthorized({
        expectedToken: ' s3cret ',
        providedToken: 's3cret',
        ip: '1.2.3.4',
      }),
    ).toBe(true)
    expect(
      isSmsCallbackAuthorized({ expectedToken: 's3cret', providedToken: 's3cret2', ip: '1.2.3.4' }),
    ).toBe(false)
    expect(isSmsCallbackAuthorized({ expectedToken: 's3cret', ip: '1.2.3.4' })).toBe(false)
  })

  it('④ 合法 allowlist 命中放行、不命中拒绝', () => {
    expect(
      isSmsCallbackAuthorized({ allowlist: '1.2.3.4, 5.6.7.8', ip: '::ffff:1.2.3.4' }),
    ).toBe(true)
    expect(isSmsCallbackAuthorized({ allowlist: '1.2.3.4, 5.6.7.8', ip: '9.9.9.9' })).toBe(false)
  })

  it('两个变量完全未设置时保持旧语义(放行,交给调用方兜底)', () => {
    expect(isSmsCallbackAuthorized({ ip: '9.9.9.9' })).toBe(true)
  })
})

describe('路由层:端点上的实际响应', () => {
  async function withApp(
    fn: (app: ReturnType<typeof Fastify>) => Promise<void>,
  ): Promise<void> {
    const app = Fastify({ logger: false })
    await app.register(smsCallbackRoutes, { prefix: '/api/sms/callback' })
    await app.ready()
    try {
      await fn(app)
    } finally {
      await app.close()
    }
  }

  async function inject(payload: Record<string, unknown> = {}, remoteAddress?: string) {
    let res: { statusCode: number; json: () => unknown } | undefined
    await withApp(async (app) => {
      res = await app.inject({
        method: 'POST',
        url: URL_STATUS,
        payload,
        ...(remoteAddress ? { remoteAddress } : {}),
      })
    })
    if (!res) throw new Error('注入未执行')
    return res
  }

  it('token 纯空白 ⇒ 503(端点视为未配置)', async () => {
    setEnv('   ', undefined)
    const res = await inject({ result: 0 })
    expect(res.statusCode).toBe(503)
  })

  it('allowlist 为 "," ⇒ 503(端点视为未配置)', async () => {
    setEnv(undefined, ',')
    const res = await inject({ result: 0 })
    expect(res.statusCode).toBe(503)
  })

  it('两变量都未设置 ⇒ 503(维持原有行为,未顺手放开)', async () => {
    setEnv(undefined, undefined)
    const res = await inject({ result: 0 })
    expect(res.statusCode).toBe(503)
  })

  it('合法 token:带对放行、带错/不带拒绝', async () => {
    setEnv('s3cret', undefined)
    await withApp(async (app) => {
      const good = await app.inject({
        method: 'POST',
        url: URL_STATUS,
        headers: { 'x-sms-callback-token': 's3cret' },
        payload: { result: 0 },
      })
      // body 缺手机号 ⇒ 不落库,直接 200 + result:0(厂商看到的就是成功)
      expect(good.statusCode).toBe(200)
      expect(good.json()).toEqual({ result: 0 })

      const bad = await app.inject({
        method: 'POST',
        url: URL_STATUS,
        headers: { 'x-sms-callback-token': 'wrong' },
        payload: { result: 0 },
      })
      expect(bad.statusCode).toBe(403)

      const missing = await app.inject({
        method: 'POST',
        url: URL_STATUS,
        payload: { result: 0 },
      })
      expect(missing.statusCode).toBe(403)
    })
  })

  it('合法 allowlist:命中放行、不命中拒绝', async () => {
    setEnv(undefined, '1.2.3.4, 5.6.7.8')
    const hit = await inject({ result: 0 }, '1.2.3.4')
    expect(hit.statusCode).toBe(200)
    expect(hit.json()).toEqual({ result: 0 })

    const miss = await inject({ result: 0 }, '9.9.9.9')
    expect(miss.statusCode).toBe(403)
  })
})
