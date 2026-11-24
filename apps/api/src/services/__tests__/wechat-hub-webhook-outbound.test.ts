// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import {
  buildOutboundWebhookRequest,
  normalizeOutboundWebhookUrl,
  signOutboundWebhook,
} from '../wechat-hub/webhook-outbound'

describe('normalizeOutboundWebhookUrl', () => {
  it('接受公网 HTTPS，去掉 fragment 和首尾空格', () => {
    expect(normalizeOutboundWebhookUrl(' https://hooks.example.com/wechat#section ')).toBe(
      'https://hooks.example.com/wechat',
    )
  })

  it('空串表示关闭', () => {
    expect(normalizeOutboundWebhookUrl('   ')).toBe('')
  })

  it('拒绝非 HTTPS 和带账号密码的地址', () => {
    expect(() => normalizeOutboundWebhookUrl('http://hooks.example.com')).toThrow('必须使用 HTTPS')
    expect(() => normalizeOutboundWebhookUrl('https://user:pass@hooks.example.com')).toThrow(
      '不允许在 URL 里带账号密码',
    )
  })

  it.each([
    'https://localhost/hook',
    'https://127.0.0.1/hook',
    'https://10.0.0.1/hook',
    'https://172.16.0.1/hook',
    'https://192.168.1.1/hook',
    'https://169.254.169.254/latest/meta-data',
    'https://100.64.0.1/hook',
    'https://[::1]/hook',
    'https://[fd00::1]/hook',
  ])('拒绝本机/内网地址 %s', (url) => {
    expect(() => normalizeOutboundWebhookUrl(url)).toThrow('不允许指向本机或内网地址')
  })

  it('允许公网 IPv4 与非本机域名', () => {
    expect(normalizeOutboundWebhookUrl('https://8.8.8.8/hook')).toBe('https://8.8.8.8/hook')
    expect(normalizeOutboundWebhookUrl('https://example.com/hook')).toBe('https://example.com/hook')
  })
})

describe('buildOutboundWebhookRequest', () => {
  it('用 timestamp + 原始 body 做 HMAC-SHA256 签名', () => {
    const request = buildOutboundWebhookRequest(
      { type: 'wechat.inbound', n: 1 },
      'secret',
      1_700_000_000_000,
    )
    expect(request.headers['x-ihui-event']).toBe('wechat.inbound')
    expect(request.headers['x-ihui-timestamp']).toBe('1700000000000')
    expect(request.headers['x-ihui-signature']).toBe(
      `sha256=${signOutboundWebhook('secret', '1700000000000', request.body)}`,
    )
    expect(JSON.parse(request.body)).toEqual({ type: 'wechat.inbound', n: 1 })
  })

  it('没有 secret 时不带签名头', () => {
    const request = buildOutboundWebhookRequest({ ok: true }, null, 1)
    expect(request.headers['x-ihui-signature']).toBeUndefined()
    expect(JSON.parse(request.body)).toEqual({ ok: true })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
