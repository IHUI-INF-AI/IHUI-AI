import { describe, expect, it } from 'vitest'
import {
  askSchema,
  EMPTY_ASK_FORM,
  ASK_STATUS_VALUES,
  type AskFormValues,
} from './ask'

describe('askSchema', () => {
  it('合法值通过校验', () => {
    const r = askSchema.safeParse({
      title: '如何配置',
      content: '请描述你的问题',
      tags: 'frontend, vue, react',
      status: 1,
      isResolved: false,
    })
    expect(r.success).toBe(true)
  })

  it('空 title 触发 required', () => {
    const r = askSchema.safeParse({
      title: '',
      content: 'c',
      tags: '',
      status: 1,
      isResolved: false,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('title') && i.message === 'required')).toBe(true)
    }
  })

  it('空 content 触发 required', () => {
    const r = askSchema.safeParse({
      title: 't',
      content: '',
      tags: '',
      status: 1,
      isResolved: false,
    })
    expect(r.success).toBe(false)
  })

  it('title 超过 200 触发 maxLength', () => {
    const r = askSchema.safeParse({
      title: 'a'.repeat(201),
      content: 'c',
      tags: '',
      status: 1,
      isResolved: false,
    })
    expect(r.success).toBe(false)
  })

  it('content 超过 10000 触发 maxLength', () => {
    const r = askSchema.safeParse({
      title: 't',
      content: 'a'.repeat(10_001),
      tags: '',
      status: 1,
      isResolved: false,
    })
    expect(r.success).toBe(false)
  })

  it('status 合法值 -1 / 0 / 1', () => {
    for (const s of [-1, 0, 1] as const) {
      const r = askSchema.safeParse({
        title: 't', content: 'c', tags: '', status: s, isResolved: false,
      })
      expect(r.success).toBe(true)
    }
  })

  it('status 非法值 (例如 2) 触发 union 错误', () => {
    const r = askSchema.safeParse({
      title: 't', content: 'c', tags: '', status: 2 as never, isResolved: false,
    })
    expect(r.success).toBe(false)
  })

  it('tags 可选,空字符串合法', () => {
    const r = askSchema.safeParse({
      title: 't', content: 'c', tags: '', status: 1, isResolved: false,
    })
    expect(r.success).toBe(true)
  })

  it('tags 超过 500 触发 maxLength', () => {
    const r = askSchema.safeParse({
      title: 't', content: 'c', tags: 'a'.repeat(501), status: 1, isResolved: false,
    })
    expect(r.success).toBe(false)
  })

  it('isResolved 布尔字段', () => {
    const r1 = askSchema.safeParse({
      title: 't', content: 'c', tags: '', status: 1, isResolved: true,
    })
    expect(r1.success).toBe(true)
  })

  it('EMPTY_ASK_FORM 触发必填错误', () => {
    const r = askSchema.safeParse(EMPTY_ASK_FORM)
    expect(r.success).toBe(false)
  })

  it('EMPTY_ASK_FORM 类型契约', () => {
    const v: AskFormValues = EMPTY_ASK_FORM
    expect(v.status).toBe(1)
    expect(v.isResolved).toBe(false)
  })

  it('ASK_STATUS_VALUES 包含 -1 / 0 / 1', () => {
    expect(ASK_STATUS_VALUES).toEqual([-1, 0, 1])
  })
})
