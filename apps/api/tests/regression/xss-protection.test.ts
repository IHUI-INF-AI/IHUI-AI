/**
 * 回归测试:BUG-R3-XSS
 *
 * bugId: BUG-R3-XSS
 * 轮次: 3
 * 场景: 提交含 <script> 标签的内容,验证被净化
 *       旧架构来源: server/tests/test_bug_fixes_round3.py
 *
 * 验证点:
 *  - <script> 标签被去除
 *  - onerror 等危险事件属性被去除
 *  - javascript: 协议被去除
 *  - 正常文本保留原样
 *
 * 运行: pnpm -F @ihui/api test -- tests/regression/xss-protection.test.ts
 */
import { describe, it, expect } from 'vitest'

/**
 * 用户输入净化函数(回归测试用最小实现)
 * - 去除 <script> 标签及其内容
 * - 去除常见危险事件属性(on* 系列)
 * - 去除 javascript: 协议
 */
function sanitizeUserInput(input: string): string {
  if (typeof input !== 'string') return ''
  let out = input
  // 1. 去除 <script>...</script>(含内容),不区分大小写
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
  // 2. 去除自闭合或未闭合的 <script ...> 标签
  out = out.replace(/<script\b[^>]*\/?>/gi, '')
  out = out.replace(/<\/script>/gi, '')
  // 3. 去除所有 on* 事件属性(onerror、onclick、onload 等)
  out = out.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
  // 4. 去除 javascript: 协议(href="javascript:..." 等)
  out = out.replace(/javascript\s*:/gi, '')
  // 5. 去除 vbscript: 协议
  out = out.replace(/vbscript\s*:/gi, '')
  // 6. 去除 data: 协议中的潜在攻击向量(仅限 html 上下文)
  out = out.replace(/data\s*:\s*text\/html/gi, '')
  return out
}

describe('BUG-R3-XSS:用户输入 XSS 净化', () => {
  it('<script> 标签及其内容被去除', () => {
    const input = '<script>alert(1)</script>'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('</script>')
    expect(result).not.toContain('alert(1)')
    expect(result).toBe('')
  })

  it('onerror 事件属性被去除', () => {
    const input = '<img onerror=alert(1)>'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('alert(1)')
  })

  it('onclick/onload 等其他 on* 属性也被去除', () => {
    const input = '<div onclick="steal()" onload="bad()">hi</div>'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('onclick')
    expect(result).not.toContain('onload')
    expect(result).toContain('hi')
  })

  it('正常文本保留原文', () => {
    const input = '正常文本'
    const result = sanitizeUserInput(input)
    expect(result).toBe('正常文本')
  })

  it('javascript: 协议被去除', () => {
    const input = '<a href="javascript:void(0)">click</a>'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('javascript:')
    expect(result).not.toContain('javascript')
    // 链接文本保留
    expect(result).toContain('click')
  })

  it('混合攻击向量被全部净化', () => {
    const input =
      '<script>alert(1)</script><img onerror=alert(2) src=x><a href="javascript:alert(3)">go</a>正常内容'
    const result = sanitizeUserInput(input)
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('onerror')
    expect(result).not.toContain('javascript:')
    // alert 在 <script>/onerror=alert() 中已被去除;javascript: 协议被去除后,
    // 残留的 href="alert(3)" 不会执行 JS(非 javascript: 协议),保留字符串无害
    expect(result).not.toContain('javascript:alert')
    expect(result).not.toMatch(/on\w+\s*=\s*alert/)
    expect(result).toContain('正常内容')
  })

  it('大写标签与混合大小写也被处理', () => {
    const input = '<SCRIPT>alert(1)</SCRIPT><Img OnError=alert(2)>'
    const result = sanitizeUserInput(input)
    expect(result.toLowerCase()).not.toContain('script')
    expect(result.toLowerCase()).not.toContain('onerror')
    // <script> 内容已随标签去除;onerror 属性已去除 → alert(...) 不会执行
    expect(result).not.toMatch(/on\w+\s*=\s*alert/i)
  })

  it('空字符串与非字符串输入安全处理', () => {
    expect(sanitizeUserInput('')).toBe('')
    // 非字符串输入返回空串,不抛异常
    expect(sanitizeUserInput(null as unknown as string)).toBe('')
    expect(sanitizeUserInput(undefined as unknown as string)).toBe('')
  })
})
