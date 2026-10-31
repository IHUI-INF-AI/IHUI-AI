// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 监控告警词表 —— admin 监控子页(alerts / error-dashboard)的**唯一**取值来源。
 *
 * 为什么必须只有一份(2026-10-31,admin 监控崩溃族):
 *   库内 `monitor_alerts` 的真值是 severity ∈ {info,warning,critical}、
 *   status ∈ {firing,suppressed,resolved}(见 packages/database/src/schema/monitor.ts),
 *   而前端曾同时存在三套词表:alerts 页 `active/acknowledged`、
 *   error-dashboard 页 `open/resolved/ignored`、以及"级别"键名 `level`
 *   —— 于是 `LEVEL_STYLE[a.level]` 取到 undefined 就在渲染期抛 TypeError
 *   (库列真名是 severity,第一条告警落地即崩表);`acknowledged` 全仓不存在,
 *   汇总卡恒 0、确认键永不出现。
 *
 * 单一真相源(AGENTS.md §0.6):
 *   - severity 复用 `@ihui/types` 的 `Severity`(info/warning/critical),
 *     与库内 `monitor_alerts.severity` 列同值 —— **不另立一份同值联合类型**;
 *   - status 的三值在本文件定义(库内 `monitor_alerts.status` 列的真值)。
 *     ⚠️ 待并入 packages/types(那一格归 packages/types 持有人,见票面 ③):
 *     本仓 `packages/types/**` 正被别的会话改动,故此处不得新建、只能标注待办。
 *   - 其它任何页面/组件都不得再自带一份 severity/status 映射表。
 *
 * 取不到 / 词表外的值 ⇒ 显式「未判定」,不得兜成 0,也不得崩表。
 */
import type { ComponentType } from 'react'
import { AlertTriangle, Bell, CircleHelp } from 'lucide-react'
import {
  MONITOR_ALERT_SEVERITIES,
  MONITOR_ALERT_STATUSES,
  isMonitorAlertSeverity,
  isMonitorAlertStatus,
  type MonitorAlertSeverity,
  type MonitorAlertStatus,
} from '@ihui/types'

/**
 * 两条封闭词表的 canonical 在 `@ihui/types`(packages/types/src/monitor-vocabulary.ts,
 * 2026-10-31 立)。本文件只做 **re-export + 展示元数据**,不得再写第二份同值数组
 * (第二份必然漂移,AGENTS §0.6;票据 ③ 的机器判据见 scripts/check-monitor-alert-vocabulary.mjs)。
 */
export {
  MONITOR_ALERT_SEVERITIES,
  MONITOR_ALERT_STATUSES,
  isMonitorAlertSeverity,
  isMonitorAlertStatus,
}
export type { MonitorAlertSeverity, MonitorAlertStatus }

/** 未判定占位文案:读数/取值取不到时显式说出来,不许兜成 0 或空串。 */
export const UNDETERMINED_LABEL = '未判定'

interface SeverityStyle {
  label: string
  bg: string
  text: string
  icon: ComponentType<{ className?: string }>
}

/** severity → 展示元数据(唯一一份)。 */
const SEVERITY_STYLE: Record<MonitorAlertSeverity, SeverityStyle> = {
  info: { label: '信息', bg: 'bg-primary/10', text: 'text-primary', icon: Bell },
  warning: {
    label: '警告',
    bg: 'bg-warning/10',
    text: 'text-warning-amber-text',
    icon: AlertTriangle,
  },
  critical: {
    label: '严重',
    bg: 'bg-danger/10',
    text: 'text-danger-text',
    icon: AlertTriangle,
  },
}

/** status → 展示元数据(唯一一份)。 */
const STATUS_STYLE: Record<MonitorAlertStatus, { label: string; bg: string; text: string }> = {
  firing: { label: '触发中', bg: 'bg-danger/10', text: 'text-danger-text' },
  suppressed: { label: '已抑制', bg: 'bg-warning/10', text: 'text-warning-amber-text' },
  resolved: { label: '已恢复', bg: 'bg-success/10', text: 'text-success-deep-text' },
}

/** severity 展示元数据(词表外的值 ⇒ severity=null + 「未判定」)。 */
export interface MonitorAlertSeverityMeta extends SeverityStyle {
  severity: MonitorAlertSeverity | null
}

/** status 展示元数据(词表外的值 ⇒ status=null + 「未判定」)。 */
export interface MonitorAlertStatusMeta {
  status: MonitorAlertStatus | null
  label: string
  bg: string
  text: string
}

/**
 * severity 取值 → 展示元数据。
 * 词表外的值(库列是裸 varchar,无 CHECK)⇒ 显式「未判定」,不崩表也不兜成某个已知档。
 */
export function monitorAlertSeverityMeta(value: unknown): MonitorAlertSeverityMeta {
  if (isMonitorAlertSeverity(value)) {
    return { severity: value, ...SEVERITY_STYLE[value] }
  }
  return {
    severity: null,
    label: UNDETERMINED_LABEL,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    icon: CircleHelp,
  }
}

/** status 取值 → 展示元数据;词表外的值 ⇒ 显式「未判定」。 */
export function monitorAlertStatusMeta(value: unknown): MonitorAlertStatusMeta {
  if (isMonitorAlertStatus(value)) {
    return { status: value, ...STATUS_STYLE[value] }
  }
  return {
    status: null,
    label: UNDETERMINED_LABEL,
    bg: 'bg-muted',
    text: 'text-muted-foreground',
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
