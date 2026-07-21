/**
 * 插件市场 API 客户端封装(跨端共享,2026-07-22 立,2026-07-22 增 click + admin stats)
 *
 * 5 个用户端点 + 3 个 admin 端点:
 *  - GET    /api/plugins/installed          查询当前用户所有插件安装态
 *  - POST   /api/plugins/:id/install        安装/启用插件(可选 pinned)
 *  - DELETE /api/plugins/:id/install        卸载/禁用插件
 *  - PATCH  /api/plugins/:id/preferences    更新偏好(pinned)
 *  - POST   /api/plugins/:id/click          埋点:点击市场卡片外链(游客可触发)
 *  - GET    /api/admin/plugins/stats/summary  管理端:总览
 *  - GET    /api/admin/plugins/stats/top      管理端:热度榜 Top N
 *  - GET    /api/admin/plugins/stats/trend    管理端:按天趋势
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro / cli
 * 都通过 @ihui/api-client 统一导入,各端薄包装层只做 re-export。
 */

import type {
  PluginClickResponse,
  PluginInstallBody,
  PluginInstallState,
  PluginInstalledResponse,
  PluginMutationResponse,
  PluginPreferencesBody,
  PluginStatsQuery,
  PluginStatsRow,
  PluginStatsSummary,
  PluginTrendRow,
  PluginUninstallResponse,
} from '@ihui/types'

import { fetchApi } from '../client.js'

/** 查询当前登录用户所有已安装插件的安装态(未登录返回 authenticated=false + 空 states) */
export function getInstalledPlugins(): Promise<PluginInstalledResponse> {
  // 后端返回 ApiResponse<PluginInstalledResponse> = { code, message, data }
  // fetchApi 会自动解包为 ApiResult<PluginInstalledResponse>,此处再解包 data
  return fetchApi<PluginInstalledResponse>('/plugins/installed').then((res) => {
    if (!res.success) {
      // 未登录或网络异常:返回未认证态,前端隐藏操作按钮
      return { states: {}, authenticated: false }
    }
    return res.data
  })
}

/** 安装/启用插件(若已安装则更新 pinned 字段) */
export async function installPlugin(
  pluginId: string,
  body?: PluginInstallBody,
): Promise<PluginMutationResponse> {
  const res = await fetchApi<PluginMutationResponse>(`/plugins/${encodeURIComponent(pluginId)}/install`, {
    method: 'POST',
    body: JSON.stringify(body ?? {}),
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 卸载/禁用插件 */
export async function uninstallPlugin(pluginId: string): Promise<PluginUninstallResponse> {
  const res = await fetchApi<PluginUninstallResponse>(
    `/plugins/${encodeURIComponent(pluginId)}/install`,
    { method: 'DELETE' },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 更新插件偏好(目前仅支持 pinned 字段) */
export async function updatePluginPreferences(
  pluginId: string,
  body: PluginPreferencesBody,
): Promise<PluginMutationResponse> {
  const res = await fetchApi<PluginMutationResponse>(
    `/plugins/${encodeURIComponent(pluginId)}/preferences`,
    { method: 'PATCH', body: JSON.stringify(body) },
  )
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 埋点:用户点击市场卡片外链(游客也可触发,后端会尝试识别登录用户) */
export async function recordPluginClick(pluginId: string): Promise<PluginClickResponse> {
  const res = await fetchApi<PluginClickResponse>(`/plugins/${encodeURIComponent(pluginId)}/click`, {
    method: 'POST',
  })
  if (!res.success) throw new Error(res.error)
  return res.data
}

// ============================================================================
// 管理端统计(全部 requireAdmin)
// ============================================================================

/** 管理端:总览指标(总安装/总点击/今日/活跃) */
export async function getPluginStatsSummary(
  query?: PluginStatsQuery,
): Promise<PluginStatsSummary> {
  const qs = query?.days ? `?days=${query.days}` : ''
  const res = await fetchApi<PluginStatsSummary>(`/admin/plugins/stats/summary${qs}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 管理端:热度榜 Top N(按 heat 排序) */
export async function getPluginStatsTop(
  query?: PluginStatsQuery,
): Promise<PluginStatsRow[]> {
  const params = new URLSearchParams()
  if (query?.days) params.set('days', String(query.days))
  if (query?.limit) params.set('limit', String(query.limit))
  const qs = params.toString() ? `?${params.toString()}` : ''
  const res = await fetchApi<PluginStatsRow[]>(`/admin/plugins/stats/top${qs}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

/** 管理端:按天趋势(installs/clicks/uninstalls) */
export async function getPluginStatsTrend(
  query?: PluginStatsQuery,
): Promise<PluginTrendRow[]> {
  const qs = query?.days ? `?days=${query.days}` : ''
  const res = await fetchApi<PluginTrendRow[]>(`/admin/plugins/stats/trend${qs}`)
  if (!res.success) throw new Error(res.error)
  return res.data
}

export type {
  PluginClickResponse,
  PluginInstallBody,
  PluginInstallState,
  PluginInstalledResponse,
  PluginMutationResponse,
  PluginPreferencesBody,
  PluginStatsQuery,
  PluginStatsRow,
  PluginStatsSummary,
  PluginTrendRow,
  PluginUninstallResponse,
}
