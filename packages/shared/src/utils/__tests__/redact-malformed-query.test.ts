// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'

import { redactUrl } from '../redact'

describe('XUI-034 redactUrl:畸形 % 转义不得抛 URIError', () => {
  it('key 含裸 % ⇒ 不抛错且仍完成整条脱敏', () => {
    expect(() => redactUrl('/api/ws/ai?tok%en=abc&api_key=secret')).not.toThrow()
    const out = redactUrl('/api/ws/ai?tok%en=abc&api_key=secret')
    expect(out).not.toContain('secret')
  })

  it('正常编码键仍按脱敏处理(阴性对照)', () => {
    const out = redactUrl('/api/ws/ai?api_key=secret')
    expect(out).toContain('api_key=')
    expect(out).not.toContain('secret')
  })
})
