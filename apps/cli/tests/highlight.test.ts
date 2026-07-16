import { describe, expect, it } from 'vitest'
import { highlightCode } from '../src/highlight.js'

describe('highlightCode (基于 chalk)', () => {
  it('TS 代码:关键字/字符串/注释着色', () => {
    const code = `// comment
const x = "hello"
function foo() { return 1 }`
    const out = highlightCode(code, 'foo.ts')
    expect(out.length).toBeGreaterThan(0)
    // chalk.cyan 会产生 ANSI 转义码(若 FORCE_COLOR=1)
  })

  it('未识别的扩展名原样返回', () => {
    const code = 'plain text content'
    const out = highlightCode(code, 'foo.unknown')
    expect(out).toBe(code)
  })

  it('空字符串安全', () => {
    expect(highlightCode('', 'foo.ts')).toBe('')
  })

  it('无 filePath 时原样返回', () => {
    const code = 'plain text'
    expect(highlightCode(code)).toBe(code)
  })
})
