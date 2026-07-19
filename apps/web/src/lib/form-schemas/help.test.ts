import { describe, expect, it } from 'vitest'
import {
  helpSchema,
  EMPTY_HELP_FORM,
  HELP_CATEGORY_VALUES,
  type HelpFormValues,
} from './help'

describe('helpSchema', () => {
  it('合法值通过校验', () => {
    const r = helpSchema.safeParse({
      title: '如何注册',
      slug: 'how-to-register',
      category: 'account',
      content: '步骤 1: ...',
      isPublished: true,
    })
    expect(r.success).toBe(true)
  })

  it('空 title 触发 required', () => {
    const r = helpSchema.safeParse({
      title: '',
      slug: '',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('title') && i.message === 'required')).toBe(true)
    }
  })

  it('空 content 触发 required', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: '',
      category: 'account',
      content: '',
      isPublished: false,
    })
    expect(r.success).toBe(false)
  })

  it('content 超过 50000 触发 maxLength', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: '',
      category: 'account',
      content: 'a'.repeat(50_001),
      isPublished: false,
    })
    expect(r.success).toBe(false)
  })

  it('title 超过 200 触发 maxLength', () => {
    const r = helpSchema.safeParse({
      title: 'a'.repeat(201),
      slug: '',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(false)
  })

  it('非法 category 触发 enum 错误', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: '',
      category: 'unknown' as never,
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(false)
  })

  it('合法 kebab-case slug 通过', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: 'foo-bar-123',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(true)
  })

  it('非法 slug (大写) 触发 pattern', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: 'FooBar',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('slug') && i.message === 'pattern')).toBe(true)
    }
  })

  it('slug 含连续连字符触发 pattern', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: 'foo--bar',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(false)
  })

  it('空 slug 合法 (可由 title 派生)', () => {
    const r = helpSchema.safeParse({
      title: 't',
      slug: '',
      category: 'account',
      content: 'c',
      isPublished: false,
    })
    expect(r.success).toBe(true)
  })

  it('isPublished 布尔字段通过', () => {
    const r1 = helpSchema.safeParse({
      title: 't', slug: '', category: 'account', content: 'c', isPublished: true,
    })
    expect(r1.success).toBe(true)
    const r2 = helpSchema.safeParse({
      title: 't', slug: '', category: 'account', content: 'c', isPublished: false,
    })
    expect(r2.success).toBe(true)
  })

  it('EMPTY_HELP_FORM 触发必填错误', () => {
    const r = helpSchema.safeParse(EMPTY_HELP_FORM)
    expect(r.success).toBe(false)
  })

  it('EMPTY_HELP_FORM 类型契约', () => {
    const v: HelpFormValues = EMPTY_HELP_FORM
    expect(v.category).toBe('account')
    expect(v.isPublished).toBe(false)
  })

  it('HELP_CATEGORY_VALUES 包含所有预定义分类', () => {
    expect(HELP_CATEGORY_VALUES).toContain('account')
    expect(HELP_CATEGORY_VALUES).toContain('payment')
    expect(HELP_CATEGORY_VALUES).toContain('project')
    expect(HELP_CATEGORY_VALUES).toContain('ai')
    expect(HELP_CATEGORY_VALUES).toContain('tech')
  })
})
