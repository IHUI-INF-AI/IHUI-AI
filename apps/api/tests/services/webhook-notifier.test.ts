/**
 * webhook-notifier 单元测试
 *
 * 覆盖场景:
 * - 钉钉/飞书/企业微信 发送成功与失败
 * - 网络超时 (AbortError)
 * - 统一入口路由到三个 webhook 渠道
 * - 非 webhook 渠道(sms/email 等)的拒绝路径
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  sendDingtalk,
  sendFeishu,
  sendWechatWork,
  sendWebhookNotification,
} from '../../src/services/webhook-notifier.js'
import type { ChannelConfig, DingtalkMessage, FeishuMessage, WechatWorkMessage } from '@ihui/types'

/** 构造 fetch Response 的辅助函数 */
function makeResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    body: null,
    bodyUsed: false,
    clone() {
      return makeResponse(body, ok)
    },
  } as Response
}

describe('webhook-notifier', () => {
  const originalFetch = globalThis.fetch
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    globalThis.fetch = originalFetch
  })

  // ===================== 钉钉 =====================
  describe('sendDingtalk', () => {
    const config: ChannelConfig = {
      channel: 'dingtalk',
      webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
    }
    const msg: DingtalkMessage = { msgtype: 'text', text: { content: 'hello' } }

    it('发送成功 (errcode=0)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const result = await sendDingtalk(config, msg)
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain('oapi.dingtalk.com/robot/send')
      expect(init.method).toBe('POST')
    })

    it('发送失败 (errcode=310000 keywords not in content)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ errcode: 310000, errmsg: 'keywords not in content' }),
      )
      const result = await sendDingtalk(config, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('310000')
      expect(result.error).toContain('keywords not in content')
    })

    it('配置了 secret 时附加 timestamp 与 sign 参数', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const configWithSecret: ChannelConfig = {
        ...config,
        secret: 'SEC_TEST_SECRET',
      }
      await sendDingtalk(configWithSecret, msg)
      const [url] = fetchMock.mock.calls[0]
      expect(url).toMatch(/timestamp=\d+/)
      expect(url).toMatch(/sign=/)
    })

    it('未配置 webhookUrl 返回失败', async () => {
      const result = await sendDingtalk({ channel: 'dingtalk' }, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('webhookUrl')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })

  // ===================== 飞书 =====================
  describe('sendFeishu', () => {
    const config: ChannelConfig = {
      channel: 'feishu',
      webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
    }
    const msg: FeishuMessage = { msg_type: 'text', content: { text: 'hello' } }

    it('发送成功 (StatusCode=0)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ StatusCode: 0, StatusMessage: 'success' }))
      const result = await sendFeishu(config, msg)
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain('open.feishu.cn/open-apis/bot/v2/hook')
      expect(init.method).toBe('POST')
    })

    it('发送失败 (code=19021 sign match error)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ code: 19021, msg: 'sign match error' }))
      const result = await sendFeishu(config, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('19021')
      expect(result.error).toContain('sign match error')
    })

    it('未配置 webhookUrl 返回失败', async () => {
      const result = await sendFeishu({ channel: 'feishu' }, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('webhookUrl')
    })
  })

  // ===================== 企业微信 =====================
  describe('sendWechatWork', () => {
    const config: ChannelConfig = {
      channel: 'wechat',
      webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
    }
    const msg: WechatWorkMessage = { msgtype: 'text', text: { content: 'hello' } }

    it('发送成功 (errcode=0)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const result = await sendWechatWork(config, msg)
      expect(result.ok).toBe(true)
      expect(result.error).toBeUndefined()
      expect(fetchMock).toHaveBeenCalledOnce()
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toContain('qyapi.weixin.qq.com/cgi-bin/webhook/send')
      expect(init.method).toBe('POST')
    })

    it('发送失败 (errcode=93000 invalid webhook url)', async () => {
      fetchMock.mockResolvedValueOnce(
        makeResponse({ errcode: 93000, errmsg: 'invalid webhook url' }),
      )
      const result = await sendWechatWork(config, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('93000')
      expect(result.error).toContain('invalid webhook url')
    })

    it('未配置 webhookUrl 返回失败', async () => {
      const result = await sendWechatWork({ channel: 'wechat' }, msg)
      expect(result.ok).toBe(false)
      expect(result.error).toContain('webhookUrl')
    })
  })

  // ===================== 网络超时 =====================
  describe('网络超时', () => {
    it('fetch 抛 AbortError 时返回失败', async () => {
      const abortError = new Error('The operation was aborted')
      abortError.name = 'AbortError'
      fetchMock.mockRejectedValueOnce(abortError)
      const config: ChannelConfig = {
        channel: 'dingtalk',
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
      }
      const result = await sendDingtalk(config, { msgtype: 'text', text: { content: 'x' } })
      expect(result.ok).toBe(false)
      expect(result.error).toContain('aborted')
    })
  })

  // ===================== 统一入口路由 =====================
  describe('sendWebhookNotification 路由', () => {
    it('channel=dingtalk 路由到 sendDingtalk(text)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const config: ChannelConfig = {
        channel: 'dingtalk',
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
      }
      const result = await sendWebhookNotification(config, '内容')
      expect(result.ok).toBe(true)
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.msgtype).toBe('text')
      expect(body.text.content).toBe('内容')
    })

    it('channel=dingtalk 传 title 时使用 markdown', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const config: ChannelConfig = {
        channel: 'dingtalk',
        webhookUrl: 'https://oapi.dingtalk.com/robot/send?access_token=xxx',
      }
      await sendWebhookNotification(config, '正文', '标题')
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.msgtype).toBe('markdown')
      expect(body.markdown.title).toBe('标题')
      expect(body.markdown.text).toBe('正文')
    })

    it('channel=feishu 路由到 sendFeishu', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ StatusCode: 0, StatusMessage: 'success' }))
      const config: ChannelConfig = {
        channel: 'feishu',
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
      }
      const result = await sendWebhookNotification(config, '飞书内容')
      expect(result.ok).toBe(true)
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.msg_type).toBe('text')
      expect(body.content.text).toBe('飞书内容')
    })

    it('channel=feishu 传 title 时 content 拼接标题', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ StatusCode: 0, StatusMessage: 'success' }))
      const config: ChannelConfig = {
        channel: 'feishu',
        webhookUrl: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
      }
      await sendWebhookNotification(config, '飞书正文', '飞书标题')
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.content.text).toContain('飞书标题')
      expect(body.content.text).toContain('飞书正文')
    })

    it('channel=wechat 路由到 sendWechatWork(text)', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const config: ChannelConfig = {
        channel: 'wechat',
        webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
      }
      const result = await sendWebhookNotification(config, '企微内容')
      expect(result.ok).toBe(true)
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.msgtype).toBe('text')
      expect(body.text.content).toBe('企微内容')
    })

    it('channel=wechat 传 title 时使用 markdown', async () => {
      fetchMock.mockResolvedValueOnce(makeResponse({ errcode: 0, errmsg: 'ok' }))
      const config: ChannelConfig = {
        channel: 'wechat',
        webhookUrl: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx',
      }
      await sendWebhookNotification(config, '企微正文', '企微标题')
      const [, init] = fetchMock.mock.calls[0]
      const body = JSON.parse(init.body as string)
      expect(body.msgtype).toBe('markdown')
      expect(body.markdown.content).toContain('企微标题')
      expect(body.markdown.content).toContain('企微正文')
    })

    it('channel=sms 拒绝(非 webhook 通道)', async () => {
      const config: ChannelConfig = { channel: 'sms' }
      const result = await sendWebhookNotification(config, '内容')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('sms')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('channel=email 拒绝(非 webhook 通道)', async () => {
      const config: ChannelConfig = { channel: 'email' }
      const result = await sendWebhookNotification(config, '内容')
      expect(result.ok).toBe(false)
      expect(result.error).toContain('email')
      expect(fetchMock).not.toHaveBeenCalled()
    })
  })
})
