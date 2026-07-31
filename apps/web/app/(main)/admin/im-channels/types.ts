/**
 * IM 渠道管理页本地类型 + 契约层 re-export(2026-07-31 立,P0)。
 *
 * 契约层类型从 @ihui/types 直接 import,禁止在端内重新声明同名类型
 * (AGENTS.md §3 共享层优先)。本文件仅做 re-export + 定义 UI 本地状态类型。
 */
export type {
  ImPlatform,
  ImMessageDirection,
  ImMessageType,
  ImAdapterConfig,
  ImAdapterUpsertInput,
  ImAdapterFieldSchema,
  ImPlatformMeta,
  ImGatewayStatus,
  ImMessageHistoryItem,
} from '@ihui/types'

/** 主 Tab 切换 key */
export type TabKey = 'config' | 'history'

/** 平台连接状态聚合(供 PlatformList 渲染徽章用) */
export interface PlatformStatusView {
  platform: string
  displayName: string
  icon?: string
  /** configured: 已配置(adapter 存在);enabled: 已启用;none: 未配置 */
  state: 'configured' | 'enabled' | 'none'
  connected: boolean
  messageCount: number
  lastMessageAt?: string
  error?: string
}

/** 消息历史筛选表单值 */
export interface MessageHistoryFilter {
  platform: string | 'all'
  direction: 'all' | 'inbound' | 'outbound'
  page: number
}
