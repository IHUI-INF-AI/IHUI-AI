// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  scrubbedUrlAttributes,
  shouldIgnoreIncomingRequest,
} from '../src/plugins/otel.js'

/**
 * F-606 回归锁(2026-11-13)。
 *
 * 病灶:`@opentelemetry/instrumentation-http` 的入站 span 会把 `url.path`/`url.query`
 * (以及旧口径的 `http.target`/`url.full`)原样导出,而 `/api/ws/ai?token=<WS 票>`、
 * `/v1/realtime?api_key=<key>` 的凭据就在 query 里 ⇒ 长期 api_key 与 5 分钟 WS 票
 * 落进 trace 存储,有 collector 读权限者可重放。
 *
 * 本文件锁(纯函数,不启动真实 SDK):
 *   ① `/api/ws/ai?token=…` 处理后的属性里不含 token;
 *   ② `/v1/realtime?api_key=…` 被 ignore 钩子忽略,且属性里不含 api_key;
 *   ③ 普通路径剥掉 query 后 path 原样保留(排障信息不缩水)。
 */
describe('F-606 OTel http 插桩不得导出带凭据的 query', () => {
  it('① /api/ws/ai?token=abc 的属性里不含 token,path 保留', () => {
    const attrs = scrubbedUrlAttributes('/api/ws/ai?token=abc')

    expect(JSON.stringify(attrs)).not.toContain('abc')
    expect(JSON.stringify(attrs)).not.toContain('token')
    expect(attrs['url.path']).toBe('/api/ws/ai')
    expect(attrs['http.target']).toBe('/api/ws/ai')
    expect(attrs['url.query']).toBe('')
  })

  it('② /v1/realtime?api_key=k 整条跳过,且属性里不含 api_key', () => {
    expect(shouldIgnoreIncomingRequest('/v1/realtime?api_key=k')).toBe(true)
    expect(shouldIgnoreIncomingRequest('/api/ws/ai?token=abc')).toBe(true)

    const attrs = scrubbedUrlAttributes('/v1/realtime?api_key=k')
    expect(JSON.stringify(attrs)).not.toContain('api_key')
    expect(attrs['url.path']).toBe('/v1/realtime')
    expect(attrs['url.query']).toBe('')
  })

  it('③ 普通路径:剥掉 query,path 原样保留', () => {
    expect(shouldIgnoreIncomingRequest('/api/health/ready?probe=1')).toBe(false)

    const attrs = scrubbedUrlAttributes('/api/health/ready?probe=1&token=secret')
    expect(JSON.stringify(attrs)).not.toContain('secret')
    expect(JSON.stringify(attrs)).not.toContain('probe=1')
    expect(attrs['url.path']).toBe('/api/health/ready')
    expect(attrs['http.target']).toBe('/api/health/ready')
    expect(attrs['url.query']).toBe('')
  })

  it('无 URL 时退化为根路径,不抛错', () => {
    expect(shouldIgnoreIncomingRequest(undefined)).toBe(false)
    expect(scrubbedUrlAttributes(undefined)['url.path']).toBe('/')
  })
})
