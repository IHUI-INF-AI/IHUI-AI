// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import JSZip from 'jszip'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import {
  ADD_TEXT_REFERENCE_EVENT,
  type AnchorReferenceDetail,
} from '@/components/chat/annotation-anchor'
import { parsePptxVisual, PptxPreview } from '../pptx-visual'

const NS =
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" ' +
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'

function shapeXml(options: {
  readonly name: string
  readonly type?: string
  readonly x: number
  readonly y: number
  readonly cx: number
  readonly cy: number
  readonly text: string
  readonly size?: number
  readonly fill?: string
  readonly color?: string
  readonly scheme?: string
  readonly gradient?: boolean
  readonly rot?: number
}): string {
  const ph = options.type ? `<p:nvPr><p:ph type="${options.type}"/></p:nvPr>` : ''
  const rot = options.rot !== undefined ? ` rot="${options.rot}"` : ''
  const fill = options.gradient
    ? `<a:gradFill><a:gsLst><a:gs pos="0"><a:srgbClr val="FF0000"/></a:gs><a:gs pos="100000"><a:srgbClr val="0000FF"/></a:gs></a:gsLst><a:lin ang="0"/></a:gradFill>`
    : options.fill
      ? `<a:solidFill><a:srgbClr val="${options.fill}"/></a:solidFill>`
      : ''
  const color = options.color
    ? `<a:solidFill><a:srgbClr val="${options.color}"/></a:solidFill>`
    : options.scheme
      ? `<a:solidFill><a:schemeClr val="${options.scheme}"/></a:solidFill>`
      : ''
  return `<p:sp>
    <p:nvSpPr><p:cNvPr id="2" name="${options.name}"/><p:cNvSpPr/>${ph}</p:nvSpPr>
    <p:spPr><a:xfrm${rot}><a:off x="${options.x}" y="${options.y}"/><a:ext cx="${options.cx}" cy="${options.cy}"/></a:xfrm>${fill}</p:spPr>
    <p:txBody><a:bodyPr anchor="ctr"/><a:lstStyle/>
      <a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="${options.size ?? 1800}" b="1">${color}</a:rPr><a:t>${options.text}</a:t></a:r></a:p>
    </p:txBody>
  </p:sp>`
}

