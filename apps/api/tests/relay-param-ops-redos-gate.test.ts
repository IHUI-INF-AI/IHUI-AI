// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 安全强化第 16 批(2026-10-31)修复钉住:relay-param-ops 配置型正则 ReDoS 闸。
 *
 * 背景:ops 配置来自管理面写入 DB,regex_replace 在转发热路径每请求同步执行 ——
 * 配置型正则的"存储型 ReDoS"放大面。闸的两道:入库校验(长度 + flags 白名单)与
 * 运行时(超长 pattern/被替换串跳过该 op)。长度常量与 webhooks-trigger/rules/
 * workspace-ai 同口径(单源 import)。
 */

import { describe, it, expect } from 'vitest'
import { applyParamOps, validateParamOps } from '../src/services/relay-param-ops.js'

const CONTEXT = { apiKeyId: 'k1', userId: 'u1' } as never

function regexOp(pattern: string, flags = '', replacement = 'X') {
  return { op: 'regex_replace', path: 'body.note', pattern, flags, replacement }
}

describe('relay-param-ops regex 入库闸(第 16 批)', () => {
  it('超长 pattern 被拒(200 上限)', () => {
    const result = validateParamOps([regexOp('a'.repeat(201))])
    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('ReDoS gate')
  })

  it('200 以内正常放行', () => {
    const result = validateParamOps([regexOp('a'.repeat(200))])
    expect(result.valid).toBe(true)
  })

  it('非法 flags 被拒(白名单 gimsuy)', () => {
    const result = validateParamOps([regexOp('abc', 'gi;process')])
    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('invalid regex flags')
  })

  it('合法 flags 放行', () => {
    const result = validateParamOps([regexOp('abc', 'gim')])
    expect(result.valid).toBe(true)
  })
})

describe('relay-param-ops regex 运行闸(第 16 批)', () => {
  it('超长 pattern 在运行时跳过该 op(不执行正则,原样返回)', () => {
    const request = { body: { note: 'hello' } }
    const result = applyParamOps(
      request,
      [regexOp('a'.repeat(201), '', 'X')] as never,
      CONTEXT,
    )
    expect(result.modified).toBe(false)
    expect((result.request as { body: { note: string } }).body.note).toBe('hello')
  })

  it('被替换串超长跳过 regex op(不给回溯机会)', () => {
    const request = { body: { note: 'a'.repeat(10 * 1024 + 1) } }
    const result = applyParamOps(request, [regexOp('(a+)+$', '', 'X')] as never, CONTEXT)
    expect(result.modified).toBe(false)
  })

  it('正向对照:正常 regex 行为不变', () => {
    const request = { body: { note: 'hello world' } }
    const result = applyParamOps(request, [regexOp('world', '', 'there')] as never, CONTEXT)
    expect(result.modified).toBe(true)
    expect((result.request as { body: { note: string } }).body.note).toBe('hello there')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
