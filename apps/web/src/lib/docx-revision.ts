// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * DOCX 段落级写回(2026-11-28 立,AI 修订稿的「原格式落地」)。
 *
 * 目标:用户接受若干行修订后,导出的不是一个另存的 Markdown,而是**原 Word 文件本身**:
 * 样式、编号、页眉页脚、表格结构都保留,只把被接受的段落文字换掉。
 *
 * 做法:docx 本质是 zip + `word/document.xml`。按 `<w:p>` 节点顺序取出段落,
 * 与正文提取(mammoth raw text)的非空行做 1:1 校验;任何一处对不上就**放弃写回**,
 * 由调用方降级 Markdown —— 宁可少一个格式,不能把文章错位写进别人的合同。
 *
 * 明确不支持:文本框(`w:txbxContent`,段落嵌套会让正则切分失真)。同样走降级。
 */

import JSZip from 'jszip'
import { computeHunkDiff } from './hunk-diff'

export type DocxPatchReason =
  | 'not-docx'
  | 'no-document'
  | 'zip-failed'
  | 'textbox-unsupported'
  | 'layout-mismatch'
  | 'empty-document'

export interface DocxPatchResult {
  bytes: Uint8Array | null
  reason?: DocxPatchReason
  /** 改写文字的段落数 */
  replacedParagraphs?: number
  /** 新增段落数 */
  insertedParagraphs?: number
  /** 删除段落数 */
  deletedParagraphs?: number
}

interface ParagraphNode {
  /** 在 document.xml 中的起止下标(半开) */
  start: number
  end: number
  xml: string
  text: string
}

/** 匹配 `<w:p ...>...</w:p>` 与自闭合 `<w:p/>`;文本框已提前排除,不存在嵌套段落。 */
const PARAGRAPH_RE = /<w:p(?:\s+[^>]*)?(?:\/>|>[\s\S]*?<\/w:p>)/g

const TEXT_TOKEN_RE =
  /<w:t(?:\s+[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab(?:\s+[^>]*)?\/>|<w:br(?:\s+[^>]*)?\/>/g

function decodeXmlText(raw: string): string {
  return (
    raw
      .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
        String.fromCodePoint(Number.parseInt(hex, 16)),
      )
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number.parseInt(dec, 10)))
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      // `&amp;` 必须最后解,否则会把 `&amp;lt;` 还原成 `<`
      .replace(/&amp;/g, '&')
  )
}

function escapeXmlText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragraphText(xml: string): string {
  const parts: string[] = []
  TEXT_TOKEN_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TEXT_TOKEN_RE.exec(xml)) !== null) {
    if (match[1] !== undefined) parts.push(decodeXmlText(match[1]))
    else if (match[0].startsWith('<w:tab')) parts.push('\t')
    else parts.push('\n')
  }
  return parts.join('')
}

function parseParagraphs(xml: string): ParagraphNode[] {
  const nodes: ParagraphNode[] = []
  PARAGRAPH_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PARAGRAPH_RE.exec(xml)) !== null) {
    const value = match[0]
    nodes.push({
      start: match.index,
      end: match.index + value.length,
      xml: value,
      text: paragraphText(value),
    })
  }
  return nodes
}

/** 正文提取按“非空行”对齐 docx 的“非空段落”;空段落只可能是排版空行,不参与修订映射。 */
function nonEmptyLines(text: string): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0)
}

/**
 * 把一段文字写进段落 XML:保留 `<w:pPr>` 与首个 run 的 `<w:rPr>`,
 * 其余 `<w:t>` 清空(不删 run,避免把批注/书签等附属节点一起丢掉)。
 */
function setParagraphText(xml: string, text: string): string | null {
  const textRe = /<w:t(?:\s+[^>]*)?>[\s\S]*?<\/w:t>/g
  if (textRe.test(xml)) {
    let first = true
    return xml.replace(textRe, () => {
      const content = first ? escapeXmlText(text) : ''
      first = false
      return `<w:t xml:space="preserve">${content}</w:t>`
    })
  }

  const runMatch = /<w:r(?:\s+[^>]*)?>[\s\S]*?<\/w:r>/.exec(xml)
  if (runMatch) {
    const insertAt = runMatch.index + runMatch[0].lastIndexOf('</w:r>')
    return `${xml.slice(0, insertAt)}<w:t xml:space="preserve">${escapeXmlText(
      text,
    )}</w:t>${xml.slice(insertAt)}`
  }

  const open = /^<w:p(?:\s+[^>]*)?>/.exec(xml)
  if (!open) return null
  const pPr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(xml)?.[0] ?? ''
  return `${open[0]}${pPr}<w:r><w:t xml:space="preserve">${escapeXmlText(text)}</w:t></w:r></w:p>`
}

/**
 * 用修订后的行替换原段落。`originalText` 必须与 docx 正文提取结果一致
 * (即同一份文件、同一条提取链路),否则返回 `layout-mismatch`。
 */
