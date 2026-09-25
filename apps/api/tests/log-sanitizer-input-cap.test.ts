// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * log-sanitizer 入口长度封顶回归(A9E-1「先封顶、后正则」)。
 * 全程纯内存计算,不触 DB / 网络(§5 测试隔离铁律)。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  MAX_SANITIZE_INPUT_CHARS,
  resolveSanitizeInputCap,
  sanitizeLogEntry,
  sanitizeMessages,
  sanitizeText,
} from '../src/services/log-sanitizer.js'

const ENV_KEY = 'IHUI_LOG_SANITIZE_MAX_CHARS'
const savedEnv = process.env[ENV_KEY]

afterEach(() => {
  if (savedEnv === undefined) delete process.env[ENV_KEY]
  else process.env[ENV_KEY] = savedEnv
  vi.restoreAllMocks()
})

describe('log-sanitizer 输入长度封顶', () => {
  it('短输入完全不受影响(形状逐字不变,无任何截断标记)', () => {
    expect(sanitizeText('hello world')).toBe('hello world')
    // 脱敏规则语义不变:邮箱仍按原规则打码
    expect(sanitizeText('mail a@b.com here')).toBe('mail a***@b.com here')
  })

  it('默认档:超长输入被封顶,标记含真实原长度与丢弃数', () => {
    const input = 'x'.repeat(5000)
    const out = sanitizeText(input)
    expect(out.startsWith('x'.repeat(MAX_SANITIZE_INPUT_CHARS))).toBe(true)
    expect(out).toContain('TRUNCATED')
    expect(out).toContain('原长度=5000')
    expect(out).toContain(`已丢弃=${5000 - MAX_SANITIZE_INPUT_CHARS}`)
  })

  it('封顶后脱敏仍生效:超长输入尾部(封顶窗口内)的 API Key 不得以原文出现', () => {
    const secret = `sk-${'Kqx1a7v3mZp8dRn4Yt2Ws6uJ'}`
    const input = 'a'.repeat(4000) + secret + 'b'.repeat(3000)
    const out = sanitizeText(input)
    expect(out).not.toContain(secret)
    expect(out).toContain('sk-***')
    expect(out).toContain(`原长度=${input.length}`)
  })

  it('先封顶后正则的次序判据(变异对照锚点):截断点恰好劈开邮箱时,正则必须先看到 ≤cap 的输入', () => {
    // 「先正则后封顶」的实现会先在全文上把 a@b.com 打码成 a***@b.com(变长),
    // 再截到 10 字符得 `12345678a*`;而唯一正确顺序产出 `12345678a@`。
    // 这条精确断言就是两序的分水岭 —— 调序必红。
    process.env[ENV_KEY] = '10'
    const out = sanitizeText('12345678a@b.com')
    expect(out).toBe('12345678a@\n…[TRUNCATED 原长度=15字符,已丢弃=5字符]')
  })

  it('env 覆盖生效:IHUI_LOG_SANITIZE_MAX_CHARS=50 时按 50 封顶', () => {
    process.env[ENV_KEY] = '50'
    const out = sanitizeText('y'.repeat(200))
    expect(out).toContain('原长度=200字符')
    expect(out).toContain('已丢弃=150字符')
    expect(out.startsWith('y'.repeat(50))).toBe(true)
    expect(out).not.toContain('y'.repeat(51))
  })

  it('env 为垃圾值时回默认且不抛,console.warn 全程至多一次', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    process.env[ENV_KEY] = 'not-a-number'
    expect(() => resolveSanitizeInputCap()).not.toThrow()
    expect(resolveSanitizeInputCap()).toBe(MAX_SANITIZE_INPUT_CHARS)
    expect(resolveSanitizeInputCap()).toBe(MAX_SANITIZE_INPUT_CHARS)
    expect(spy).toHaveBeenCalledTimes(1)
    const out = sanitizeText('x'.repeat(100))
    expect(out).toBe('x'.repeat(100))
  })

  it('sanitizeLogEntry / sanitizeMessages 路径同受封顶(它们最终汇入 sanitizeText)', () => {
    process.env[ENV_KEY] = '20'
    const long = 'z'.repeat(100)
    expect(sanitizeLogEntry(long)).toContain('已丢弃=80')
    const msgs = sanitizeMessages([{ role: 'user', name: long, content: long }])
    const name = (msgs[0] as { name: string }).name
    expect(name).toContain('已丢弃=80')
    // content 走 [REDACTED length=N] 分支,不进正则,语义不变
    expect((msgs[0] as { content: string }).content).toBe(`[REDACTED length=${long.length}]`)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
