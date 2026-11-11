// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * SDB-16 回归:消息总线只看 HTTP 200 会把业务失败当成功(2026-11-11 立)。
 *
 * 为什么必须单独钉:飞书/钉钉/企微在机器人被限频、加签或关键词校验失败时,
 * 协议上返回的仍是 HTTP 200 —— 失败只体现在 code / errcode 里。旧 postJson 只判
 * `resp.ok`,于是告警静默丢失、上游以为已送达,故障完全不可见。
 *
 * 覆盖:
 * ① 飞书 HTTP200 + code≠0 ⇒ success:false,error 带渠道文案,code 回填
 * ② 钉钉 errcode≠0 ⇒ success:false
 * ③ 企微 errcode≠0 ⇒ success:false
 * ④ 三家业务码为 0 ⇒ success:true(原成功路径不回退)
 * ⑤ HTTP 非 200 仍 success:false(原失败路径不回退)
 * ⑥ message_id/id 提取保留(新增业务码校验不得吞掉原 messageId 行为)
 *
 * 测试模式:stub globalThis.fetch,不连任何外部平台。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { feishuAdapter } from '../src/services/message-bus/feishu.js'
import { dingtalkAdapter } from '../src/services/message-bus/dingtalk.js'
import { wechatAdapter } from '../src/services/message-bus/wechat.js'

const ENV_KEYS = ['FEISHU_WEBHOOK_URL', 'DINGTALK_WEBHOOK_URL', 'WECHAT_WEBHOOK_URL'] as const

const originalEnv: Record<string, string | undefined> = {}
const originalFetch = globalThis.fetch

/** 让 fetch 返回固定响应,并记录调用次数供"确实请求了一次"断言 */
function stubFetch(status: number, payload: unknown): ReturnType<typeof vi.fn> {
  const mock = vi.fn(async () => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  }))
  globalThis.fetch = mock as unknown as typeof globalThis.fetch
  return mock
}

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    process.env[key] = `https://example.invalid/${key.toLowerCase()}`
  }
})

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) delete process.env[key]
    else process.env[key] = originalEnv[key]
  }
  globalThis.fetch = originalFetch
})

describe('SDB-16 飞书:code 非 0 即失败', () => {
  it('HTTP200 + code=19021(限频)⇒ success:false,error 带 msg,code 回填', async () => {
    stubFetch(200, { code: 19021, msg: 'too many request', data: {} })

    const result = await feishuAdapter.send('告警内容')

    expect(result.success).toBe(false)
    expect(result.error).toContain('too many request')
    expect(result.code).toBe(19021)
  })
})

describe('SDB-16 钉钉:errcode 非 0 即失败', () => {
  it('HTTP200 + errcode=310000(关键词校验失败)⇒ success:false', async () => {
    stubFetch(200, { errcode: 310000, errmsg: 'keywords not in content' })

    const result = await dingtalkAdapter.send('告警内容')

    expect(result.success).toBe(false)
    expect(result.error).toContain('keywords not in content')
    expect(result.code).toBe(310000)
  })
})

describe('SDB-16 企微:errcode 非 0 即失败', () => {
  it('HTTP200 + errcode=45009(接口频率超限)⇒ success:false', async () => {
    stubFetch(200, { errcode: 45009, errmsg: 'api freq out of limit' })

    const result = await wechatAdapter.send('告警内容')

    expect(result.success).toBe(false)
    expect(result.error).toContain('api freq out of limit')
    expect(result.code).toBe(45009)
  })
})

describe('SDB-16 业务码为 0 时仍走原成功路径', () => {
  it('飞书 code=0 ⇒ success:true', async () => {
    stubFetch(200, { code: 0, msg: 'success', data: {} })

    const result = await feishuAdapter.send('x')

    expect(result.success).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('钉钉 errcode=0 ⇒ success:true', async () => {
    stubFetch(200, { errcode: 0, errmsg: 'ok' })

    expect((await dingtalkAdapter.send('x')).success).toBe(true)
  })

  it('企微 errcode=0 ⇒ success:true', async () => {
    stubFetch(200, { errcode: 0, errmsg: 'ok' })

    expect((await wechatAdapter.send('x')).success).toBe(true)
  })

  it('成功响应里的 message_id 仍被提取(业务码校验不得吞掉原行为)', async () => {
    stubFetch(200, { code: 0, msg: 'success', message_id: 'om_msg_1' })

    const result = await feishuAdapter.send('x')

    expect(result.success).toBe(true)
    expect(result.messageId).toBe('om_msg_1')
  })
})

describe('SDB-16 HTTP 非 200 仍是失败(不回退)', () => {
  it.each([
    ['飞书', feishuAdapter],
    ['钉钉', dingtalkAdapter],
    ['企微', wechatAdapter],
  ])('%s HTTP 500 ⇒ success:false 且 error 为 HTTP 500', async (_name, adapter) => {
    stubFetch(500, { code: 0, errcode: 0 })

    const result = await adapter.send('x')

    expect(result.success).toBe(false)
    expect(result.error).toBe('HTTP 500')
  })
})
