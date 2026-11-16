// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { render } from '@testing-library/react'
import { JsonCode } from '@/components/chat/stream/json-code'

const REPO = process.cwd()
const compSrc = readFileSync(join(REPO, 'src/components/chat/stream/json-code.tsx'), 'utf8')
const cardSrc = readFileSync(join(REPO, 'src/components/ai/tool-call-card.tsx'), 'utf8')

describe('JsonCode 轻量 JSON 语法高亮(流式 partialArgs 预览)', () => {
  it('渲染 JSON 文本不丢字符(键/值/标点全覆盖)', () => {
    const { container } = render(<JsonCode text={'{"a":"hi","n":1,"ok":true}'} />)
    const pre = container.querySelector('pre')
    expect(pre).not.toBeNull()
    // 拼接所有 span 文本 = 原 JSON(高亮不丢字)
    const joined = Array.from(pre!.querySelectorAll('span'))
      .map((s) => s.textContent)
      .join('')
    expect(joined).toBe('{"a":"hi","n":1,"ok":true}')
  })

  it('tokenize:键名 teal、字符串 amber、数字 violet、布尔 sky 各走不同色档', () => {
    const { container } = render(<JsonCode text={'{"name":"x","count":3,"on":false}'} />)
    const spans = Array.from(container.querySelectorAll('pre > span'))
    const classes = spans.map((s) => s.className)
    expect(classes.some((c) => c.includes('text-teal-600'))).toBe(true) // key
    expect(classes.some((c) => c.includes('text-amber-600'))).toBe(true) // string value
    expect(classes.some((c) => c.includes('text-violet-600'))).toBe(true) // number
    expect(classes.some((c) => c.includes('text-sky-600'))).toBe(true) // boolean
  })

  it('流式光标:streaming=true 渲染 aria-hidden 光标;false 无', () => {
    const { container: on } = render(<JsonCode text="{}" streaming />)
    expect(on.querySelector('[aria-hidden="true"]')).not.toBeNull()
    const { container: off } = render(<JsonCode text="{}" />)
    expect(off.querySelector('[aria-hidden="true"]')).toBeNull()
  })

  it('testId 透传(pre 上)', () => {
    const { container } = render(<JsonCode text="{}" testId="tool-call-partial-args" />)
    expect(container.querySelector('[data-testid="tool-call-partial-args"]')).not.toBeNull()
  })

  it('tokenizer 健壮性:处理转义引号字符串、嵌套、缩进换行不丢字', () => {
    const src = '{\n  "path": "a\\"b",\n  "arr": [1, 2]\n}'
    const { container } = render(<JsonCode text={src} />)
    const pre = container.querySelector('pre')!
    const joined = Array.from(pre.querySelectorAll('span'))
      .map((s) => s.textContent)
      .join('')
    expect(joined).toBe(src)
  })

  it('接线自证:tool-call-card 引入 JsonCode 且 partial-args 预览走它', () => {
    expect(cardSrc).toMatch(/import \{ JsonCode \} from '@\/components\/chat\/stream\/json-code'/)
    expect(cardSrc).toMatch(/<JsonCode\s+text=\{JSON\.stringify\(partialArgs/)
  })

  it('源码级:JsonCode 用纯正则 tokenizer 不 import react-syntax-highlighter(轻量)', () => {
    // 注释里可提及该包名(说明取舍),但不得真 import
    expect(compSrc).not.toMatch(/from ['"]react-syntax-highlighter['"]/)
    expect(compSrc).toContain('tokenizeJson')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
