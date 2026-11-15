// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 仿生阅读切分的判据测试(2026-11-15 立,随 `lib/bionic-reading.ts` 入库)。
// 核心不是"加粗得像不像",而是两条硬约束:拼接恒等 + 无变化返回 null。
import { describe, expect, it } from 'vitest'

import { bionicizeText } from '../bionic-reading'

/** 拼接恒等:片段顺次相连必须逐字等于原文 */
function join(segments: { text: string }[]): string {
  return segments.map((s) => s.text).join('')
}

describe('bionicizeText(仿生阅读切分)', () => {
  it('空串与纯 CJK 一律返回 null:调用方据此保留原 children 身份', () => {
    expect(bionicizeText('')).toBeNull()
    expect(bionicizeText('你好,世界')).toBeNull()
    expect(bionicizeText('、、。')).toBeNull()
  })

  it('拼接恒等:多组混合文本逐字还原(复制/搜索不失真)', () => {
    const cases = [
      'Hello world',
      '仿生阅读 test 混排,标点!',
      '  leading and trailing  ',
      'café naïve résumé',
      'v2.3.1 released',
      'a b c',
    ]
    for (const text of cases) {
      const segments = bionicizeText(text)
      if (segments === null) continue
      expect(join(segments)).toBe(text)
    }
  })

  it('单字符词不加粗:整段全粗等于没有强调', () => {
    expect(bionicizeText('a b c')).toBeNull()
  })

  it('两字母词只粗首字母,且必留一个非粗字符', () => {
    const segments = bionicizeText('go')
    expect(segments).not.toBeNull()
    const bold = (segments ?? []).filter((s) => s.bold)
    const plain = (segments ?? []).filter((s) => !s.bold)
    expect(join(bold)).toBe('g')
    expect(join(plain)).toBe('o')
  })

  it('长词按约 0.45 取词首,且不吞掉整个词', () => {
    const segments = bionicizeText('reading')
    expect(segments).not.toBeNull()
    const bold = (segments ?? []).filter((s) => s.bold).map((s) => s.text)
    const plain = (segments ?? []).filter((s) => !s.bold).map((s) => s.text)
    expect(bold).toEqual(['rea'])
    expect(plain.join('')).toBe('ding')
  })

  it('拉丁变音字母同样算一个词(法语/德语不能被跳过)', () => {
    const segments = bionicizeText('café')
    expect(segments).not.toBeNull()
    expect(join(segments ?? [])).toBe('café')
    expect((segments ?? []).some((s) => s.bold)).toBe(true)
  })

  it('中文与英文相邻时中文原样透传,只切英文词', () => {
    const segments = bionicizeText('用 token 计费')
    expect(segments).not.toBeNull()
    const boldText = (segments ?? [])
      .filter((s) => s.bold)
      .map((s) => s.text)
      .join('')
    expect(boldText).toBe('to')
    expect(join(segments ?? [])).toBe('用 token 计费')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
