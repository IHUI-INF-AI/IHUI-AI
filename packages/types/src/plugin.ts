/**
 * 插件市场跨端共享类型契约 (2026-07-22 立)
 *
 * 设计哲学:
 *  - 后端只管"安装态"(installState),插件目录(catalog)由前端静态数据提供
 *  - 复用 user_preferences 表(group='plugins', key=pluginId, value=JSON),零迁移
 *  - pluginId 一经发布不可变,作为 user_preferences.key 持久化
 *
 * 跨端使用:web / desktop / extension / mobile-rn / miniapp-taro / cli
 * 都通过 @ihui/types 统一导入,避免重复定义。
 */

/**
 * 单个插件的安装状态(持久化在 user_preferences.value 中,JSON 字符串)
 *  - installedAt: ISO8601 安装时间(utc)
 *  - pinned:     是否收藏/置顶(影响排序)
 */
export interface PluginInstallState {
  installedAt: string
  pinned: boolean
}

/**
 * GET /api/plugins/installed 响应体
 *  - states:       当前用户所有已安装插件的状态映射(pluginId → state)
 *  - authenticated: 后端是否确认登录(未登录时 states 为空对象)
 */
export interface PluginInstalledResponse {
  states: Record<string, PluginInstallState>
  authenticated: boolean
}

/** POST /api/plugins/:id/install 请求体(可选,默认 pinned=false) */
export interface PluginInstallBody {
  pinned?: boolean
}

/** PATCH /api/plugins/:id/preferences 请求体(部分更新,只传需要改的字段) */
export interface PluginPreferencesBody {
  pinned?: boolean
}

/** POST /api/plugins/:id/install + PATCH /api/plugins/:id/preferences 响应体 */
export interface PluginMutationResponse {
  pluginId: string
  state: PluginInstallState
}

/** DELETE /api/plugins/:id/install 响应体 */
export interface PluginUninstallResponse {
  pluginId: string
  removed: true
}
