import { describe, it, expect } from 'vitest'

import { parsePendingQuestion } from '../pending-question'

describe('parsePendingQuestion', () => {
  /** 合法 pendingQuestion 数据 */
  const valid = {
    questionId: 'q-1',
    prompt: '请选择一种方式',
    options: [
      { id: 'a', label: '选项A' },
      { id: 'b', label: '选项B' },
    ],
    allowCustom: true,
    allowMultiple: false,
  }

  it('合法数据 → 返回 PendingQuestion', () => {
    const result = parsePendingQuestion(valid)
    expect(result).toEqual(valid)
  })

  it('带可选 assistantMessageId → 返回时保留该字段', () => {
    const result = parsePendingQuestion({ ...valid, assistantMessageId: 'msg-1' })
    expect(result).toEqual({ ...valid, assistantMessageId: 'msg-1' })
  })

  it('options 默认空数组时仍合法', () => {
    const result = parsePendingQuestion({ ...valid, options: [] })
    expect(result).toEqual({ ...valid, options: [] })
  })

  it('null → 返回 null(无挂起提问)', () => {
    expect(parsePendingQuestion(null)).toBeNull()
  })

  it('undefined → 返回 null', () => {
    expect(parsePendingQuestion(undefined)).toBeNull()
  })

  it('空对象 → 返回 null(缺所有必填字段)', () => {
    expect(parsePendingQuestion({})).toBeNull()
  })

  it('缺 questionId → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, questionId: undefined })).toBeNull()
  })

  it('缺 prompt → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, prompt: undefined })).toBeNull()
  })

  it('缺 allowCustom → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, allowCustom: undefined })).toBeNull()
  })

  it('缺 allowMultiple → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, allowMultiple: undefined })).toBeNull()
  })

  it('allowCustom 类型错误(string 而非 boolean) → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, allowCustom: 'true' })).toBeNull()
  })

  it('options 类型错误(string 而非 array) → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, options: 'not-an-array' })).toBeNull()
  })

  it('options 内部元素缺 label → 返回 null', () => {
    expect(
      parsePendingQuestion({
        ...valid,
        options: [{ id: 'a' }], // 缺 label
      }),
    ).toBeNull()
  })

  it('options 内部元素 id 类型错误(number 而非 string) → 返回 null', () => {
    expect(
      parsePendingQuestion({
        ...valid,
        options: [{ id: 123, label: '选项A' }],
      }),
    ).toBeNull()
  })

  it('questionId 类型错误(number 而非 string) → 返回 null', () => {
    expect(parsePendingQuestion({ ...valid, questionId: 123 })).toBeNull()
  })

  it('额外字段不影响校验(允许 schema 未声明的字段通过)', () => {
    // Zod 默认不剥离额外字段,但 safeParse 仍判定为成功
    const result = parsePendingQuestion({ ...valid, extra: 'unknown-field' })
    expect(result).toEqual(valid) // 注:result.data 不含 extra(zodSchema 默认不剥离,但类型断言只取 schema 字段)
  })
})
