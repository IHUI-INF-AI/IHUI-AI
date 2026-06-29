/**
 * 用户视角 - OAuth Scope 元数据公开查询 API (Round 29-D 新增)
 * 后端约定: /api/v1/agents/oauth-apps/scope-meta (与 oauth_apps.py 对接)
 *
 * 用途: OAuthAuthorize 授权确认页动态读取 scope 元数据 (名称/描述/图标),
 * 取代前端硬编码的 scope 描述表. admin 后台维护后, 授权页自动同步.
 *
 * 与 admin-oauth-scope-meta.ts 区别:
 * - admin: 增删改查 (require_login + admin)
 * - 公开 (本文件): 仅查询 is_active=1 的 scope (无认证, 授权页用)
 *
 * 回退策略: 授权页若拉取失败或 scope 未配置, 回退到内置默认描述 (向后兼容).
 */
import request from '@/utils/request'
import type { ApiResponse } from '@/types'
import { normalizeApiResponse } from '@/utils/api-response'

/** 公开 scope 元数据 (仅 is_active=1) */
export interface PublicOAuthScopeMeta {
  id: number
  scope: string
  name: string
  description: string | null
  icon: string | null
  category: string | null
  sort_order: number
}

/**
 * 获取已启用的 scope 元数据列表 (公开, 授权页用).
 * 后端: GET /api/v1/agents/oauth-apps/scope-meta (无 require_login)
 *
 * 返回所有 is_active=1 的 scope, 按 sort_order asc 排序.
 */
export async function getPublicOAuthScopeMetaList(): Promise<
  ApiResponse<PublicOAuthScopeMeta[]>
> {
  try {
    const response = await request.get<PublicOAuthScopeMeta[]>(
      '/api/v1/agents/oauth-apps/scope-meta'
    )
    return normalizeApiResponse(response)
  } catch (e) {
    return {
      code: 500,
      message: (e as Error)?.message || '获取 scope 元数据失败',
      data: [],
      success: false,
      timestamp: Date.now(),
    }
  }
}

/**
 * 内置默认 scope 描述 (回退用, 与后端 027 迁移 seed 数据对齐).
 * 当后端公开 endpoint 拉取失败 / scope 未配置时, 授权页用此表展示.
 */
export const DEFAULT_SCOPE_DESCRIPTIONS: Record<string, string> = {
  'read:profile': '读取您的资料 (昵称/头像/简介)',
  'write:profile': '修改您的资料',
  'read:orders': '查看您的订单列表',
  'write:orders': '创建/修改您的订单',
  'read:wallet': '查看您的钱包余额',
  'write:wallet': '操作您的钱包 (充值/消费)',
}
