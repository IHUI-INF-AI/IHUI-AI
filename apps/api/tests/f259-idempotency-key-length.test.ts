// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-259:幂等键超 200 字符曾被静默截断 —— 前 200 字符相同的两个不同请求折进同一槽位,
 * 前者被回放/后者得 409,且无任何告警。超长必须按"没带"处理,绝不截断。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
})

import {
  MAX_CLIENT_KEY_LEN,
  MIN_CLIENT_KEY_LEN,
  readIdempotencyKey,
} from '../src/services/run-idempotency.js'

describe('F-259 超长幂等键不截断', () => {
  it('恰好上限长度原样返回', () => {
    const key = 'k'.repeat(MAX_CLIENT_KEY_LEN)
    expect(readIdempotencyKey({ 'idempotency-key': key })).toBe(key)
  })

  it('超一个字符即视为没带(不截断)', () => {
    expect(readIdempotencyKey({ 'idempotency-key': 'k'.repeat(MAX_CLIENT_KEY_LEN + 1) })).toBeNull()
  })

  it('前 200 字符相同的两个长键都落空 ⇒ 不可能撞进同一槽位', () => {
    const shared = 'a'.repeat(MAX_CLIENT_KEY_LEN)
    const a = `${shared}x`
    const b = `${shared}y`
    expect(readIdempotencyKey({ 'idempotency-key': a })).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': b })).toBeNull()
  })

  it('下限仍然生效', () => {
    expect(readIdempotencyKey({ 'idempotency-key': 'k'.repeat(MIN_CLIENT_KEY_LEN - 1) })).toBeNull()
    expect(readIdempotencyKey({ 'idempotency-key': ` ${'k'.repeat(MIN_CLIENT_KEY_LEN)} ` })).toBe(
      'k'.repeat(MIN_CLIENT_KEY_LEN),
    )
  })
})

describe('F-259 三条读键路径都不许 slice', () => {
  it('run-idempotency / open-idempotency / capability-guard 均无静默截断', () => {
    const files = [
      '../src/services/run-idempotency.ts',
      '../src/plugins/open-idempotency.ts',
      '../src/utils/capability-guard.ts',
    ]
    for (const rel of files) {
      const src = readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf-8')
      expect(src).not.toMatch(/.slice\(0, MAX_CLIENT_KEY_LEN\)/)
      expect(src).not.toMatch(/.slice\(0, 200\)/)
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
