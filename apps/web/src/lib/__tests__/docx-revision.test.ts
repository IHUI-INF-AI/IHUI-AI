// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, expect, it } from 'vitest'
import { patchDocxParagraphTexts } from '../docx-revision'
import { countParagraphs, makeDocx, readDocumentXml } from './fixtures/make-docx'

/**
 * docx 段落写回单测(2026-11-28 立)。
 *
 * 锁三条:改一行只动那一行、增删行数能落到段落、对不上结构就拒绝写回。
 * 最后一条最重要 —— 宁可降级 Markdown,也不能把修订错位写进别人的合同。
 */
describe('patchDocxParagraphTexts', () => {
  const original = '总则\n第一条 甲方应于三日内付款。\n第二条 乙方应按期交付。'

  it('改一行只替换该段文字,其余段落与样式保持', async () => {
    const bytes = await makeDocx(original.split('\n'), { stylePerParagraph: true })
    const patched = await patchDocxParagraphTexts(
      bytes,
      original,
      '总则\n第一条 甲方应于五个工作日内付款。\n第二条 乙方应按期交付。',
    )

    expect(patched.bytes).toBeTruthy()
    expect(patched.replacedParagraphs).toBe(1)
    const xml = await readDocumentXml(patched.bytes!)
    expect(xml).toContain('甲方应于五个工作日内付款')
    expect(xml).not.toContain('三日内付款')
    // 首段样式(Heading1)与加粗 run 未被改写
    expect(xml).toContain('w:val="Heading1"')
    expect(xml).toContain('<w:b/>')
    expect(countParagraphs(xml)).toBe(3)
  })

  it('插入新段落:落成新的 <w:p>,并沿用相邻段落样式', async () => {
    const bytes = await makeDocx(original.split('\n'))
    const patched = await patchDocxParagraphTexts(
      bytes,
      original,
      `${original}\n第三条 未尽事宜由双方协商。`,
    )

    expect(patched.insertedParagraphs).toBe(1)
    const xml = await readDocumentXml(patched.bytes!)
    expect(xml).toContain('第三条 未尽事宜由双方协商')
    expect(countParagraphs(xml)).toBe(4)
  })

  it('删除段落:对应 <w:p> 不再出现', async () => {
    const bytes = await makeDocx(original.split('\n'))
    const patched = await patchDocxParagraphTexts(bytes, original, '总则\n第二条 乙方应按期交付。')

    expect(patched.deletedParagraphs).toBe(1)
    const xml = await readDocumentXml(patched.bytes!)
    expect(xml).not.toContain('第一条 甲方应于三日内付款')
    expect(countParagraphs(xml)).toBe(2)
  })

  it('段落数与正文提取不一致时拒绝写回,不猜位置', async () => {
    const bytes = await makeDocx(['第一段', '第二段', '第三段'])
    const patched = await patchDocxParagraphTexts(bytes, '第一段\n第二段', '第一段\n第二段（改）')
    expect(patched.bytes).toBeNull()
    expect(patched.reason).toBe('layout-mismatch')
  })

  it('文本框文档不写回:嵌套段落会让正则切分失真', async () => {
    const bytes = await makeDocx(['第一段'], { textbox: true })
    const patched = await patchDocxParagraphTexts(bytes, '第一段', '第一段（改）')
    expect(patched.bytes).toBeNull()
    expect(patched.reason).toBe('textbox-unsupported')
  })

  it('非 zip 字节直接判定 not-docx', async () => {
    const patched = await patchDocxParagraphTexts(
      new Uint8Array([1, 2, 3, 4]),
      '第一段',
      '第一段（改）',
    )
    expect(patched.bytes).toBeNull()
    expect(patched.reason).toBe('not-docx')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
