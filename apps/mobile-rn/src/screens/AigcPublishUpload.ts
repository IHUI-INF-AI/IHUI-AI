// © 2026 IHUI AI (智汇AI) · 版权所有者: 李
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AIGC 发布上传 — 带真实字节进度的 multipart 上传(仅 RN 端)。
 *
 * 立因(2026-11-03):api-client 的 uploadFileMultipart 走 fetch,RN 的 fetch 不暴露上传
 * 进度,共享屏只能拿一个 uploading 布尔值画出"假进度"。这里用 expo-file-system 的
 * UploadTask(底层 NSURLSession/OkHttp 真实回调 bytesSent/totalBytes)作为端口,
 * 把真实百分比交给共享屏渲染。
 *
 * 契约:onUploadProgress 收到的是 0-100 的整数百分比,来源必须是传输层回调;
 * 上传结束/失败由调用方清理进度,不得用定时器续命。
 */
import {
  getToken,
  refreshAccessTokenOnce,
  resolveFileUrl,
  type RnFormDataFile,
  type UploadedFile,
} from '@ihui/api-client'
import type { ApiResult } from '@ihui/types'
import { File, UploadType } from 'expo-file-system'

/** 传输层进度样本(字节数原始值,便于测试断言来源) */
export interface UploadProgressSample {
  loaded: number
  total: number
  percent: number
}

/** 上传任务端口:只暴露 uploadAsync,便于测试注入假任务 */
export interface UploadTaskLike {
  uploadAsync(): Promise<{ status: number; body: string }>
}

/** 上传任务工厂端口(真实实现包住 expo-file-system,测试可替换) */
export type UploadTaskFactory = (
  fileUri: string,
  url: string,
  options: {
    headers: Record<string, string>
    mimeType?: string
    /** 传输层原始字节回调;百分比在这里之后统一计算,避免各端算法漂移 */
    onBytes: (bytesSent: number, totalBytes: number) => void
  },
) => UploadTaskLike

/** 真实实现:expo-file-system 的上传任务;字节数来自原生传输层,不是造出来的 */
export const expoUploadTaskFactory: UploadTaskFactory = (fileUri, url, options) =>
  new File(fileUri).createUploadTask(url, {
    httpMethod: 'POST',
    uploadType: UploadType.MULTIPART,
    fieldName: 'file',
    mimeType: options.mimeType,
    headers: options.headers,
    onProgress: ({ bytesSent, totalBytes }) => options.onBytes(bytesSent, totalBytes),
  })

/**
 * 字节进度 → 百分比。
 * 上传完成前封顶 99:原生 multipart 的 totalBytes 含 boundary 开销,最后一帧可能
 * 先到 100% 再落盘;100 只在上传成功后由调用方写入,避免"100% 卡住"的假象。
 */
export function uploadPercent(bytesSent: number, totalBytes: number): number {
  if (!Number.isFinite(bytesSent) || !Number.isFinite(totalBytes) || totalBytes <= 0) return 0
  if (bytesSent <= 0) return 0
  return Math.min(99, Math.floor((bytesSent / totalBytes) * 100))
}

export interface UploadWithProgressOptions {
  /** 真实进度端口:0-100,逐帧来自传输层 bytesSent/totalBytes */
  onUploadProgress?: (percent: number, sample: UploadProgressSample) => void
  /** 测试注入点;缺省用 expo 真实上传任务 */
  taskFactory?: UploadTaskFactory
}

function authHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {}
}

interface UploadResponseBody {
  code?: number
  message?: string
  data?: { file?: UploadedFile }
}

async function parseUploadResult(status: number, body: string): Promise<ApiResult<UploadedFile>> {
  let json: UploadResponseBody
  try {
    json = JSON.parse(body) as UploadResponseBody
  } catch {
    return { success: false, error: `上传失败(${status})`, status }
  }
  if (status < 200 || status >= 300 || json.code !== 0) {
    return { success: false, error: json.message || `上传失败(${status})`, status }
  }
  const uploaded = json.data?.file
  if (!uploaded) return { success: false, error: '上传响应缺少文件数据', status }
  return { success: true, data: uploaded }
}

/**
 * 上传文件并回传真实进度。
 * 401 时按 api-client 既有策略续期一次后重放(与 fetchWithAuthRefresh 行为对齐)。
 */
export async function uploadFileWithProgress(
  file: RnFormDataFile,
  options: UploadWithProgressOptions = {},
): Promise<ApiResult<UploadedFile>> {
  const factory = options.taskFactory ?? expoUploadTaskFactory
  const url = resolveFileUrl('/api/files/upload/form')
  const onBytes = (bytesSent: number, totalBytes: number) => {
    const percent = uploadPercent(bytesSent, totalBytes)
    options.onUploadProgress?.(percent, { loaded: bytesSent, total: totalBytes, percent })
  }

  const run = async (token: string | null) => {
    const task = factory(file.uri, url, {
      headers: authHeaders(token),
      mimeType: file.type,
      onBytes,
    })
    return task.uploadAsync()
  }

  try {
    let result = await run(getToken())
    if (result.status === 401) {
      await refreshAccessTokenOnce()
      result = await run(getToken())
    }
    return await parseUploadResult(result.status, result.body)
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : '上传失败',
    }
  }
}
