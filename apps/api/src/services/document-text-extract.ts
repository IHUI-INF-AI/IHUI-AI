// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 文档正文提取服务(2026-11-27 立)。
 *
 * 此前同一条「解析 PDF/Office → 纯文本」能力散在 office-ai 路由内部:
 * 前端 AI 文档面板能读、主对话附件却不能读,用户把同一份文件带进对话后模型只看到
 * `> 📎 报告.docx` 一行文件名。本模块把格式表与解析动作收成单一实现:
 * - `DOCUMENT_TEXT_EXTS` = 可提取正文的格式(与 RAG `parseDocument` 支持面一致);
 * - 旧版 Office / ODF 等解析失败时降级 LibreOffice → PDF → parseDocument;
 * - office-ai 路由与主对话附件链路都从这里取,禁止各自维护第二张格式表。
 */

import { createHash } from 'node:crypto'
import { extname } from 'node:path'
import { parseDocument, FileTooLargeError, UnsupportedFormatError } from './document-parser.js'
import { convertOfficeToPdf, OfficeConversionError } from './office-converter.js'

/** 可提取正文的文档扩展名(小写、无点)。新增格式只改这里。 */
export const DOCUMENT_TEXT_EXTS = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'ppt',
  'pptx',
  'odt',
  'odp',
  'ods',
  'rtf',
  'epub',
  'csv',
  'tsv',
  'txt',
  'md',
  'markdown',
  'json',
  'html',
  'htm',
])

/** 解析失败时可交给 LibreOffice 转 PDF 再解析的旧版/复杂 Office 格式。 */
const CONVERTIBLE_EXTS = new Set([
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
  'odt',
  'odp',
  'ods',
  'rtf',
])

export function extOfDocumentName(name: string): string {
  const ext = extname(name).slice(1).toLowerCase()
  return ext
}

export function isExtractableDocument(name: string): boolean {
  return DOCUMENT_TEXT_EXTS.has(extOfDocumentName(name))
}

/**
 * 正文缓存(2026-11-27 立,会话级续读的放大器)。
 *
 * 用户说“继续”时网关会按 fileId 重新取原始字节;若不缓存,同一份 20MB PDF
 * 每轮都要重新 parse,旧版 Office 还要再跑一次 LibreOffice。这里按
 * sha256(buffer)+文件名+mime 做 LRU:同一字节只解析一次,失败结果不进缓存。
 *
 * 只缓存最近 8 份;单份正文过大时仍会占内存,但上限可控。
 * 注意:这是进程内缓存,不跨 API 实例;蓝绿切换/重启后自然失效。
 */
const MAX_TEXT_CACHE_ENTRIES = 8
const textCache = new Map<string, Promise<string>>()

function textCacheKey(buffer: Buffer, name: string, mimeType: string): string {
  const hash = createHash('sha256').update(buffer).digest('hex')
  return `${name.toLowerCase()}|${mimeType.toLowerCase()}|${hash}`
}

async function extractDocumentTextUncached(
  buffer: Buffer,
  name: string,
  mimeType: string,
): Promise<string> {
  const ext = extOfDocumentName(name)
  try {
    return await parseDocument({ buffer, mimeType, filename: name })
  } catch (error) {
    if (!CONVERTIBLE_EXTS.has(ext)) throw error
    const pdf = await convertOfficeToPdf(buffer, name)
    return await parseDocument({
      buffer: pdf,
      mimeType: 'application/pdf',
      filename: `${name.replace(/\.[^.]+$/, '')}.pdf`,
    })
  }
}

/**
 * 读文档正文。解析器抛错且格式可转换时,走 LibreOffice → PDF → 再解析;
 * 其余错误原样抛出,由调用方按 `FileTooLargeError` / `OfficeConversionError` 映射文案。
 */
export async function extractDocumentText(
  buffer: Buffer,
  name: string,
  mimeType: string,
): Promise<string> {
  const key = textCacheKey(buffer, name, mimeType)
  const cached = textCache.get(key)
  if (cached) {
    // LRU:命中后移到队尾,淘汰最久未用的那一份。
    textCache.delete(key)
    textCache.set(key, cached)
    return cached
  }

  const pending = extractDocumentTextUncached(buffer, name, mimeType)
  textCache.set(key, pending)
  while (textCache.size > MAX_TEXT_CACHE_ENTRIES) {
    const oldest = textCache.keys().next().value
    if (!oldest) break
    textCache.delete(oldest)
  }
  pending.catch(() => {
    if (textCache.get(key) === pending) textCache.delete(key)
  })
  return pending
}

/** 测试/管理面用:清空进程内正文缓存,避免旧测试数据互相命中。 */
export function clearDocumentTextCache(): void {
  textCache.clear()
}

/** 给调用方判断错误类型用;不在本模块重新包一层错误类,避免第二套错误判据。 */
export { FileTooLargeError, UnsupportedFormatError, OfficeConversionError }
export type { OfficeConversionError as OfficeConversionErrorType }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
