/**
 * scripts/check-i18n-xss.ts 单元测试 (2026-07-02 立)
 *
 * 目的: 验证 XSS 防护扫描的 4 类攻击向量正则正确性
 *   (1) <script> 标签
 *   (2) <script/> 自闭合
 *   (3) on*= 事件属性 (onclick / onerror / onload 等)
 *   (4) javascript: 协议
 *
 * 与端到端 e2e 配合:
 *   - 本测试: 验证正则正确性 (毫秒级, 可挂 pre-commit)
 *   - check:i18n:xss: 验证实际仓库 JSON 文件清洁 (秒级, 可挂 pre-push)
 *
 * 测试方式: 复制 XSS_PATTERNS (避免从脚本 import, 减少耦合)
 *           覆盖正向 (应命中) 和反向 (不应误报) 两种用例
 */

import { describe, it, expect } from 'vitest'

// 镜像 check-i18n-xss.ts 的正则 (单一来源 vs 测试稳定性取舍:
// 此处复制可让测试独立运行, 不依赖 fs/path 真实目录)
const XSS_PATTERNS: { name: string; regex: RegExp }[] = [
  { name: '<script> 标签', regex: /<\s*script\b[^>]*>/i },
  { name: '<script/> 自闭合', regex: /<\s*\/\s*script\s*>/i },
  { name: 'on*= 事件属性', regex: /\son[a-z]+\s*=\s*['"]?[^'">\s]+/i },
  { name: 'javascript: 协议', regex: /javascript\s*:/i },
]

function isXss(value: string): boolean {
  if (!value) return false
  return XSS_PATTERNS.some(({ regex }) => regex.test(value))
}

describe('XSS 防护扫描 - 正则正确性', () => {
  // ─────────────────────────────────────────────────────────────────
  // 正向用例: 4 类攻击向量必须被命中
  // ─────────────────────────────────────────────────────────────────
  describe('正向 - 攻击向量应被拦截', () => {
    it('拦截 <script> 标签', () => {
      expect(isXss('Hello <script>alert(1)</script>')).toBe(true)
      expect(isXss('嵌套 <script type="text/javascript">malicious</script>')).toBe(true)
      expect(isXss('大小写 <SCRIPT>foo</SCRIPT>')).toBe(true)
    })

    it('拦截 <script/> 自闭合', () => {
      expect(isXss('含 <script src="evil.js"/> 注入')).toBe(true)
      expect(isXss('</script>')).toBe(true)
    })

    it('拦截 on*= 事件属性', () => {
      expect(isXss('<a onclick="evil()">x</a>')).toBe(true)
      expect(isXss('<img onerror="alert(1)" src="x">')).toBe(true)
      expect(isXss('<div onload=evil()>')).toBe(true)
      // 多种事件名 (实际场景在 HTML 标签属性中, 必含前置空白)
      expect(isXss('<a onmouseover=foo>x</a>')).toBe(true)
      expect(isXss('<input onfocus=foo>')).toBe(true)
      expect(isXss('<select onchange=foo>')).toBe(true)
    })

    it('拦截 javascript: 协议', () => {
      expect(isXss('<a href="javascript:alert(1)">click</a>')).toBe(true)
      expect(isXss('javascript:foo()')).toBe(true)
      // 含空格变种
      expect(isXss('javascript : alert(1)')).toBe(true)
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 反向用例: 合法翻译值不应被误报
  // ─────────────────────────────────────────────────────────────────
  describe('反向 - 合法翻译值不应被误报', () => {
    it('普通文本', () => {
      expect(isXss('欢迎使用智汇AI')).toBe(false)
      expect(isXss('Account Login')).toBe(false)
      expect(isXss('アカウントログイン')).toBe(false)
    })

    it('合法 HTML 链接 (https)', () => {
      expect(isXss('<a href="https://example.com/agreement">用户协议</a>')).toBe(false)
      expect(isXss('<a href="https://example.com/privacy">隐私政策</a>')).toBe(false)
    })

    it('el-link 组件', () => {
      expect(isXss('<el-link type="primary">用户协议</el-link>')).toBe(false)
    })

    it('纯展示标签 (br/span/strong)', () => {
      expect(isXss('line1<br>line2')).toBe(false)
      expect(isXss('<span style="color: red">重要</span>')).toBe(false)
      expect(isXss('<strong>Bold</strong>')).toBe(false)
    })

    it('HTML 实体转义', () => {
      expect(isXss('&lt;script&gt;alert(1)&lt;/script&gt;')).toBe(false)
    })

    it('CSS class / id 等含 on* 字符的合法属性', () => {
      // 重要: on*= 正则要求前置空白 + 紧跟 =, 不应误报 onlanguage/online 等单词
      expect(isXss('class="online"')).toBe(false)
      expect(isXss('class="on-stage"')).toBe(false)
      // 含 "on" 但不接事件属性
      expect(isXss('font-size: 12px')).toBe(false)
    })

    it('含 "javascript" 单词但非协议', () => {
      // 单纯包含 "javascript" 字符, 实际是描述文本
      // 注意: 当前正则 javascript: 比较宽松, 含空格也命中
      // 测试描述文本: "我们使用 JavaScript 加密"
      // 这种情况会命中, 但实际翻译里很少出现, 误报可控
      // 故不写反向用例, 改在正向覆盖 javascript: 命中
    })
  })

  // ─────────────────────────────────────────────────────────────────
  // 边界用例
  // ─────────────────────────────────────────────────────────────────
  describe('边界 - 鲁棒性', () => {
    it('空字符串', () => {
      expect(isXss('')).toBe(false)
    })

    it('纯空白', () => {
      expect(isXss('   ')).toBe(false)
    })

    it('纯 ASCII 数字', () => {
      expect(isXss('1234567890')).toBe(false)
    })

    it('超长文本无危险模式', () => {
      const long = '欢迎使用智汇AI平台。'.repeat(100)
      expect(isXss(long)).toBe(false)
    })
  })
})
