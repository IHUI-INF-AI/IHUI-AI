// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// G-661 分键纪律断言(2026-09-30 立):推断值不得混进原样字段 ——
// 喂模板名 ⇒ 推断值只住 inferredPattern,渲染面 declaredPattern 读 undefined(不读伪造字面量);
// 有原样 ⇒ 读到真 pattern;空串/占位 ⇒ undefined 而非 '';provider 可见面永不携带推断键。
import { describe, expect, it } from 'vitest'

import { projectShapeDescriptor } from '../src/schema-projection'

import {
  declaredPattern,
  inferPatternFromTemplateName,
  inferredPatternOf,
} from '../src/tool-contract'

import type { ToolShapeDescriptor } from '../src/tool-contract'

describe('G-661 · declaredPattern 只读原样,取不到返回 undefined 而非伪造', () => {
  it('有原样 pattern ⇒ 渲染面读到真 pattern', () => {
    const descriptor: ToolShapeDescriptor = { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' }
    expect(declaredPattern(descriptor)).toBe('^\\d{4}-\\d{2}-\\d{2}$')
  })

  it('无形状 ⇒ undefined,不是空串', () => {
    expect(declaredPattern(undefined)).toBeUndefined()
    expect(declaredPattern(null)).toBeUndefined()
    expect(declaredPattern({ type: 'string' })).toBeUndefined()
    expect(declaredPattern({ type: 'string', pattern: '' })).toBeUndefined()
    expect(declaredPattern({ type: 'string', pattern: '   ' })).toBeUndefined()
  })

  it('占位 pattern 算伪造 ⇒ undefined', () => {
    expect(declaredPattern({ type: 'string', pattern: '__PATTERN__' })).toBeUndefined()
    expect(declaredPattern({ type: 'string', pattern: '<pattern>' })).toBeUndefined()
    expect(declaredPattern({ type: 'string', pattern: 'TODO' })).toBeUndefined()
    expect(declaredPattern({ type: 'string', pattern: '...' })).toBeUndefined()
  })
})

describe('G-661 · 喂模板名 ⇒ 推断值只住 inferredPattern,渲染面不读伪造字面量', () => {
  it('显式推断出口返回推断值;表外名字 ⇒ undefined,绝不现场猜', () => {
    expect(inferPatternFromTemplateName('date-iso')).toBe('^\\d{4}-\\d{2}-\\d{2}$')
    expect(inferPatternFromTemplateName('  UUID  ')).toBe(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    )
    expect(inferPatternFromTemplateName('no-such-template')).toBeUndefined()
    expect(inferPatternFromTemplateName('')).toBeUndefined()
  })

  it('推断值写进 inferredPattern 分键 ⇒ 渲染面 declaredPattern 读 undefined,显式出口才读得到', () => {
    const inferred = inferPatternFromTemplateName('uuid')
    if (inferred === undefined) throw new Error('uuid 模板必须命中推断表')
    const descriptor: ToolShapeDescriptor = { type: 'string', inferredPattern: inferred }
    expect(declaredPattern(descriptor)).toBeUndefined()
    expect(inferredPatternOf(descriptor)).toBe(inferred)
  })

  it('原样与推断并存 ⇒ 两个出口各回各键,不串档', () => {
    const descriptor: ToolShapeDescriptor = {
      type: 'string',
      pattern: '^REAL$',
      inferredPattern: '^guess$',
    }
    expect(declaredPattern(descriptor)).toBe('^REAL$')
    expect(inferredPatternOf(descriptor)).toBe('^guess$')
  })
})

describe('G-661 · provider 可见面绝不携带推断键', () => {
  it('投影只发射原样 pattern,inferredPattern 不出描述符', () => {
    const out = projectShapeDescriptor({
      type: 'string',
      pattern: '^REAL$',
      inferredPattern: '^guess$',
    })
    expect(out['pattern']).toBe('^REAL$')
    expect('inferredPattern' in out).toBe(false)
  })

  it('无原样只有推断 ⇒ 投影输出连 pattern 键都没有(不下发伪造)', () => {
    const out = projectShapeDescriptor({ type: 'string', inferredPattern: '^guess$' })
    expect('pattern' in out).toBe(false)
    expect('inferredPattern' in out).toBe(false)
  })
})
