/**
 * 水印 API (图片文字 / 图片 Logo / 视频文字 / 视频 Logo)
 * 对接后端: resource/watermark 模块
 * 路由前缀: /api/v1/resource/watermark
 *
 * 注意: 后端接口均使用 Body 传值。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface WatermarkResult {
  outputPath: string
  success: boolean
  message?: string
}

function toDataResult(data: unknown, msg = 'success'): ApiResponse<unknown> {
  return {
    code: 0,
    message: msg,
    data,
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<unknown>
}

// ===========================================================================
// 水印操作
// ===========================================================================

/** 图片文字水印 (Body 传值) */
export async function watermarkImageText(data: {
  inputPath: string
  text: string
  outputPath: string
}): Promise<ApiResponse<WatermarkResult>> {
  const res = await http.post('/api/v1/resource/watermark/image/text', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WatermarkResult>
}

/** 图片 Logo 水印 (Body 传值) */
export async function watermarkImageLogo(data: {
  basePath: string
  logoPath: string
  outputPath: string
  position?: string
  scale?: number
}): Promise<ApiResponse<WatermarkResult>> {
  const res = await http.post('/api/v1/resource/watermark/image/logo', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WatermarkResult>
}

/** 视频文字水印 (Body 传值) */
export async function watermarkVideoText(data: {
  inputPath: string
  text: string
  outputPath: string
  fontSize?: number
  fontColor?: string
}): Promise<ApiResponse<WatermarkResult>> {
  const res = await http.post('/api/v1/resource/watermark/video/text', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WatermarkResult>
}

/** 视频 Logo 水印 (Body 传值) */
export async function watermarkVideoLogo(data: {
  inputPath: string
  logoPath: string
  outputPath: string
  position?: string
}): Promise<ApiResponse<WatermarkResult>> {
  const res = await http.post('/api/v1/resource/watermark/video/logo', data)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<WatermarkResult>
}

export const watermarkApi = {
  watermarkImageText,
  watermarkImageLogo,
  watermarkVideoText,
  watermarkVideoLogo,
}

export default watermarkApi