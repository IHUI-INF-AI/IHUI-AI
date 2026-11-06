// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * AI 会话历史共享屏的 props 单一源 —— 自 packages/app/src/features/chat/ConversationHistoryScreen 上移(2026-11-06)。
 *
 * 本屏零平台 API:路由跳转、分享、存储、返回、toast、鉴权全部由 wrapper 通过 props 注入;
 * 契约只描述「拿到的行怎么画」。排序出口(orderHistoryRows/itemTimestamp)属运行期逻辑,
 * 落在 @ihui/shared/chat/conversation-org,本文件只放数据形状。
 */

import type { TFunction } from './app-shared.js'

/** 排序/分桶只需这两列;页面与 RN wrapper 都按此形状喂行。 */
export interface ConversationHistoryOrderable {
  timestamp?: number
  time?: string
  pinned?: boolean
}

/** 一行会话的展示数据(wrapper 已把时间/条数/图标换成展示值)。 */
export interface ConversationHistoryRow {
  id: string
  title: string
  preview?: string
  timeLabel: string
  /** 原始条数;文案由本屏按 `ai.historyPage.msgCount` 取词(单一取词点) */
  messageCount: number
  /** 可选:无远程图标的端(如 RN)留空,本屏回落占位块 */
  iconSrc?: string
  pinned: boolean
}

export interface ConversationHistoryGroup {
  key: string
  /** wrapper 已按共享日历制取好词的分组标题 */
  label: string
  items: readonly ConversationHistoryRow[]
}

export interface ConversationHistoryFilter {
  key: string
  label: string
  iconSrc?: string
}

export interface ConversationHistoryScreenProps {
  t: TFunction
  tt: (key: string, fallback: string) => string
  groups: readonly ConversationHistoryGroup[]
  /** 当前已加载行数(决定空态/清空入口,不受分页切片影响) */
  itemCount: number
  loading: boolean
  isFiltered: boolean
  keyword: string
  onKeywordChange: (value: string) => void
  filters: readonly ConversationHistoryFilter[]
  activeFilter: string
  onFilterChange: (key: string) => void
  showClearAll: boolean
  onClearAll: () => void
  onImport: () => void
  degraded: boolean
  onRetry: () => void
  canPin: boolean
  onOpen: (row: ConversationHistoryRow) => void
  onTogglePin: (row: ConversationHistoryRow) => void
  /** 不传 ⇒ 行上没有长按删除(阴性对照:行为由 props 驱动) */
  onLongPress?: (row: ConversationHistoryRow) => void
  /** 空态顶部图(wrapper 按 isFiltered 传 ICONS.search / ICONS.message);不传则只用字符图标 */
  emptyIconSrc?: string
  hasMore: boolean
  loadingMore: boolean
  onLoadMore: () => void
  refreshing: boolean
  onRefresh: () => void
  onStartNew: () => void
  colorScheme?: 'light' | 'dark'
}
