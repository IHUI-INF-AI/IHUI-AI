import { describe, it, expect, vi, afterEach } from 'vitest'

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

  // 静默 console.warn(非法数据 case 会触发 dev-only warn)
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  afterEach(() => {
    warnSpy.mockClear()
  })

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

  it('null → 返回 null(无挂起提问,静默不 warn)', () => {
    expect(parsePendingQuestion(null)).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('undefined → 返回 null(静默不 warn)', () => {
    expect(parsePendingQuestion(undefined)).toBeNull()
    expect(warnSpy).not.toHaveBeenCalled()
  })

  it('空对象 → 返回 null(缺所有必填字段,触发 warn)', () => {
    expect(parsePendingQuestion({})).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('缺 questionId → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, questionId: undefined })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('缺 prompt → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, prompt: undefined })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('缺 allowCustom → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, allowCustom: undefined })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('缺 allowMultiple → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, allowMultiple: undefined })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('allowCustom 类型错误(string 而非 boolean) → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, allowCustom: 'true' })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('options 类型错误(string 而非 array) → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, options: 'not-an-array' })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('options 内部元素缺 label → 返回 null(触发 warn)', () => {
    expect(
      parsePendingQuestion({
        ...valid,
        options: [{ id: 'a' }], // 缺 label
      }),
    ).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('options 内部元素 id 类型错误(number 而非 string) → 返回 null(触发 warn)', () => {
    expect(
      parsePendingQuestion({
        ...valid,
        options: [{ id: 123, label: '选项A' }],
      }),
    ).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('questionId 类型错误(number 而非 string) → 返回 null(触发 warn)', () => {
    expect(parsePendingQuestion({ ...valid, questionId: 123 })).toBeNull()
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('额外字段被 Zod strip 默认剥离(不影响校验)', () => {
    // Zod object schema 默认 strip 模式:未知字段被移除,result.data 只含 schema 声明的字段
    const result = parsePendingQuestion({ ...valid, extra: 'unknown-field' })
    expect(result).toEqual(valid)
    expect(result).not.toHaveProperty('extra')
  })

  it('warn 消息包含 Zod error issues + 原始 data(辅助调试)', () => {
    parsePendingQuestion({ questionId: 'q-1' }) // 缺多个必填字段
    expect(warnSpy).toHaveBeenCalledTimes(1)
    const warnCall = warnSpy.mock.calls[0]!
    // warnCall 结构:[message, zodIssues, data]
    expect(warnCall[0]).toContain('parsePendingQuestion')
    expect(Array.isArray(warnCall[1])).toBe(true) // Zod error issues 数组
    expect(warnCall[2]).toEqual({ questionId: 'q-1' }) // 原始 data
  })
})
