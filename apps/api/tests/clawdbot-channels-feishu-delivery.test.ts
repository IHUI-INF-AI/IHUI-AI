// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​

/**
 * G-815928 回归:clawdbot channels 的 feishu 投递判定收口到 interpretPlatformResponse。
 *
 * 阳性对照原则:核心用例(200 + code≠0 ⇒ 不得记成已投递)在「去掉判定、退回旧写法
 * 只看 resp.ok」时必红 —— 旧写法会把 HTTP 200 的业务拒绝记成已投递(sendMessage=true)。
 * 零连接:网络用注入的假 fetch,凭证走 ChannelConfig.config,不读环境变量(§5 隔离铁律)。
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../src/services/clawdbot/logger.js', () => ({
  logger: { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { ChannelManager } from '../src/services/clawdbot/channels.js'
import type { ChannelConfig } from '../src/services/clawdbot/channels.js'

/** 按调用次序回放预设响应的假 fetch(第 1 次=token,第 2 次=im/messages)。 */
function scriptedFeishuFetch(responses: Array<{ status: number; body: unknown }>): {
  fetch: typeof globalThis.fetch
  calls: Array<string>
} {
  const calls: Array<string> = []
  let i = 0
  const fetch = vi.fn((input: string | URL | Request) => {
    calls.push(String(input instanceof Request ? input.url : input))
    const r = responses[Math.min(i, responses.length - 1)]
    i += 1
    return Promise.resolve(
      new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  }) as unknown as typeof globalThis.fetch
  return { fetch, calls }
}

function feishuChannel(): ChannelConfig {
  return {
    id: 'ch-feishu',
    type: 'feishu',
    name: 'Feishu',
    enabled: true,
    config: { appId: 'cli_app', appSecret: 'secret', receiveId: 'oc_chat', receiveIdType: 'chat_id' },
  }
}

function tokenResponse(): { status: number; body: unknown } {
  return { status: 200, body: { code: 0, msg: 'ok', tenant_access_token: 't-token' } }
}

describe('G-815928 feishu 投递判定走 interpretPlatformResponse', () => {
  let mgr: ChannelManager

  beforeEach(() => {
    mgr = new ChannelManager()
    mgr.register(feishuChannel())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('feishu 回 200 + code!=0 ⇒ 不得记成已投递(sendMessage=false)', async () => {
    // 阳性对照:去掉 interpretPlatformResponse 判定(退回旧写法只判 resp.ok)本用例必红 ——
    // 旧写法看到 HTTP 200 就记成已投递,而飞书 2xx 仍可能业务拒绝(im-outbound-policy.ts
    // 判红一型:feishuProvider.ts:1183 同型)。status 必须归到 business-rejected 档。
    const { fetch, calls } = scriptedFeishuFetch([
      tokenResponse(),
      { status: 200, body: { code: 99991663, msg: 'invalid tenant access token' } },
    ])
    vi.stubGlobal('fetch', fetch)
    const onFailed = vi.fn()
    mgr.on('sendFailed', onFailed)

    const ok = await mgr.sendMessage('ch-feishu', 'hello')

    expect(ok).toBe(false)
    expect(calls[1]).toContain('/im/v1/messages')
    expect(onFailed).toHaveBeenCalledTimes(1)
    const err = onFailed.mock.calls[0][0].err as Error
    expect(err.message).toContain('business-rejected')
    expect(err.message).toContain('code=99991663')
  })

  it('feishu 回 200 + code=0 + data.message_id ⇒ 记成已投递(sendMessage=true)', async () => {
    // 反向对照:判定收紧后,正常回执路径不得被误杀。
    const { fetch } = scriptedFeishuFetch([
      tokenResponse(),
      { status: 200, body: { code: 0, msg: 'success', data: { message_id: 'om_123' } } },
    ])
    vi.stubGlobal('fetch', fetch)

    const ok = await mgr.sendMessage('ch-feishu', 'hello')

    expect(ok).toBe(true)
  })

  it('feishu 回 200 + code=0 但未回 message_id ⇒ 不得记成已投递(no-receipt)', async () => {
    // im-outbound-policy.ts 判红第二型:code=0 但拿不到回执,记成功等于伪造证据。
    const { fetch } = scriptedFeishuFetch([
      tokenResponse(),
      { status: 200, body: { code: 0, msg: 'success' } },
    ])
    vi.stubGlobal('fetch', fetch)

    const ok = await mgr.sendMessage('ch-feishu', 'hello')

    expect(ok).toBe(false)
  })
})
// ⁠​‌​​
