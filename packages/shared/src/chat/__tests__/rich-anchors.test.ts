// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  RICH_ANCHOR_TAGS,
  countRichAnchors,
  isRichAnchorTag,
  parseRichAnchors,
  richAnchorTagSequence,
  richAnchorsToPlainText,
} from '../rich-anchors'

const here = dirname(fileURLToPath(import.meta.url))
const MESSAGES_ROOT = join(here, '../../../../i18n/messages/shared')
const LOCALES = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const

function readFlow(locale: string): string {
  const raw = readFileSync(join(MESSAGES_ROOT, `${locale}.json`), 'utf8')
  const parsed = JSON.parse(raw) as { richAnchorProbe?: { flow?: unknown } }
  const value = parsed.richAnchorProbe?.flow
  if (typeof value !== 'string') {
    throw new Error(`missing richAnchorProbe.flow in ${locale}.json`)
  }
  return value
}

describe('rich-anchors / 白名单卫生', () => {
  it('白名单非空、无重复、均为合法标签名', () => {
    expect(RICH_ANCHOR_TAGS.length).toBeGreaterThan(0)
    expect(new Set(RICH_ANCHOR_TAGS).size).toBe(RICH_ANCHOR_TAGS.length)
    for (const tag of RICH_ANCHOR_TAGS) {
      expect(tag).toMatch(/^[a-z][a-zA-Z]*$/)
    }
  })

  it('危险标签不在白名单内', () => {
    for (const danger of ['script', 'img', 'iframe', 'style', 'object', 'embed', 'svg']) {
      expect(isRichAnchorTag(danger)).toBe(false)
    }
  })
})

describe('rich-anchors / 逐标签解析', () => {
  it.each([...RICH_ANCHOR_TAGS])('白名单标签 <%s> 解析为锚点节点', (tag) => {
    expect(parseRichAnchors(`<${tag}>x</${tag}>`)).toEqual([
      { kind: 'anchor', tag, children: [{ kind: 'text', value: 'x' }] },
    ])
  })

  it('嵌套保持层级与顺序', () => {
    expect(parseRichAnchors('<action>a<detail>b</detail>c</action>')).toEqual([
      {
        kind: 'anchor',
        tag: 'action',
        children: [
          { kind: 'text', value: 'a' },
          { kind: 'anchor', tag: 'detail', children: [{ kind: 'text', value: 'b' }] },
          { kind: 'text', value: 'c' },
        ],
      },
    ])
  })

  it('未闭合开标签自动闭合到串尾,不丢内容', () => {
    expect(parseRichAnchors('<action>abc')).toEqual([
      { kind: 'anchor', tag: 'action', children: [{ kind: 'text', value: 'abc' }] },
    ])
  })

  it('多余闭标签按文本原样保留', () => {
    expect(parseRichAnchors('a</action>b')).toEqual([{ kind: 'text', value: 'a</action>b' }])
  })

  it('相邻文本段合并,输出确定性', () => {
    expect(parseRichAnchors('a<b>c</b>')).toEqual([{ kind: 'text', value: 'a<b>c</b>' }])
    expect(parseRichAnchors('x')).toEqual([{ kind: 'text', value: 'x' }])
    expect(parseRichAnchors('')).toEqual([])
  })
})

describe('rich-anchors / 安全反例(非白名单一律按文本)', () => {
  const XSS = '<script>alert(1)</script><img src=x onerror=alert(1)>'

  it('<script> / <img onerror> 不产出任何锚点节点', () => {
    const nodes = parseRichAnchors(XSS)
    expect(countRichAnchors(nodes)).toBe(0)
    expect(nodes.every((node) => node.kind === 'text')).toBe(true)
  })

  it('安全串在降级纯文本里"只去标记不丢字"', () => {
    expect(richAnchorsToPlainText(parseRichAnchors(XSS))).toBe(XSS)
  })

  it('带属性 / 自闭合形态不进白名单语义,按文本处理', () => {
    const withAttr = '<link href="/a">x</link>'
    expect(parseRichAnchors(withAttr)).toEqual([{ kind: 'text', value: withAttr }])
    expect(parseRichAnchors('<detail/>')).toEqual([{ kind: 'text', value: '<detail/>' }])
    // 危险属性形态即便套上白名单标签名,也因非严格形态而落文本
    expect(countRichAnchors(parseRichAnchors('<detail onmouseover=alert(1)>z</detail>'))).toBe(0)
  })

  it('白名单标签混在危险串中只解释白名单部分', () => {
    const mixed = '<script>x</script><action>跑</action>'
    expect(richAnchorTagSequence(parseRichAnchors(mixed))).toEqual(['action'])
    expect(richAnchorsToPlainText(parseRichAnchors(mixed))).toBe('<script>x</script>跑')
  })
})

describe('rich-anchors / 五语言语序变体(读真实词包,不 mock)', () => {
  it('五个语言包都有该键且各含 action 与 detail 两个锚点', () => {
    for (const locale of LOCALES) {
      const seq = richAnchorTagSequence(parseRichAnchors(readFlow(locale)))
      expect(seq).toContain('action')
      expect(seq).toContain('detail')
    }
  })

  it('同一语义键在 zh-CN 与 ja 下节点顺序不同 —— 动词与参数各自成单元,可自由调序', () => {
    expect(richAnchorTagSequence(parseRichAnchors(readFlow('zh-CN')))).toEqual(['action', 'detail'])
    expect(richAnchorTagSequence(parseRichAnchors(readFlow('ja')))).toEqual(['detail', 'action'])
  })

  it('参数占位符在两种语序下都完整保留', () => {
    for (const locale of LOCALES) {
      expect(richAnchorsToPlainText(parseRichAnchors(readFlow(locale)))).toContain('{target}')
    }
  })

  it('countRichAnchors 支持按标签过滤', () => {
    const nodes = parseRichAnchors(readFlow('zh-CN'))
    expect(countRichAnchors(nodes)).toBe(2)
    expect(countRichAnchors(nodes, 'action')).toBe(1)
    expect(countRichAnchors(nodes, 'strong')).toBe(0)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
