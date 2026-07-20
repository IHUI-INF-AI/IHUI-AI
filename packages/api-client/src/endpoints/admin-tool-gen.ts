/**
 * B 端 admin 工具代码生成器 API client。
 * 对接后端 admin/tool/gen(GET 元信息 + POST 生成代码)。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '../client.js'

export type GenType = 'list' | 'page' | 'detail' | 'dialog'

export interface GenField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'date'
  label?: string
  required?: boolean
}

export interface GenInput {
  type: GenType
  name: string
  fields: GenField[]
  options?: {
    withSearch?: boolean
    withPagination?: boolean
    withActions?: boolean
  }
}

export interface GenResult {
  type: GenType
  moduleName: string
  files: Array<{ path: string; content: string }>
  combined: string
}

export interface GenTypeMeta {
  type: GenType
  label: string
  description: string
  fieldTypes: GenField['type'][]
  defaultFields: GenField[]
}

export interface GenMetaResponse {
  types: GenTypeMeta[]
  typeNames: GenType[]
}

export async function getToolGenMeta(): Promise<ApiResult<GenMetaResponse>> {
  return fetchApi<GenMetaResponse>('/api/admin/tool/gen')
}

export async function postToolGen(input: GenInput): Promise<ApiResult<GenResult>> {
  return fetchApi<GenResult>('/api/admin/tool/gen', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}
