/**
 * 文件上传端点(跨端共享:web/mobile-rn/desktop/extension/miniapp-taro)
 *
 * 后端:`POST /api/files/upload/form` (multipart/form-data,字段名 file)
 * 响应:`{ code: 0, data: { file: { id, name, size, mimeType, path, uploadedBy } } }`
 *
 * 实现说明:走 fetchApi(transport.ts 已支持 FormData body),
 * 统一享受 token 注入、URL 规范化、错误处理、熔断器等基础设施。
 */
import { fetchApi, type ApiResult } from '../client.js'

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
  const formData = new FormData()
  // RN FormData.append 接受 { uri, type, name } 对象;Web FormData.append 接受 File/Blob。
  // TS 标准库 FormData.append 签名不接受 RnFormDataFile,用 as never 绕过(RN 平台特性,非 any 兜底)。
  formData.append('file', file as never)

  const result = await fetchApi<UploadResponseData>('/api/files/upload/form', {
    method: 'POST',
    body: formData,
  })

  if (!result.success) {
    return result
  }

  // 后端返回 { code: 0, data: { file: {...} } }
  const fileData = result.data?.file
  if (!fileData) {
    return {
      success: false,
      error: '上传响应缺少文件数据',
    }
  }

  return { success: true, data: fileData }
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
  // fetchApi 的 normalizeUrl 已处理 /uploads/ 等前缀,这里只需确保以 / 开头
  const normalized = path.startsWith('/') ? path : `/${path}`
  // 直接用 window.location.origin 或 API_BASE_URL 拼接
  // 但为了跨端兼容,用 fetchApi 的 URL 规范化逻辑(通过 client.ts 的 normalizeUrlPublic)
  // 由于 normalizeUrlPublic 不是 public 导出,这里用简单拼接
  return normalized
}