async function makePptx(options: { readonly gradient?: boolean } = {}): Promise<ArrayBuffer> {
  const zip = new JSZip()
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0"?><p:presentation ${NS}>
      <p:sldIdLst><p:sldId id="256" r:id="rId1"/><p:sldId id="257" r:id="rId2"/></p:sldIdLst>
      <p:sldSz cx="12192000" cy="6858000"/>
    </p:presentation>`,
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide2.xml"/>
      <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide1.xml"/>
    </Relationships>`,
  )
  zip.file(
    'ppt/slides/slide1.xml',
    `<?xml version="1.0"?><p:sld ${NS}><p:cSld>
      <p:bg><p:bgPr><a:blipFill><a:blip r:embed="rIdBg"/></a:blipFill></p:bgPr></p:bg>
      <p:spTree>${shapeXml({
        name: '标题 1',
        type: 'title',
        x: 914400,
        y: 457200,
        cx: 7315200,
        cy: 914400,
        text: '视觉标题',
        size: 4000,
        fill: '1F4E79',
        gradient: options.gradient,
        scheme: 'accent1',
        rot: 2700000,
      })}</p:spTree>
    </p:cSld></p:sld>`,
  )
  zip.file(
    'ppt/slides/_rels/slide1.xml.rels',
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rIdBg" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/bg.png"/>
    </Relationships>`,
  )
  zip.file(
    'ppt/media/bg.png',
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    { base64: true },
  )
  zip.file(
    'ppt/theme/theme1.xml',
    `<?xml version="1.0"?><a:theme ${NS}><a:themeElements><a:clrScheme name="测试主题">
      <a:dk1><a:srgbClr val="111827"/></a:dk1>
      <a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="374151"/></a:dk2>
      <a:lt2><a:srgbClr val="F3F4F6"/></a:lt2>
      <a:accent1><a:srgbClr val="FF0000"/></a:accent1>
      <a:accent2><a:srgbClr val="00AA00"/></a:accent2>
      <a:accent3><a:srgbClr val="0000AA"/></a:accent3>
      <a:accent4><a:srgbClr val="AAAA00"/></a:accent4>
      <a:accent5><a:srgbClr val="AA00AA"/></a:accent5>
      <a:accent6><a:srgbClr val="00AAAA"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme></a:themeElements></a:theme>`,
  )
  zip.file(
    'ppt/slides/slide2.xml',
    `<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>${shapeXml({
      name: '正文 1',
      type: 'body',
      x: 914400,
      y: 2286000,
      cx: 10058400,
      cy: 2746388,
      text: '第二页正文',
      size: 2000,
    })}</p:spTree></p:cSld></p:sld>`,
  )
  return zip.generateAsync({ type: 'arraybuffer' })
}

afterEach(() => {
  cleanup()
})

describe('parsePptxVisual', () => {
  it('按 sldIdLst 关系顺序解析,还原位置/字号/填充', async () => {
    const deck = await parsePptxVisual(await makePptx())

    expect(deck.cx).toBe(12192000)
    expect(deck.cy).toBe(6858000)
    expect(deck.slides).toHaveLength(2)
    expect(deck.slides[0]?.shapes[0]?.kind).toBe('text')

    const first = deck.slides[0]?.shapes[0]
    if (!first || first.kind !== 'text') throw new Error('first shape must be text')
    expect(first.paragraphs[0]?.runs[0]?.text).toBe('第二页正文')
    expect(first.paragraphs[0]?.runs[0]?.sizePt).toBe(20)

    const second = deck.slides[1]?.shapes[0]
    if (!second || second.kind !== 'text') throw new Error('second shape must be text')
    expect(second.paragraphs[0]?.runs[0]?.text).toBe('视觉标题')
    expect(second.paragraphs[0]?.runs[0]?.sizePt).toBe(40)
    expect(second.fill).toBe('#1F4E79')
    expect(second.paragraphs[0]?.runs[0]?.color).toBe('#FF0000')
    expect(second.rotation).toBe(45)
    expect(second.x).toBeCloseTo(0.075, 3)
    expect(second.w).toBeCloseTo(0.6, 3)
    expect(deck.slides[1]?.backgroundImage).toContain('data:image/png;base64,')
  })

  it('把 gradFill 转成 CSS 渐变,而不是丢掉填充', async () => {
    const deck = await parsePptxVisual(await makePptx({ gradient: true }))
    const title = deck.slides[1]?.shapes[0]
    if (!title || title.kind !== 'text') throw new Error('title shape must be text')
    expect(title.fill).toContain('linear-gradient(')
    expect(title.fill).toContain('#FF0000')
    expect(title.fill).toContain('#0000FF')
  })

  it('渲染成幻灯片卡片,同时保留文字大纲入口', async () => {
    render(<PptxPreview data={await makePptx()} />)

    expect(await screen.findByTestId('pptx-visual-deck')).toBeTruthy()
    expect(screen.getByText('视觉标题')).toBeTruthy()
    expect(screen.getAllByTestId('pptx-visual-slide')).toHaveLength(2)
    const cards = screen.getAllByTestId('pptx-visual-slide')
    const bgCard = cards[1]?.firstElementChild as HTMLElement | null
    expect(bgCard?.style.backgroundImage).toContain('data:image/png;base64,')
    await waitFor(() => expect(screen.getByTestId('pptx-outline')).toBeTruthy())
    expect(screen.getByTestId('pptx-outline').textContent).toContain('第二页正文')
  })

  it('点击版式元素出 PPTX 批注采集卡,并派发 slide/element 结构化锚点', async () => {
    render(<PptxPreview data={await makePptx()} />)
    const hits = await screen.findAllByTestId('pptx-shape-hit')
    expect(hits.length).toBeGreaterThan(0)
    fireEvent.click(hits[0] as HTMLElement)

    const card = screen.getByTestId('pptx-anchor-capture')
    expect(card.querySelector('[data-anchor-kind="pptx"]')).toBeTruthy()

    const note = card.querySelector('[data-testid="annotation-anchor-note"]') as HTMLTextAreaElement
    fireEvent.change(note, { target: { value: '把正文换成结论' } })
    const received: AnchorReferenceDetail[] = []
    const listener = (e: Event): void => {
      received.push((e as CustomEvent<AnchorReferenceDetail>).detail)
    }
    window.addEventListener(ADD_TEXT_REFERENCE_EVENT, listener)
    fireEvent.click(card.querySelector('[data-action="add"]') as HTMLButtonElement)
    window.removeEventListener(ADD_TEXT_REFERENCE_EVENT, listener)

    expect(received).toHaveLength(1)
    expect(received[0]?.source).toBe('pptx-element')
    expect(received[0]?.anchor).toEqual({ kind: 'pptx', slide: 1, element: '正文 1' })
    expect(received[0]?.slide).toBe(1)
    expect(received[0]?.element).toBe('正文 1')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
