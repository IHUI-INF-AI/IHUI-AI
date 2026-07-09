import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn', () => {
  it('合并多个类名', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('处理条件类名(falsy 值过滤)', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b')
  })

  it('处理对象语法', () => {
    expect(cn({ a: true, b: false, c: true })).toBe('a c')
  })

  it('处理数组语法', () => {
    expect(cn(['a', 'b'], 'c')).toBe('a b c')
  })

  it('tailwind 冲突类合并(后者胜出)', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('空输入返回空字符串', () => {
    expect(cn()).toBe('')
  })
})
