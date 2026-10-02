// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
/**
 * G-816023 回归:CLI 遥测漏斗接 URL 凭据段剥离(stripUrlCredentialSegments,shared 唯一出口)。
 *
 * 票面验收:"送出的 url 不含 query"。判据面:
 *  ① 带凭据的 URL 值(userinfo + query + hash)出漏斗后只剩 scheme://host+path;
 *  ② 非 URL 字符串(如 Windows 工作区路径)逐字不变 —— 剥离不得误伤普通路径;
 *  ③ 嵌套对象/数组里的 URL 同样被剥(漏斗递归语义);
 *  ④ 敏感 key 的整值 REDACT 语义不变(两道闸共存,不互踩)。
 */
import { describe, expect, it, vi } from 'vitest'

import { redactSensitive, TelemetryClient } from '../src/telemetry/index.js'

function createMockFetch(ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as unknown as Response)
}

describe('G-816023 遥测漏斗 URL 凭据剥离', () => {
  it('trackEvent 出站载荷里的带凭据 URL 不含 userinfo/query/hash(票面验收)', async () => {
    const fetchFn = createMockFetch(true, 200)
    const client = new TelemetryClient({
      enabled: true,
      endpoint: 'https://example.com/v1/telemetry/ingest',
      fetchImpl: fetchFn,
      batchSize: 100,
    })
    client.trackEvent('session_start', {
      url: 'https://user:secret@host.example.com/p?token=abc&x=1#frag',
    })
    await client.flush()

    const body = JSON.parse((fetchFn.mock.calls[0]![1] as RequestInit).body as string)
    expect(body.events[0].props.url).toBe('https://host.example.com/p')
    expect(body.events[0].props.url).not.toContain('secret')
    expect(body.events[0].props.url).not.toContain('token=abc')
    expect(body.events[0].props.url).not.toContain('#frag')
  })

  it('非 URL 字符串(Windows 工作区路径)逐字不变', () => {
    const out = redactSensitive({ workspacePath: 'G:\\IHUI-AI\\apps\\cli' })
    expect(out).toEqual({ workspacePath: 'G:\\IHUI-AI\\apps\\cli' })
  })

  it('嵌套对象/数组里的 URL 同样被剥', () => {
    const out = redactSensitive({
      meta: {
        refs: ['http://u:p@h1.example.com/a?k=v', 'plain/path'],
      },
    })
    expect(out).toEqual({ meta: { refs: ['http://h1.example.com/a', 'plain/path'] } })
  })

  it('敏感 key 整值 REDACT 语义不变(两道闸共存)', () => {
    const out = redactSensitive({ apiKey: 'https://u:p@h/x?q=1', url: 'https://u:p@h/x?q=1' })
    expect(out).toEqual({ apiKey: '[REDACTED]', url: 'https://h/x' })
  })
})
