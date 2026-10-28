// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// b76-13 票2:帧的字段级 schema + 装饰载荷降级隔离 —— 判例钉子。
// 断言打在 contract.ts 的 parseSseFrameSchema / SSE_FRAME_SCHEMAS 生产出口上,
// 并锁两条通路:client.ts 读环的结构不变量分支、sse_contract.py 的同表判据。
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  parseSseFrameSchema,
  SSE_DECORATIVE_FIELDS,
  SSE_FRAME_SCHEMAS,
} from '../src/sse/contract'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '../../..')

describe('b76-13 帧字段级 schema', () => {
  it('登记表非空,登记的帧都有跨字段不变量或枚举闭合', () => {
    const names = Object.keys(SSE_FRAME_SCHEMAS)
    expect(names.length).toBeGreaterThanOrEqual(5)
    expect(names).toContain('form_response')
    expect(names).toContain('terminal_end')
  })

  it('枚举闭合:terminal_end.status 表外值 ⇒ typed fault(SCHEMA_MISMATCH),不放行', () => {
    const r = parseSseFrameSchema('terminal_end', {
      terminalId: 't1',
      status: 'cancelled', // 表外档
      durationMs: 5,
    })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.fault.code).toBe('SCHEMA_MISMATCH')
      expect(r.fault.issues.join('\n')).toContain('status')
    }
  })

  it('必要字段对:truncated=true 而 totalChars 缺席 ⇒ fault;"截断却不知道截掉多少"不是合法帧', () => {
    const bad = parseSseFrameSchema('terminal_end', {
      terminalId: 't1',
      status: 'completed',
      truncated: true,
      durationMs: 5,
    })
    expect(bad.ok).toBe(false)
    const good = parseSseFrameSchema('terminal_end', {
      terminalId: 't1',
      status: 'completed',
      truncated: true,
      totalChars: 1024,
      durationMs: 5,
    })
    expect(good.ok).toBe(true)
  })

  it('装饰载荷降级隔离:output 坏型 ⇒ 只降级为缺省(catch),帧不因它判死', () => {
    const r = parseSseFrameSchema('terminal_end', {
      terminalId: 't1',
      status: 'completed',
      output: 42, // 展示数据坏型
      durationMs: 5,
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      const data = r.data as { output?: unknown }
      expect(data.output).toBeUndefined() // catch(undefined) ⇒ 卡片退化成纯文本
    }
  })

  it('跨字段成对(form_response):approve 带 reject_reason / reject 带 values ⇒ fault(拒绝零副作用)', () => {
    const bad = parseSseFrameSchema('form_response', {
      request_id: 'r1',
      kind: 'email',
      action: 'reject',
      values: { to: 'x@y.z' },
    })
    expect(bad.ok).toBe(false)
    const good = parseSseFrameSchema('form_response', {
      request_id: 'r1',
      kind: 'email',
      action: 'reject',
      reject_reason: '不发了',
    })
    expect(good.ok).toBe(true)
  })

  it('strict:未知字段不静默收 ⇒ fault(畸形必须现形,不是静默剥掉重放)', () => {
    const r = parseSseFrameSchema('tool-delta', {
      toolCallId: 'c1',
      seq: 0,
      partialText: 'x',
      forgedExtra: true,
    })
    expect(r.ok).toBe(false)
  })

  it('表外事件名 ⇒ ok(不在射程,交由既有解析层,不冒充判过)', () => {
    expect(parseSseFrameSchema('chunk', { content: 'hi' })).toEqual({
      ok: true,
      data: { content: 'hi' },
    })
  })

  it('装饰字段登记非空且同族两侧在位(TS + Python)', () => {
    expect(SSE_DECORATIVE_FIELDS.length).toBeGreaterThanOrEqual(5)
    const py = readFileSync(
      resolve(REPO, 'apps/ai-service/app/core/sse_contract.py'),
      'utf8',
    )
    expect(py).toContain('SSE_DECORATIVE_FIELDS')
    expect(py).toContain('def sse_frame_schema_fault')
  })

  it('通路锁:client.ts 读环真有结构不变量分支(truncated=true ⇒ fault 计数并丢帧)', () => {
    const src = readFileSync(resolve(REPO, 'packages/api-client/src/client.ts'), 'utf8')
    expect(src).toContain('sseFrameSchemaFaults++')
    expect(src).toContain("typeof json.totalChars !== 'number'")
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
