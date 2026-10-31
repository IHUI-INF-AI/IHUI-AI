// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { ComponentType } from 'react'
import { AlertTriangle, Bell } from 'lucide-react'
// 合法值词表唯一真相源 = @ihui/types 的 monitor-vocabulary(本页不得再写一份列表)。
import {
  isMonitorAlertSeverity,
  isMonitorAlertStatus,
  type MonitorAlertSeverity,
  type MonitorAlertStatus,
} from '@ihui/types'

export const selectClass =
  'h-8 w-auto rounded-md border border-input bg-transparent px-2 py-1 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

export interface SeverityStyleEntry {
  bg: string
  text: string
  icon: ComponentType<{ className?: string }>
  label: string
}

export const SEVERITY_STYLE: Record<MonitorAlertSeverity, SeverityStyleEntry> = {
  critical: { bg: 'bg-danger/10', text: 'text-danger-text', icon: AlertTriangle, label: '严重' },
  warning: {
    bg: 'bg-warning/10',
    text: 'text-warning-amber-text',
    icon: AlertTriangle,
    label: '警告',
  },
  info: { bg: 'bg-primary/10', text: 'text-primary', icon: Bell, label: '信息' },
}

/**
 * 严重度取用唯一出口:未知值落 info 档兜底,绝不返回 undefined
(旧 `LEVEL_STYLE[a.level]` 取到 undefined 再 `.icon` 抛 TypeError 崩整表,本函数即其根治)。
 */
export function severityStyle(value: unknown): SeverityStyleEntry {
  return isMonitorAlertSeverity(value) ? SEVERITY_STYLE[value] : SEVERITY_STYLE.info
}

export const STATUS_LABEL: Record<MonitorAlertStatus, string> = {
  firing: '触发中',
  suppressed: '已抑制',
  resolved: '已解决',
}

export const STATUS_STYLE: Record<MonitorAlertStatus, string> = {
  firing: 'bg-danger/10 text-danger-text',
  suppressed: 'bg-warning/10 text-warning-amber-text',
  resolved: 'bg-success/10 text-success-deep-text',
}

/** 未知状态的样式:中性灰档,不冒充任何已知状态(词表头注明令"未知≠firing")。 */
const STATUS_FALLBACK_STYLE = 'bg-muted text-muted-foreground'

/** 状态样式取用唯一出口:未知值走中性兜底,绝不返回 undefined。 */
export function statusStyle(value: unknown): string {
  return isMonitorAlertStatus(value) ? STATUS_STYLE[value] : STATUS_FALLBACK_STYLE
}

/** 状态文案取用唯一出口:已知档给中文标签;未知值原样显示,空/非字符串显示"未知状态",绝不返回 undefined。 */
export function statusLabel(value: unknown): string {
  if (isMonitorAlertStatus(value)) return STATUS_LABEL[value]
  const raw = typeof value === 'string' ? value.trim() : ''
  return raw === '' ? '未知状态' : raw
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
