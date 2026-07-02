/**
 * 豆包图像编辑 API (图像编辑/图像生成/模型列表)
 * 对接后端: app/api/v1/doubao_image_edit.py
 * 路由前缀: /api/v1/doubao-image-edit
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

/** 豆包图像编辑参数 (Body embed) */
export interface DoubaoEditParams {
  /** 模型名称 */
  model: string
  /** 图像 URL (与 imageBase64 二选一) */
  imageUrl?: string
  /** 图像 Base64 (与 imageUrl 二选一) */
  imageBase64?: string
  /** 提示词 */
  prompt: string
  /** 随机种子 */
  seed?: number
  /** 引导尺度 */
  guidanceScale?: number
  /** 是否添加水印 */
  watermark?: boolean
  /** API Key */
  apiKey?: string
}

/** 豆包图像生成参数 (Body embed) */
export interface DoubaoGenerateParams {
  /** 模型名称 */
  model: string
  /** 提示词 */
  prompt: string
  /** 图像尺寸 */
  size?: string
  /** 随机种子 */
  seed?: number
  /** 引导尺度 */
  guidanceScale?: number
  /** 是否添加水印 */
  watermark?: boolean
  /** API Key */
  apiKey?: string
}

// 统一构造 ApiResponse 格式
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
// 豆包图像编辑
// ===========================================================================

/** 豆包图像编辑 (Body embed) */
export async function doubaoImageEdit(params: DoubaoEditParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/doubao-image-edit/image-edit', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 豆包图像生成 (Body embed) */
export async function doubaoImageGenerate(params: DoubaoGenerateParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/doubao-image-edit/image-generate', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 豆包模型列表 */
export async function doubaoListModels(): Promise<ApiResponse<unknown[]>> {
  const res = await http.get('/api/v1/doubao-image-edit/models')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<unknown[]>
}

export const doubaoImageEditApi = {
  doubaoImageEdit,
  doubaoImageGenerate,
  doubaoListModels,
}

export default doubaoImageEditApi