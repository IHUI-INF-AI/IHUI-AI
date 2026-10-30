// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * compact 数字格式化测试(2026-10-26 立,补"零测试对应共享层工具"第一批)
 *
 * 取证对象:packages/shared/src/utils/number-format.ts 的 formatCompact。
 * 期望值来源:模块头注承诺的跨端契约(en → 1.2K 族 / zh-CN → 万族 / ko → 만族)
 * 加独立可解释字面量;不在测试里复制 Intl 调用逻辑当期望(§22c)。
 * 环境前提:Node ≥13 自带 full-icu(zh/ja/ko 的 compact 单位词才存在)。
 */
import { describe, it, expect } from 'vitest'
import { formatCompact } from '../../src/utils/number-format'

describe('formatCompact 空值契约(调用方靠它决定"要不要渲染热度徽标")', () => {
  it('null / undefined / 0 一律返回空串(三种假值同族,不得出现 "0")', () => {
    expect(formatCompact(null, 'en')).toBe('')
    expect(formatCompact(undefined, 'en')).toBe('')
    expect(formatCompact(0, 'en')).toBe('')
    expect(formatCompact(0, 'zh-CN')).toBe('')
  })
})

describe('formatCompact <10000 原样档', () => {
  it('边界:9999 走原样字符串,不带千分位、不带单位', () => {
    expect(formatCompact(9999, 'en')).toBe('9999')
    expect(formatCompact(9999, 'zh-CN')).toBe('9999')
  })

  it('1 与三位数原样;小数 <10000 也原样(不四舍五入)', () => {
    expect(formatCompact(1, 'en')).toBe('1')
    expect(formatCompact(42, 'en')).toBe('42')
    expect(formatCompact(999.5, 'en')).toBe('999.5')
  })

  it('已知档留档:负数恒 <10000,永远走 String(n) 原样档(含 -20000 也不会出 K/万)', () => {
    expect(formatCompact(-5000, 'en')).toBe('-5000')
    expect(formatCompact(-20000, 'zh-CN')).toBe('-20000')
  })
})

describe('formatCompact >=10000 compact 档(阈值恰好 10000,非 1000)', () => {
  it('en:10000 → "10K"(恰在阈值上,一步跨进 compact),12345 → 一位小数', () => {
    expect(formatCompact(10000, 'en')).toBe('10K')
    expect(formatCompact(12345, 'en')).toBe('12.3K')
    expect(formatCompact(1234567, 'en')).toBe('1.2M')
  })

  it('zh-CN:万族单位必须真出现(调用方 locale 传错会静默变 K —— 本用例钉住 locale 透传)', () => {
    expect(formatCompact(12345, 'zh-CN')).toBe('1.2万')
    expect(formatCompact(123456789, 'zh-CN')).toBe('1.2亿')
  })

  it('ko:만 单位;ja:万(注意:模块头注写 ja 出 "億" 于亿级,实测 12345 档为 万)', () => {
    expect(formatCompact(12345, 'ko')).toBe('1.2만')
    expect(formatCompact(12345, 'ja')).toBe('1.2万')
  })

  it('maximumFractionDigits:1 生效 —— 不会出现 12.35K 这种两位小数', () => {
    expect(formatCompact(12350, 'en')).toBe('12.4K') // 半进位到一位小数
  })
})

describe('formatCompact 纯函数性', () => {
  it('同输入重复调用逐字相等(Intl 实例每次新建,无共享格式器状态泄漏)', () => {
    const a = formatCompact(987654, 'en')
    const b = formatCompact(987654, 'en')
    expect(a).toBe(b)
    expect(a).toBe('987.7K')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
