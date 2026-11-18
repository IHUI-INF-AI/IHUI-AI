// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Y-88 回归锁(2026-11-18)。
 *
 * 病灶:DiagramPreviewModal 作为可复用契约层,`dangerouslySetInnerHTML` 直接注入 svgMarkup,
 * "已消毒"只写在调用方注释里。任何一个新调用方传入未消毒标记即可 XSS。
 *
 * 本文件锁:注入点先把 svgMarkup 过一遍 DOMPurify(SVG profile):
 *   ① 恶意 <script>/onload 事件被剥离;
 *   ② 合法 SVG 结构与 <text> 内容保留(消毒不误伤正常图)。
 */
// @vitest-environment jsdom
import * as React from 'react'
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
vi.mock('@/lib/copy-as-image', () => ({
  svgElementToPngBlob: vi.fn().mockResolvedValue(new Blob(['png'], { type: 'image/png' })),
}))

import { DiagramPreviewModal } from '../DiagramPreviewModal'

afterEach(() => cleanup())

describe('Y-88 DiagramPreviewModal 注入前消毒 SVG', () => {
  it('① 恶意 script 与事件属性被剥离,合法 svg 结构保留', () => {
    const evil =
      '<svg xmlns="http://www.w3.org/2000/svg"><script>window.__pwned=1</script>' +
      '<text onclick="window.__pwned=2">safe label</text></svg>'

    render(<DiagramPreviewModal open onClose={vi.fn()} svgMarkup={evil} />)

    const content = screen.getByTestId('diagram-preview-content')
    expect(content.querySelector('script')).toBeNull()
    expect(content.querySelector('text')?.getAttribute('onclick')).toBeNull()
    expect(content.textContent).toContain('safe label')
    expect((window as unknown as Record<string, unknown>).__pwned).toBeUndefined()
  })

  it('② 正常 SVG 标记消毒后原样保留', () => {
    const clean = '<svg xmlns="http://www.w3.org/2000/svg"><text>hello</text></svg>'
    render(<DiagramPreviewModal open onClose={vi.fn()} svgMarkup={clean} />)

    const content = screen.getByTestId('diagram-preview-content')
    expect(content.querySelector('svg')).not.toBeNull()
    expect(content.textContent).toContain('hello')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
