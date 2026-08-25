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
 * 上传预校验选项(2026-08-25 上传链路审计加固)。
 * 服务端校验为最终防线;客户端预校验用于超大/超类型文件在发起请求前快速失败,
 * 避免把整个文件流上传后才收到 400。
 */
export interface UploadOptions {
  /** 文件大小上限(字节)。RN 文件无 size 字段时自动跳过大小校验。 */
  maxSize?: number
  /** 允许的 MIME 类型列表(大小写不敏感)。未传则跳过类型校验。 */
  allowedTypes?: string[]
}

/** GET /api/files/upload/form 返回的上传表单元数据(后端已带 maxSize)。 */
export interface UploadFormInfo {
  uploadUrl: string
  method: string
  encoding: string
  field: string
  maxSize: number
}

/** 取上传文件的 MIME 类型(RN 与 Web 统一)。 */
function getFileType(file: RnFormDataFile | File): string {
  if (typeof File !== 'undefined' && file instanceof File) return file.type
  return (file as RnFormDataFile).type
}

/** 取上传文件大小(仅 Web File 可用;RN 对象无 size 字段,返回 undefined)。 */
function getFileSize(file: RnFormDataFile | File): number | undefined {
  if (typeof File !== 'undefined' && file instanceof File) return file.size
  return undefined
}

/**
 * 获取上传表单信息(GET /api/files/upload/form)。
 * 后端在本地存储模式返回 uploadUrl/method/encoding/field/maxSize,
 * 调用方拿到 maxSize 后可传给 uploadFileMultipart 做客户端预校验。
 */
export async function getUploadFormInfo(): Promise<ApiResult<UploadFormInfo>> {
  try {
    const url = normalizeUrlPublic('/api/files/upload/form')
    const token = getToken()
    const headers: Record<string, string> = {}
    if (token) headers['Authorization'] = `Bearer ${token}`

    const resp = await fetch(url, {
      method: 'GET',
      headers,
      credentials: 'include',
    })
    const json = (await resp.json()) as ApiResponse<UploadFormInfo>

    if (!resp.ok || json.code !== 0) {
      return {
        success: false,
        error: json.message || `获取上传配置失败(${resp.status})`,
        status: resp.status,
      }
    }
    return { success: true, data: json.data }
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '获取上传配置失败',
    }
  }
}

/**
 * 通过 multipart/form-data 上传文件到 /api/files/upload/form。
 *
 * @param file - RN 端用 `{ uri, type, name }`;Web 端用 File 对象
 * @param options - 可选客户端预校验(maxSize/allowedTypes),命中即在上传前快速失败
 * @returns ApiResult<UploadedFile>
 */
export async function uploadFileMultipart(
  file: RnFormDataFile | File,
  options?: UploadOptions,
): Promise<ApiResult<UploadedFile>> {
  try {
    // 客户端预校验(2026-08-25 上传链路审计加固):服务端仍会二次校验,此处仅为快速失败
    if (options?.allowedTypes && options.allowedTypes.length > 0) {
      const fileType = getFileType(file).toLowerCase()
      if (fileType && !options.allowedTypes.some((t) => t.toLowerCase() === fileType)) {
        return { success: false, error: `不支持的文件类型: ${fileType}` }
      }
    }
    if (options?.maxSize !== undefined) {
      const fileSize = getFileSize(file)
      if (fileSize !== undefined && fileSize > options.maxSize) {
        const mb = (options.maxSize / 1024 / 1024).toFixed(0)
        return { success: false, error: `文件大小超过 ${mb}MB` }
      }
    }

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
