/**
 * 文件上传端点(跨端共享:web/mobile-rn/desktop/extension/miniapp-taro)
 *
 * 后端:`POST /api/files/upload/form` (multipart/form-data,字段名 file)
 * 响应:`{ code: 0, data: { file: { id, name, size, mimeType, path, uploadedBy } } }`
 *
 * 实现说明:不走 fetchApi,因为 transport.ts 的 TransportInit.body 类型为 string,
 * fetchOnce 会把 FormData body 转为 undefined。此处直接用 native fetch,
 * RN 与浏览器均原生支持 FormData + multipart 自动 boundary。
 */
import type { ApiResult, ApiResponse } from '@ihui/types'
import { getToken, normalizeUrlPublic } from '../client'

/** 后端 /api/files/upload/form 返回的文件信息 */
export interface UploadedFile {
  id: string
  name: string
  size: number
  mimeType: string
  path: string
  uploadedBy: string
}

/** React Native FormData.append 接受的文件对象形态 */
export interface RnFormDataFile {
  uri: string
  type: string
  name: string
}

/** 后端响应数据格式:`data` 可能为 `{ file: UploadedFile }` 或直接 `UploadedFile` */
interface UploadResponseData {
  file?: UploadedFile
}

/**
 * 通过 multipart/form-data 上传文件到 /api/files/upload/form。
 *
 * @param file - RN 端用 `{ uri, type, name }`;Web 端用 File 对象
 * @returns ApiResult<UploadedFile>
 */
export async function uploadFileMultipart(
  file: RnFormDataFile | File,
): Promise<ApiResult<UploadedFile>> {
  try {
    const formData = new FormData()
    // RN FormData.append 接受 { uri, type, name } 对象;Web FormData.append 接受 File/Blob。
    // TS 标准库 FormData.append 签名不接受 RnFormDataFile,用 as never 绕过(RN 平台特性,非 any 兜底)。
    formData.append('file', file as never)

    const url = normalizeUrlPublic('/api/files/upload/form')
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`
    // 不设置 Content-Type,让 fetch 自动生成 multipart boundary

    const resp = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
      credentials: 'include',
    })

    const json = (await resp.json()) as ApiResponse<UploadResponseData>

    if (!resp.ok) {
      return {
        success: false,
        error: json.message || `上传失败(${resp.status})`,
        status: resp.status,
      }
    }

    if (json.code !== 0) {
      return {
        success: false,
        error: json.message || '上传失败',
        status: resp.status,
      }
    }

    // 后端返回 { code: 0, data: { file: {...} } }
    const data = json.data
    const fileData = data?.file
    if (!fileData) {
      return {
        success: false,
        error: '上传响应缺少文件数据',
        status: resp.status,
      }
    }

    return { success: true, data: fileData }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '上传失败',
    }
  }
}

/**
 * 把后端返回的 path 解析为可访问的 URL。
 *
 * - path 以 `http(s)://` 开头 → 直接返回(后端返回完整 URL 的场景)
 * - path 以 `/` 开头 → 走 normalizeUrlPublic(命中 /uploads/ 等前缀直传,其余补 /api/)
 * - path 为相对路径 → 补 `/` 前缀后走 normalizeUrlPublic
 */
export function resolveFileUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path
  const normalized = path.startsWith('/') ? path : `/${path}`
  return normalizeUrlPublic(normalized)
}
