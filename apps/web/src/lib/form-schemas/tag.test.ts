import { describe, expect, it } from 'vitest'
import { tagSchema, EMPTY_TAG_FORM, type TagFormValues } from './tag'

describe('tagSchema', () => {
  it('合法值通过校验', () => {
    const r = tagSchema.safeParse({ name: '前端', description: 'FE tags', color: '#3b82f6' })
    expect(r.success).toBe(true)
  })

  it('空 name 触发 required', () => {
    const r = tagSchema.safeParse({ name: '', description: '', color: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('name') && i.message === 'required')).toBe(true)
    }
  })

  it('name 超过 64 触发 maxLength', () => {
    const r = tagSchema.safeParse({ name: 'a'.repeat(65), description: '', color: '' })
    expect(r.success).toBe(false)
  })

  it('description 可选', () => {
    const r = tagSchema.safeParse({ name: 'n', color: '' })
    expect(r.success).toBe(true)
  })

  it('合法 HEX 颜色 #RGB 通过', () => {
    const r = tagSchema.safeParse({ name: 'n', description: '', color: '#abc' })
    expect(r.success).toBe(true)
  })

  it('合法 HEX 颜色 #RRGGBB 通过', () => {
    const r = tagSchema.safeParse({ name: 'n', description: '', color: '#aabbcc' })
    expect(r.success).toBe(true)
  })

  it('非法颜色 (rgb 名) 触发 pattern', () => {
    const r = tagSchema.safeParse({ name: 'n', description: '', color: 'red' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('color') && i.message === 'pattern')).toBe(true)
    }
  })

  it('非法颜色 (8 位) 触发 pattern', () => {
    const r = tagSchema.safeParse({ name: 'n', description: '', color: '#aabbccdd' })
    expect(r.success).toBe(false)
  })

  it('空 color 合法', () => {
    const r = tagSchema.safeParse({ name: 'n', description: '', color: '' })
    expect(r.success).toBe(true)
  })

  it('EMPTY_TAG_FORM 触发 required(name)', () => {
    const r = tagSchema.safeParse(EMPTY_TAG_FORM)
    expect(r.success).toBe(false)
  })

  it('EMPTY_TAG_FORM 类型契约', () => {
    const v: TagFormValues = EMPTY_TAG_FORM
    expect(v.name).toBe('')
    expect(v.description).toBe('')
    expect(v.color).toBe('')
  })
})
