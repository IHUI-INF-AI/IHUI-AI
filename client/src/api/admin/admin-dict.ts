/**
 * 数据字典管理 API
 * 对接后端: app/api/v1/system/dictionary.py
 * 路由前缀: /api/v1/dict
 *
 * 后端列表响应为 RuoYi TableDataInfo 格式 ({code, rows, total, msg}),
 * 本文件统一转换为 {records, total} 以适配 useAdminTable 默认提取器。
 */
import http from '@/utils/request'
import type { ApiResponse } from '@/types'

export interface DictListParams {
  current?: number
  size?: number
  keyword?: string
  dictType?: string
  dictLabel?: string
  status?: string
  [k: string]: unknown
}

export interface DictTypeItem {
  dictId: number
  dictName: string
  dictType: string
  status: string
}

export interface DictDataItem {
  dictCode: number
  dictSort: number
  dictLabel: string
  dictValue: string
  dictType: string
  cssClass?: string | null
  listClass?: string | null
  isDefault: string
  status: string
}

// 统一构造 ApiResponse<{records, total}> 格式
function toListResult(rows: unknown[], total: number, msg = 'success'): ApiResponse<{ records: unknown[]; total: number }> {
  return {
    code: 0,
    message: msg,
    data: { records: rows, total },
    success: true,
    timestamp: Date.now(),
  } as unknown as ApiResponse<{ records: unknown[]; total: number }>
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
// 字典类型
// ===========================================================================

export async function dictTypeList(params: DictListParams = {}): Promise<ApiResponse<{ records: DictTypeItem[]; total: number }>> {
  const res = await http.get('/api/v1/dict/type/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      dict_name: params.keyword || undefined,
      dict_type: params.dictType || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.rows || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: DictTypeItem[]; total: number }>
}

export async function dictTypeDetail(dictId: number): Promise<ApiResponse<DictTypeItem | null>> {
  const res = await http.get(`/api/v1/dict/type/${dictId}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictTypeItem | null>
}

export async function dictTypeCreate(payload: { dictName: string; dictType: string; status?: string }): Promise<ApiResponse<DictTypeItem>> {
  const res = await http.post('/api/v1/dict/type', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictTypeItem>
}

export async function dictTypeUpdate(payload: { dictId: number; dictName?: string; dictType?: string; status?: string }): Promise<ApiResponse<DictTypeItem>> {
  const res = await http.put('/api/v1/dict/type', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictTypeItem>
}

export async function dictTypeDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/dict/type/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export async function dictTypeOptionselect(): Promise<ApiResponse<DictTypeItem[]>> {
  const res = await http.get('/api/v1/dict/type/optionselect')
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictTypeItem[]>
}

// ===========================================================================
// 字典数据
// ===========================================================================

export async function dictDataList(params: DictListParams = {}): Promise<ApiResponse<{ records: DictDataItem[]; total: number }>> {
  const res = await http.get('/api/v1/dict/data/list', {
    params: {
      page: params.current ?? 1,
      size: params.size ?? 20,
      dict_type: params.dictType || undefined,
      dict_label: params.dictLabel || params.keyword || undefined,
      status: params.status || undefined,
    },
  })
  const body = (res as any).data || {}
  return toListResult(body.rows || [], body.total || 0, body.msg) as unknown as ApiResponse<{ records: DictDataItem[]; total: number }>
}

export async function dictDataByType(dictType: string): Promise<ApiResponse<DictDataItem[]>> {
  const res = await http.get(`/api/v1/dict/data/type/${dictType}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictDataItem[]>
}

export async function dictDataDetail(dictCode: number): Promise<ApiResponse<DictDataItem | null>> {
  const res = await http.get(`/api/v1/dict/data/${dictCode}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictDataItem | null>
}

export async function dictDataCreate(payload: {
  dictType: string
  dictLabel: string
  dictValue: string
  dictSort?: number
  status?: string
  isDefault?: string
  cssClass?: string | null
  listClass?: string | null
}): Promise<ApiResponse<DictDataItem>> {
  const res = await http.post('/api/v1/dict/data', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictDataItem>
}

export async function dictDataUpdate(payload: {
  dictCode: number
  dictType?: string
  dictLabel?: string
  dictValue?: string
  dictSort?: number
  status?: string
  isDefault?: string
  cssClass?: string | null
  listClass?: string | null
}): Promise<ApiResponse<DictDataItem>> {
  const res = await http.put('/api/v1/dict/data', payload)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg) as unknown as ApiResponse<DictDataItem>
}

export async function dictDataDelete(ids: (string | number)[]): Promise<ApiResponse<unknown>> {
  const res = await http.delete(`/api/v1/dict/data/${ids.join(',')}`)
  const body = (res as any).data || {}
  return toDataResult(body.data, body.msg)
}

export const dictApi = {
  dictTypeList,
  dictTypeDetail,
  dictTypeCreate,
  dictTypeUpdate,
  dictTypeDelete,
  dictTypeOptionselect,
  dictDataList,
  dictDataByType,
  dictDataDetail,
  dictDataCreate,
  dictDataUpdate,
  dictDataDelete,
}

export default dictApi
