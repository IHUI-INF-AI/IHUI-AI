/**
 * 通义图像 API (合并 tongyi-image-edit + tongyi-image2image)
 * 对接后端:
 *   - app/api/v1/tongyi_image_edit.py (图像编辑/文生图/模型列表)
 *   - app/api/v1/tongyi_image2image.py (图生图/风格迁移/背景生成/虚拟试穿/模型列表)
 * 路由前缀: /api/v1/tongyi-image-edit + /api/v1/tongyi-image2image
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

/** 通义图像编辑参数 (Body embed) */
export interface TongyiEditParams {
  /** 模型名称 */
  model: string
  /** 图像 URL (与 imageBase64 二选一) */
  imageUrl?: string
  /** 图像 Base64 (与 imageUrl 二选一) */
  imageBase64?: string
  /** 提示词 */
  prompt: string
  /** 反向提示词 */
  negativePrompt?: string
  /** 生成数量 */
  n?: number
  /** API Key */
  apiKey?: string
}

/** 通义文生图参数 (Body embed) */
export interface TongyiTextParams {
  /** 模型名称 */
  model: string
  /** 提示词 */
  prompt: string
  /** 反向提示词 */
  negativePrompt?: string
  /** 图像尺寸 */
  size?: string
  /** 生成数量 */
  n?: number
  /** 风格 */
  style?: string
  /** API Key */
  apiKey?: string
}

/** 通义图生图参数 (Body embed) */
export interface TongyiImage2ImageParams {
  /** 模型名称 */
  model: string
  /** 原图 URL (必填) */
  imageUrl: string
  /** 提示词 */
  prompt: string
  /** 重绘强度 */
  strength?: number
  /** 风格 */
  style?: string
  /** API Key */
  apiKey?: string
}

/** 通义风格迁移参数 (Body embed) */
export interface TongyiStyleTransferParams {
  /** 模型名称 */
  model: string
  /** 原图 URL (必填) */
  imageUrl: string
  /** 风格参考图 URL (必填) */
  styleRefUrl: string
  /** API Key */
  apiKey?: string
}

/** 通义背景生成参数 (Body embed) */
export interface TongyiBackgroundParams {
  /** 模型名称 */
  model: string
  /** 原图 URL (必填) */
  imageUrl: string
  /** 提示词 */
  prompt?: string
  /** API Key */
  apiKey?: string
}

/** 通义虚拟试穿参数 (Body embed) */
export interface TongyiTryOnParams {
  /** 模型名称 */
  model: string
  /** 人物图 URL (必填) */
  personImageUrl: string
  /** 上装图 URL */
  topGarmentUrl?: string
  /** 下装图 URL */
  bottomGarmentUrl?: string
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
// 通义图像编辑 (tongyi-image-edit)
// ===========================================================================

/** 通义图像编辑 (Body embed) */
export async function tongyiImageEdit(params: TongyiEditParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image-edit/image-edit', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义文生图 (Body embed) */
export async function tongyiTextToImage(params: TongyiTextParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image-edit/text-to-image', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义图像编辑模型列表 */
export async function tongyiListEditModels(): Promise<ApiResponse<unknown[]>> {
  const res = await http.get('/api/v1/tongyi-image-edit/models')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<unknown[]>
}
// ===========================================================================
// 通义图生图 (tongyi-image2image)
// ===========================================================================

/** 通义图生图 (Body embed) */
export async function tongyiImageToImage(params: TongyiImage2ImageParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image2image/image-to-image', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义风格迁移 (Body embed) */
export async function tongyiStyleTransfer(params: TongyiStyleTransferParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image2image/style-transfer', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义背景生成 (Body embed) */
export async function tongyiBackgroundGeneration(params: TongyiBackgroundParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image2image/background-generation', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义虚拟试穿 (Body embed) */
export async function tongyiVirtualTryOn(params: TongyiTryOnParams): Promise<ApiResponse<unknown>> {
  const res = await http.post('/api/v1/tongyi-image2image/virtual-try-on', params)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

/** 通义图生图模型列表 */
export async function tongyiListImage2ImageModels(): Promise<ApiResponse<unknown[]>> {
  const res = await http.get('/api/v1/tongyi-image2image/models')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<unknown[]>
}

export const tongyiImageApi = {
  tongyiImageEdit,
  tongyiTextToImage,
  tongyiListEditModels,
  tongyiImageToImage,
  tongyiStyleTransfer,
  tongyiBackgroundGeneration,
  tongyiVirtualTryOn,
  tongyiListImage2ImageModels,
}

export default tongyiImageApi