/**
 * 插件市场 API — desktop 端薄封装(2026-07-22 立)
 *
 * 直接 re-export 自 @ihui/api-client,零冗余。
 * desktop 端如有特殊需求(如 IPC 代理)可在本文件扩展。
 */
export {
  getInstalledPlugins,
  installPlugin,
  uninstallPlugin,
  updatePluginPreferences,
} from '@ihui/api-client'
export type {
  PluginInstallState,
  PluginInstalledResponse,
  PluginInstallBody,
  PluginPreferencesBody,
  PluginMutationResponse,
  PluginUninstallResponse,
} from '@ihui/types'
