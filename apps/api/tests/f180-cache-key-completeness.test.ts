// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-180:响应缓存键只喂 model/messages/temperature/max_tokens,
 * top_p/seed/response_format 不同仍命中同一缓存;且用原始 messages 而非注入 json_schema 的 upstreamMessages。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.REDIS_URL ??= 'redis://localhost:6379'
  process.env.JWT_SECRET ??= 'test-jwt-secret-with-enough-length'
})

import { computeCacheKey } from '../src/services/relay-response-cache.js'

const base = {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'hi' }],
  temperature: 0.3,
  max_tokens: 512,
}

describe('F-180 缓存键覆盖全部影响输出的参数', () => {
  it('top_p / seed / response_format 任一不同 ⇒ 不同键', () => {
    const plain = computeCacheKey(base)
    expect(computeCacheKey({ ...base, top_p: 0.9 })).not.toBe(plain)
    expect(computeCacheKey({ ...base, seed: 123 })).not.toBe(plain)
    expect(
      computeCacheKey({
        ...base,
        response_format: { type: 'json_schema', json_schema: { name: 'x', schema: {} } },
      }),
    ).not.toBe(plain)
  })

  it('messages 注入 json_schema 提示后与纯文本请求不得互撞', () => {
    const plain = computeCacheKey(base)
    const injected = computeCacheKey({
      ...base,
      messages: [
        { role: 'system', content: '你必须输出符合 schema 的 JSON' },
        ...base.messages,
      ],
    })
    expect(injected).not.toBe(plain)
  })

  it('v1-public 调用点使用 upstreamMessages 与全部参数(而非原始 messages/四字段)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../src/routes/v1-public.ts', import.meta.url)),
      'utf-8',
    )
    const callSite = src.slice(src.indexOf('cacheKey = computeCacheKey({') )
    const block = callSite.slice(0, callSite.indexOf('})') + 2)
    expect(block).toContain('messages: upstreamMessages as CacheableMessage[]')
    expect(block).toContain('seed: upstreamSeed')
    expect(block).toContain('response_format: upstreamResponseFormat')
    expect(block).toContain('top_p,')
    expect(block).toContain('presence_penalty,')
    expect(block).toContain('frequency_penalty,')
    expect(block).not.toContain('messages: messages as CacheableMessage[]')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
