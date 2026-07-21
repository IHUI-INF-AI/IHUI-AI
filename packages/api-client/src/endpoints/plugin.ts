/**
 * 插件市场 API 客户端封装(跨端共享,2026-07-22 立)
 *
 * 4 个端点:
 *  - GET    /api/plugins/installed          查询当前用户所有插件安装态
 *  - POST   /api/plugins/:id/install        安装/启用插件(可选 pinned)
 *  - DELETE /api/plugins/:id/install        卸载/禁用插件
 *  - PATCH  /api/plugins/:id/preferences    更新偏好(pinned)
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro / cli
 * 都通过 @ihui/api-client 统一导入,各端薄包装层只做 re-export。
 */

import type {
  PluginInstallBody,
  PluginInstallState,
  PluginInstalledResponse,
  PluginMutationResponse,
  PluginPreferencesBody,
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

export type {
  PluginInstallBody,
  PluginInstallState,
  PluginInstalledResponse,
  PluginMutationResponse,
  PluginPreferencesBody,
  PluginUninstallResponse,
}
