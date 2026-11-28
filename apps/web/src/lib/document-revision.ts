// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文档修订稿的行级差异与导出(2026-11-28 立,AI 修订层)。
 *
 * 立因:AI 产出「整篇修订稿」后,产品要的不是再读一遍长文,而是**逐处确认**:
 * 哪几行改了、改成了什么、接受还是驳回、最终导出的文件到底是哪一版。
 *
 * 三条纪律:
 *  - diff 只有一份实现:直接复用 `hunk-diff` 的 LCS + hunk 重组,不再写第二套;
 *  - 接受/驳回以 hunk 为单位,`buildPartialContent` 保证未触碰区域逐字节不变;
 *  - 导出按原格式回写:docx 走段落级 XML 改写(保留样式),其余文本格式保扩展名,
 *    PDF/PPTX/XLSX 这类没有可靠写回面的格式统一降级为 Markdown 修订稿并显式告知。
 */

import { buildPartialContent, computeHunkDiff, type HunkDiff } from './hunk-diff'
import { patchDocxParagraphTexts, type DocxPatchReason } from './docx-revision'

/** 修订文本块(与服务端 /api/office/revise 的响应字段同名)。 */
export interface RevisionDocument {
  originalText: string
  revisedText: string
}

export interface RevisionStats {
  added: number
  removed: number
  hunks: number
}

/** 走行级 diff;空文档没有可对比的行,返回空结构而不是抛错。 */
export function buildRevisionDiff(originalText: string, revisedText: string): HunkDiff {
  return computeHunkDiff(originalText, revisedText)
}

export function revisionStats(diff: HunkDiff): RevisionStats {
  let added = 0
  let removed = 0
  for (const hunk of diff.hunks) {
    added += hunk.added
    removed += hunk.removed
  }
  return { added, removed, hunks: diff.hunks.length }
}

/**
 * 行内差异切片(2026-11-28 二轮):行级 diff 会把「改了两个字」的整段都涂红/绿,
 * 长条款看着像整条重写。这里按公共前缀/后缀切出真正变的那一截,交给 UI 只加重
 * 那一小段底色;前缀后缀原样保留。纯新增/纯删除时 oldChanged/newChanged 为空。
 */
export interface InlineSegments {
  prefix: string
  oldChanged: string
  newChanged: string
  suffix: string
}

export function inlineDiffSegments(oldText: string, newText: string): InlineSegments {
  let start = 0
  while (start < oldText.length && start < newText.length && oldText[start] === newText[start]) {
    start += 1
  }
  let endOld = oldText.length
  let endNew = newText.length
  while (endOld > start && endNew > start && oldText[endOld - 1] === newText[endNew - 1]) {
    endOld -= 1
    endNew -= 1
  }
  return {
    prefix: oldText.slice(0, start),
    oldChanged: oldText.slice(start, endOld),
    newChanged: newText.slice(start, endNew),
    suffix: oldText.slice(endOld),
  }
}

/** 默认全接受:AI 给的是“建议稿”,用户只需驳回不认可的 hunk。 */
export function allHunkIds(diff: HunkDiff): Set<number> {
  return new Set(diff.hunks.map((hunk) => hunk.id))
}

/** 合并:以原文为基线,只应用已接受的 hunk;全驳回时输出与原文逐字节一致。 */
export function mergeRevision(
  originalText: string,
  diff: HunkDiff,
  accepted: ReadonlySet<number>,
): string {
  return buildPartialContent(originalText, diff.hunks, accepted)
}

/** 保留原扩展名的文本类格式(能安全回写)。 */
const TEXT_REVISION_EXTS = new Set([
  'txt',
  'text',
  'md',
  'markdown',
  'csv',
  'tsv',
  'log',
  'jsonl',
  'json',
  'html',
  'htm',
])

const MIME_BY_EXT: Record<string, string> = {
  txt: 'text/plain;charset=utf-8',
  text: 'text/plain;charset=utf-8',
  md: 'text/markdown;charset=utf-8',
  markdown: 'text/markdown;charset=utf-8',
  csv: 'text/csv;charset=utf-8',
  tsv: 'text/tab-separated-values;charset=utf-8',
  log: 'text/plain;charset=utf-8',
  jsonl: 'application/x-ndjson;charset=utf-8',
  json: 'application/json;charset=utf-8',
  html: 'text/html;charset=utf-8',
  htm: 'text/html;charset=utf-8',
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

/** TS 5.7 的 Uint8Array 带 ArrayBufferLike 泛型,BlobPart 只接受 ArrayBuffer;拷一份归一到 ArrayBuffer。 */
function bytesToBlobPart(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength)
  new Uint8Array(buffer).set(bytes)
  return buffer
}

export function extOfRevisionName(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

/** 去掉原扩展名后加 `-修订稿`,避免把 `报告.docx` 变成 `报告.docx-修订稿.md`。 */
export function revisionFileName(name: string, ext: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}-修订稿.${ext}`
}

export interface RevisionExportInput {
  name: string
  mergedText: string
  originalText: string
  /** 原文件字节;docx 段级写回需要它,拿不到时降级 Markdown。 */
  originalBytes?: Uint8Array | null
}

export interface RevisionExportResult {
  blob: Blob
  filename: string
  /** `docx` = 已把接受的行写回 Word 段落;`text` = 按文本格式导出;`markdown` = 降级 */
  mode: 'docx' | 'text' | 'markdown'
  /** docx 无法写回时的原因,UI 据此提示“已改为 Markdown 修订稿”。 */
  fallbackReason?: DocxPatchReason
}

/**
 * 导出修订稿。
 *  - docx 且能拿到原始字节 → 段落级写回,保留原样式、页眉页脚与表格结构;
 *  - txt/md/csv 等文本格式 → 同名 `-修订稿` + 原扩展名;
 *  - 其余(PDF/PPTX/XLSX) → Markdown 修订稿,不伪装成“原格式已改写”。
 */
export async function exportRevision(input: RevisionExportInput): Promise<RevisionExportResult> {
  const ext = extOfRevisionName(input.name)

  if (ext === 'docx' && input.originalBytes) {
    const patched = await patchDocxParagraphTexts(
      input.originalBytes,
      input.originalText,
      input.mergedText,
    )
    if (patched.bytes) {
      return {
        blob: new Blob([bytesToBlobPart(patched.bytes)], { type: DOCX_MIME }),
        filename: revisionFileName(input.name, 'docx'),
        mode: 'docx',
      }
    }
    return {
      blob: new Blob([input.mergedText], { type: MIME_BY_EXT.md }),
      filename: revisionFileName(input.name, 'md'),
      mode: 'markdown',
      fallbackReason: patched.reason,
    }
  }

  if (TEXT_REVISION_EXTS.has(ext)) {
    const mime = MIME_BY_EXT[ext] ?? MIME_BY_EXT.txt
    return {
      blob: new Blob([input.mergedText], { type: mime }),
      filename: revisionFileName(input.name, ext),
      mode: 'text',
    }
  }

  return {
    blob: new Blob([input.mergedText], { type: MIME_BY_EXT.md }),
    filename: revisionFileName(input.name, 'md'),
    mode: 'markdown',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
