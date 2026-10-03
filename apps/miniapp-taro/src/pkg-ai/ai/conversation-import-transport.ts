// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话导入的平台传输层(小程序端)。
 *
 * 从页面里拆出来的理由有两条,都是硬的:
 *   ① 依赖方向 —— 页面持有 React 状态,传输层是纯 Promise 函数。混在一起时
 *      测「选文件/解析响应」这类判序必须把 React 一起拖进夹具。
 *   ② 行数 —— AGENTS.md §4「每个页面 < 250 行」,页面只该留「取词 + 编排 + 状态」。
 *
 * 与端内既有上传(upload-image.ts)同口径:`joinUrl(BASE_URL, path)` 拼地址、
 * `getToken()` 取 Bearer 头 —— 合法域名白名单是按 BASE_URL 配的,自己拼域名必翻车。
 */
import Taro from '@tarojs/taro'
import { joinUrl } from '@ihui/shared/utils/image-helpers'
import { BASE_URL } from '@/utils/api-config'
import { getToken } from '@/utils/auth'
import type { ConversationImportSource } from '@ihui/api-client'

/** /parse 端点(与 api-client 同一串;/api 前缀由 BASE_URL 自带) */
export const PARSE_URL = joinUrl(BASE_URL, '/user/conversation-import/parse')

/** 上传超时:解析是逐行读导出文件的同步阻塞调用,不能套 transport 的默认 30s */
export const PARSE_TIMEOUT_MS = 120_000

/** 选中的导出文件(tempFilePath 供上传,name 供后缀白名单与 commit 的 fileName) */
export interface PickedImportFile {
  path: string
  name: string
  size: number
}

/** chooseMessageFile 的返回条目(端内 ai-chat-detail 已按同一形状自定义声明) */
interface ChooseMessageFileEntry {
  path?: string
  name?: string
  size?: number
}
interface ChooseMessageFileRes {
  tempFiles?: ChooseMessageFileEntry[]
}

/** 从 tempFilePath 末段取文件名(带后缀才能过后端白名单;无后缀名会被服务端 400) */
export function fileNameFromPath(filePath: string): string {
  return filePath.split(/[/?#]/).filter(Boolean).pop() ?? 'conversation-export'
}

/**
 * 从微信会话里选导出文件(微信原生「从会话中选择文件」,端内 InputArea /
 * ModelConfigDialog / ai-chat-detail 三处同口径)。
 *
 * error 为 null 有两种含义,页面据此区分「用户取消」(静默返回)与「真的选不出」
 * (如实报错)—— 把取消当错误会给每次放弃都弹一次红字。
 */
export async function pickImportFile(args: {
  extensions: readonly string[]
  choose: () => Promise<unknown>
}): Promise<{ file: PickedImportFile | null; error: string | null }> {
  const { extensions, choose } = args
  try {
    const res = (await choose()) as ChooseMessageFileRes
    const entry = (res?.tempFiles ?? [])[0]
    const path = entry?.path
    if (!path) {
      // 按 extension 过滤后可能一个都没选到 —— 如实报错,不静默当作"用户取消"
      return { file: null, error: extensions.length > 0 ? 'no-file' : 'choose-failed' }
    }
    return {
      file: { path, name: entry?.name || fileNameFromPath(path), size: entry?.size ?? 0 },
      error: null,
    }
  } catch (e) {
    const msg = String((e as { errMsg?: string })?.errMsg ?? '')
    if (msg.toLowerCase().includes('cancel')) return { file: null, error: null }
    return { file: null, error: msg || 'choose-failed' }
  }
}

/**
 * /parse 上传响应 → 裸 JSON;非 2xx 抛服务端原文,2xx 但非 JSON 也抛(不编造空预览)。
 *
 * api 侧错误体是 `{ code, message }`(apps/api/src/utils/response.ts 的 error());
 * 能解出 message 就用原文上屏,解不出(如网关 HTML)才退状态码。
 */
export function readParseResponse(payload: { statusCode: number; data: string }): unknown {
  if (payload.statusCode < 200 || payload.statusCode >= 300) {
    let detail = `HTTP ${payload.statusCode}`
    try {
      const body = JSON.parse(payload.data) as { message?: string; msg?: string }
      detail = body?.message || body?.msg || detail
    } catch {
      /* 非 JSON 错误体(如网关 HTML)保留状态码 */
    }
    throw new Error(detail)
  }
  try {
    return JSON.parse(payload.data)
  } catch {
    throw new Error('parse-response-invalid')
  }
}

/** 上传并解析;传输层失败与响应异常都抛出可展示原因(不静默返回空预览) */
export async function uploadAndParse(args: {
  file: PickedImportFile
  source: ConversationImportSource
  networkErrorText: string
}): Promise<unknown> {
  const { file, source, networkErrorText } = args
  const raw = await new Promise<{ statusCode: number; data: string }>((resolve, reject) => {
    const token = getToken()
    Taro.uploadFile({
      url: PARSE_URL,
      filePath: file.path,
      name: 'file',
      // 不设 Content-Type:带 boundary 的头由 uploadFile 自己生成,手设会破坏分片
      formData: { source },
      header: token ? { Authorization: `Bearer ${token}` } : {},
      timeout: PARSE_TIMEOUT_MS,
      success: (res) => resolve({ statusCode: res.statusCode, data: res.data }),
      fail: (e) => reject(new Error(String(e?.errMsg || networkErrorText))),
    })
  })
  return readParseResponse(raw)
}
// PLACEHOLDER-TAIL
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