export async function patchDocxParagraphTexts(
  data: Uint8Array,
  originalText: string,
  mergedText: string,
): Promise<DocxPatchResult> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(data)
  } catch {
    return { bytes: null, reason: 'not-docx' }
  }

  const entry = zip.file('word/document.xml')
  if (!entry) return { bytes: null, reason: 'no-document' }

  let xml: string
  try {
    xml = await entry.async('string')
  } catch {
    return { bytes: null, reason: 'zip-failed' }
  }

  // 文本框里会出现嵌套 <w:p>,正则切分会把外层段落提前截断,直接放弃写回。
  if (xml.includes('<w:txbxContent')) {
    return { bytes: null, reason: 'textbox-unsupported' }
  }

  const docParagraphs = parseParagraphs(xml).filter((node) => node.text.trim().length > 0)
  const originalLines = nonEmptyLines(originalText)
  const mergedLines = nonEmptyLines(mergedText)

  if (docParagraphs.length === 0 || mergedLines.length === 0) {
    return { bytes: null, reason: 'empty-document' }
  }
  if (docParagraphs.length !== originalLines.length) {
    return { bytes: null, reason: 'layout-mismatch' }
  }
  for (let index = 0; index < docParagraphs.length; index += 1) {
    if (docParagraphs[index]!.text.trim() !== originalLines[index]!.trim()) {
      return { bytes: null, reason: 'layout-mismatch' }
    }
  }

  const diff = computeHunkDiff(originalLines.join('\n'), mergedLines.join('\n'))
  if (diff.hunks.length === 0) {
    return {
      bytes: data,
      replacedParagraphs: 0,
      insertedParagraphs: 0,
      deletedParagraphs: 0,
    }
  }

  const finalXml = new Array<string | null>(docParagraphs.length).fill(null)
  const after: string[][] = docParagraphs.map(() => [])
  const before: string[] = []
  let replaced = 0
  let inserted = 0
  let deleted = 0

  for (const hunk of diff.hunks) {
    const oldCount = hunk.oldEnd - hunk.oldStart
    const newLines = hunk.newLines.map((line) => line.text)
    const pairCount = Math.min(oldCount, newLines.length)

    for (let offset = 0; offset < pairCount; offset += 1) {
      const node = docParagraphs[hunk.oldStart + offset]
      if (!node) return { bytes: null, reason: 'layout-mismatch' }
      const next = setParagraphText(node.xml, newLines[offset] ?? '')
      if (next === null) return { bytes: null, reason: 'layout-mismatch' }
      finalXml[hunk.oldStart + offset] = next
      replaced += 1
    }

    for (let offset = pairCount; offset < oldCount; offset += 1) {
      finalXml[hunk.oldStart + offset] = null
      deleted += 1
    }

    const extraLines = newLines.slice(pairCount)
    if (extraLines.length > 0) {
      const anchor = pairCount > 0 ? hunk.oldStart + pairCount - 1 : hunk.oldStart - 1
      const template =
        (anchor >= 0 ? docParagraphs[anchor] : undefined) ??
        docParagraphs[hunk.oldStart] ??
        docParagraphs[docParagraphs.length - 1]
      if (!template) return { bytes: null, reason: 'layout-mismatch' }
      const insertedXml: string[] = []
      for (const line of extraLines) {
        const next = setParagraphText(template.xml, line)
        if (next === null) return { bytes: null, reason: 'layout-mismatch' }
        insertedXml.push(next)
      }
      if (anchor >= 0) after[anchor]!.push(...insertedXml)
      else before.push(...insertedXml)
      inserted += insertedXml.length
    }
  }

  // 未命中的段落原样保留(computeHunkDiff 保证 equal 行不被改写)。
  for (let index = 0; index < docParagraphs.length; index += 1) {
    if (finalXml[index] === null && !isDeletedIndex(diff, index)) {
      finalXml[index] = docParagraphs[index]!.xml
    }
    finalXml[index] ??= null
  }

  const segments: string[] = []
  let cursor = 0
  for (let index = 0; index < docParagraphs.length; index += 1) {
    const node = docParagraphs[index]!
    segments.push(xml.slice(cursor, node.start))
    if (index === 0 && before.length > 0) segments.push(before.join(''))
    const replacement = finalXml[index]
    if (replacement) segments.push(replacement)
    if (after[index]!.length > 0) segments.push(after[index]!.join(''))
    cursor = node.end
  }
  segments.push(xml.slice(cursor))

  try {
    zip.file('word/document.xml', segments.join(''))
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' })
    return {
      bytes,
      replacedParagraphs: replaced,
      insertedParagraphs: inserted,
      deletedParagraphs: deleted,
    }
  } catch {
    return { bytes: null, reason: 'zip-failed' }
  }
}

/** 该段落是否属于某个 hunk 的删除区间。 */
function isDeletedIndex(diff: ReturnType<typeof computeHunkDiff>, index: number): boolean {
  return diff.hunks.some((hunk) => index >= hunk.oldStart && index < hunk.oldEnd)
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
