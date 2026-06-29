/**
 * 管理后台 - OAuth Scope 元数据 API (Round 29-D 新增)
 * 后端约定: /api/v1/agents/oauth-apps/admin/scope-meta (与 oauth_apps.py 对接)
 *
 * 用途: admin 在后台维护 scope 元数据 (名称/描述/分类/排序/启用状态),
 * 取代前端硬编码的 scope 描述表. OAuthAuthorize 授权确认页动态读取展示.
 *
 * 注意:
 * - scope 标识符唯一约束, 创建后不可修改 (避免破坏已签发 token 的 scope 字段语义)
 * - is_active=0 的 scope 在授权页回退到默认描述 (不报错)
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** OAuth Scope 元数据 (admin 视角) */
export interface AdminOAuthScopeMeta {
  id: number
  /** scope 标识符 (唯一, 如 "read:profile") */
  scope: string
  /** scope 中文名 (展示用) */
  name: string
  /** scope 详细描述 (授权页展示) */
  description: string | null
  /** scope 图标 URL (可空) */
  icon: string | null
  /** scope 分类 (可空, 如 "profile" / "orders" / "wallet") */
  category: string | null
  /** 是否启用 (0 禁用, 1 启用) */
  is_active: number
  /** 排序权重 (asc, 默认 0) */
  sort_order: number
  created_at?: string
  updated_at?: string
}

/** 创建参数 */
export interface AdminOAuthScopeMetaCreateParams {
  scope: string
  name: string
  description?: string
  icon?: string
  category?: string
  is_active?: number
  sort_order?: number
}

/** 更新参数 (scope 不可改) */
export interface AdminOAuthScopeMetaUpdateParams {
  name?: string
  description?: string
  icon?: string
  category?: string
  is_active?: number
  sort_order?: number
}

/** 列表查询参数 */
export interface AdminOAuthScopeMetaListParams {
  scope?: string
  category?: string
  is_active?: number
  page?: number
  page_size?: number
}

/** 分页返回 */
export interface AdminOAuthScopeMetaPage {
  list: AdminOAuthScopeMeta[]
  total: number
  page: number
  page_size: number
}

/** 获取 scope 元数据列表 (admin 分页) */
export async function getAdminOAuthScopeMetaList(
  params?: AdminOAuthScopeMetaListParams
): Promise<ApiResponse<AdminOAuthScopeMeta[]>> {
  try {
    const response = await request.get<AdminOAuthScopeMeta[]>(
      '/api/v1/agents/oauth-apps/admin/scope-meta',
      { params }
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '请求失败',
      data: [],
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 创建 scope 元数据 */
export async function createAdminOAuthScopeMeta(
  data: AdminOAuthScopeMetaCreateParams
): Promise<ApiResponse<AdminOAuthScopeMeta>> {
  try {
    const response = await request.post<AdminOAuthScopeMeta>(
      '/api/v1/agents/oauth-apps/admin/scope-meta',
      data
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '创建失败',
      data: {} as AdminOAuthScopeMeta,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 更新 scope 元数据 (scope 标识符不可改) */
export async function updateAdminOAuthScopeMeta(
  metaId: number,
  data: AdminOAuthScopeMetaUpdateParams
): Promise<ApiResponse<AdminOAuthScopeMeta>> {
  try {
    const response = await request.put<AdminOAuthScopeMeta>(
      `/api/v1/agents/oauth-apps/admin/scope-meta/${metaId}`,
      data
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '更新失败',
      data: {} as AdminOAuthScopeMeta,
      success: false,
      timestamp: Date.now(),
    }
  }
}

/** 删除 scope 元数据 */
export async function deleteAdminOAuthScopeMeta(
  metaId: number
): Promise<ApiResponse<{ id: number; message: string }>> {
  try {
    const response = await request.delete<{ id: number; message: string }>(
      `/api/v1/agents/oauth-apps/admin/scope-meta/${metaId}`
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '删除失败',
      data: { id: metaId, message: 'failed' },
      success: false,
      timestamp: Date.now(),
    }
  }
}
