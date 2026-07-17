import { describe, expect, it } from 'vitest'
import {
  seekSequence,
  normalizeForUnicode,
} from '../src/tools/seek-sequence.js'

describe('P0-1 seek_sequence 4 级模糊匹配', () => {
  describe('Level 1: exact 精确匹配', () => {
    it('完全匹配的字符串返回 exact 级别', () => {
      const haystack = 'hello world\nfoo bar\nbaz'
      const needle = 'foo bar'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
      expect(result!.index).toBe('hello world\n'.length)
      expect(result!.length).toBe('foo bar'.length)
    })

    it('多行 needle 精确匹配', () => {
      const haystack = 'line1\nline2\nline3\nline4'
      const needle = 'line2\nline3'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
      expect(haystack.slice(result!.index, result!.index + result!.length)).toBe(needle)
    })

    it('needle 在 haystack 开头', () => {
      const result = seekSequence('abc\ndef', 'abc')
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
      expect(result!.index).toBe(0)
    })

    it('needle 在 haystack 末尾', () => {
      const haystack = 'abc\ndef'
      const result = seekSequence(haystack, 'def')
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
      expect(result!.index).toBe('abc\n'.length)
    })

    it('空 needle 返回 null', () => {
      expect(seekSequence('hello', '')).toBeNull()
    })

    it('未匹配返回 null', () => {
      expect(seekSequence('hello world', 'nonexistent')).toBeNull()
    })
  })

  describe('Level 2: rstrip 行尾空白无关', () => {
    it('源文件行尾有多余空格,needle 无空格 → rstrip 匹配', () => {
      const haystack = 'line1   \nline2   \nline3'
      const needle = 'line1\nline2'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('rstrip')
      // 匹配的原始长度应包含行尾空格
      expect(haystack.slice(result!.index, result!.index + result!.length)).toBe('line1   \nline2   ')
    })

    it('needle 行尾有空格,源文件无空格 → rstrip 匹配', () => {
      const haystack = 'line1\nline2'
      const needle = 'line1   \nline2   '
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('rstrip')
    })
  })

  describe('Level 3: trim 行首尾空白无关', () => {
    it('源文件行首有缩进,needle 无缩进 → trim 匹配', () => {
      const haystack = '  indented line\n  another line'
      const needle = 'indented line\nanother line'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('trim')
      expect(haystack.slice(result!.index, result!.index + result!.length)).toBe('  indented line\n  another line')
    })

    it('needle 有缩进,源文件无缩进 → trim 匹配', () => {
      const haystack = 'no indent\nno indent2'
      const needle = '  no indent\n  no indent2'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('trim')
    })

    it('源文件行首行尾都有空白 → trim 匹配', () => {
      const haystack = '  line1  \n  line2  '
      const needle = 'line1\nline2'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(['trim', 'unicode']).toContain(result!.level)
    })
  })

  describe('Level 4: unicode 归一化', () => {
    it('typographic dash → ASCII dash 匹配', () => {
      // em dash (U+2014) → -
      const haystack = 'price: $10 — $20\nrange updated'
      const needle = 'price: $10 - $20\nrange updated'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('unicode')
    })

    it('smart quotes → ASCII quotes 匹配', () => {
      // haystack 用 typographic 双引号(U+201C/U+201D),needle 用 ASCII 双引号
      const haystack = 'const msg = \u201Chello\u201D\nconsole.log(msg)'
      const needle = 'const msg = "hello"\nconsole.log(msg)'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('unicode')
    })

    it('non-breaking space → regular space 匹配', () => {
      // nbsp (U+00A0) → space
      const haystack = 'amount: 100\u00A0USD\ntotal: 200\u00A0USD'
      const needle = 'amount: 100 USD\ntotal: 200 USD'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('unicode')
    })

    it('ellipsis → three dots 匹配', () => {
      const haystack = 'loading…\ndone…'
      const needle = 'loading...\ndone...'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('unicode')
    })
  })

  describe('normalizeForUnicode 独立测试', () => {
    it('em dash → ASCII dash', () => {
      expect(normalizeForUnicode('a — b')).toBe('a - b')
    })

    it('en dash → ASCII dash', () => {
      expect(normalizeForUnicode('2020–2024')).toBe('2020-2024')
    })

    it('smart single quotes', () => {
      expect(normalizeForUnicode("it's")).toBe("it's")
    })

    it('nbsp → space', () => {
      expect(normalizeForUnicode('a\u00A0b')).toBe('a b')
    })

    it('middle dot → asterisk', () => {
      expect(normalizeForUnicode('a·b')).toBe('a*b')
    })

    it('multiplication sign → x', () => {
      expect(normalizeForUnicode('2 × 3')).toBe('2 x 3')
    })

    it('纯 ASCII 字符串不变', () => {
      expect(normalizeForUnicode('hello world')).toBe('hello world')
    })
  })

  describe('边界场景', () => {
    it('needle 比 haystack 长 → null', () => {
      expect(seekSequence('short', 'short\nlonger\nneedle')).toBeNull()
    })

    it('needle 等于 haystack → exact', () => {
      const result = seekSequence('exact match', 'exact match')
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
      expect(result!.index).toBe(0)
      expect(result!.length).toBe('exact match'.length)
    })

    it('多行 needle 含空行 → 精确匹配', () => {
      const haystack = 'line1\n\nline3'
      const needle = 'line1\n\nline3'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.level).toBe('exact')
    })

    it('重复行内容 → 匹配第一个出现', () => {
      const haystack = 'dup\ndup\nother'
      const needle = 'dup\ndup'
      const result = seekSequence(haystack, needle)
      expect(result).not.toBeNull()
      expect(result!.index).toBe(0)
    })

    it('级别优先级:exact 优先于 rstrip', () => {
      // haystack 与 needle 完全一致 → exact,不会回退到 rstrip
      const haystack = 'line1\nline2'
      const needle = 'line1\nline2'
      const result = seekSequence(haystack, needle)
      expect(result!.level).toBe('exact')
    })
  })
})
