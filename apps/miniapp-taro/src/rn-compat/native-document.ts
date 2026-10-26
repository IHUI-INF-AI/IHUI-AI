// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * rn-compat/native-document.ts —— `expo-document-picker` 在小程序端的**等价实现**(Taro.chooseMessageFile)。
 *
 * 为什么必须补(2026-10-26 造页器现读):`expo-document-picker` 入口发未编译 TS,HomeScreen / ChatScreen /
 * AgentChat 一族壳的附件与导入链都引它 ⇒ 闭包射程里缺这枚别名,weapp 构建当场 ModuleParseError。
 *
 * 消费面(现读穷举):`getDocumentAsync({ type: string|string[], copyToCacheDirectory, multiple })`
 *   → `{ canceled, type, assets: [{ name, size, uri, mimeType, extension }] }`
 *   (PdfToolsScreen / PublishNewScreen / VoiceSttScreen / ConversationImportScreen / HomeScreen / ChatScreen / AiAssistantN8nScreen)
 *
 * 平台事实与降级(逐处点名,不静默):
 *   · 微信没有"系统文件选取器",只有**从聊天记录选取**(`chooseMessageFile`)⇒ 用户得先把文件发到会话里。
 *     这是平台边界,不是实现缺口:选出来的文件仍走同一条上传链(拿到 tempFiles.path 即可 uploadFile)。
 *   · `copyToCacheDirectory`:微信返回的 tempFilePath 本来就是临时缓存路径 ⇒ 无需二次拷贝,按 true 处理。
 *   · `type` 是 MIME,`chooseMessageFile` 只吃扩展名 ⇒ 按 MIME_BY_EXT 反查;反查不到(通配档、
 *     未登记的新 MIME)⇒ **不加过滤**并告警一次。失效方向是多放一类可选文件,不是把用户选不到当成功。
 *   · 平台不支持该 API(非微信端 / 低版本)⇒ 返回 `{ canceled:true }`,调用方全部有 canceled 分支。
 *   · `multiple`:expo 侧 RN 代码从未传 true(现读),这里按 count = multiple ? 9 : 1 承住语义。
 */
import Taro from '@tarojs/taro'

const warned = new Set<string>()
function warnOnce(id: string, message: string): void {
  if (warned.has(id)) return
  warned.add(id)
  console.warn(`[rn-compat] ${message}`)
}

/** MIME ⇄ 扩展名(与 RN 侧附件白名单同源的那些档;双向查表,不另起一套判据) */
const MIME_BY_EXT: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  json: 'application/json',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  mp4: 'video/mp4',
}

const EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(MIME_BY_EXT).map(([ext, mime]) => [mime, ext]),
)

function mimeFromName(name: string): string {
  const ext = String(name).split('.').pop()?.toLowerCase() ?? ''
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export type DocumentPickerAsset = {
  uri: string
  name: string
  mimeType: string
  size: number
  extension: string
}

export type DocumentPickerResult = {
  canceled: boolean
  type: 'cancel' | 'success' | 'error'
  assets: DocumentPickerAsset[]
}

export type GetDocumentOptions = {
  type?: string | string[]
  multiple?: boolean
  copyToCacheDirectory?: boolean
  /** expo 侧同名档(小程序无对应能力,只点名不实现) */
  leftMenuLabel?: string
}

function extensionsFor(type: string | string[] | undefined): string[] {
  const list = type === undefined ? [] : Array.isArray(type) ? type : [type]
  const out: string[] = []
  for (const item of list) {
    if (item === '*/*' || item.endsWith('/*')) continue
    const ext = EXT_BY_MIME[item]
    if (ext) out.push(ext)
    else if (!item.includes('/'))
      out.push(item.replace(/^\./, '').toLowerCase()) // 调用方直接给扩展名的写法
    else
      warnOnce(
        `doc-mime-${item}`,
        `expo-document-picker:type '${item}' 不在端内 MIME⇄扩展名对照表里 ⇒ 本轮不按扩展名过滤(可能多选到无关文件)`,
      )
  }
  return [...new Set(out)]
}

export async function getDocumentAsync(
  options: GetDocumentOptions = {},
): Promise<DocumentPickerResult> {
  const choose = (Taro as unknown as { chooseMessageFile?: unknown }).chooseMessageFile
  if (typeof choose !== 'function') {
    warnOnce(
      'doc-unsupported',
      'expo-document-picker:本平台没有"从聊天记录选文件"的能力 ⇒ 返回 canceled,调用方按未选处理',
    )
    return { canceled: true, type: 'cancel', assets: [] }
  }
  const extension = extensionsFor(options.type)
  try {
    const res = await Taro.chooseMessageFile({
      count: options.multiple ? 9 : 1,
      type: 'file',
      ...(extension.length > 0 ? { extension } : {}),
    })
    const assets: DocumentPickerAsset[] = (res.tempFiles ?? []).map((file) => {
      const name = String(file.name ?? '')
      const uri = String(file.path ?? '')
      return {
        uri,
        name,
        mimeType: mimeFromName(name || uri),
        size: Number(file.size ?? 0),
        extension: name.includes('.') ? name.split('.').pop()!.toLowerCase() : '',
      }
    })
    if (assets.length === 0) return { canceled: true, type: 'cancel', assets: [] }
    return { canceled: false, type: 'success', assets }
  } catch {
    // 用户取消与接口报错在微信侧都落 fail ⇒ 统一按 canceled 返回(调用方不区分这两态,现读)
    return { canceled: true, type: 'cancel', assets: [] }
  }
}

/** 与 expo 同名的批量档(现读调用方只用单文件档,这里按同一实现承接 multiple) */
export async function getDocumentsAsync(
  options: GetDocumentOptions = {},
): Promise<DocumentPickerResult> {
  return getDocumentAsync({ ...options, multiple: true })
}

export const types = {
  allFiles: '*/*',
  pdf: 'application/pdf',
  plainText: 'text/plain',
  images: 'image/*',
}

export default { getDocumentAsync, getDocumentsAsync, types }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
