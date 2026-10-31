// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 监控告警的两条封闭词表 —— **唯一份**(2026-10-31 立)。
 *
 * 立因(现读取证):`monitor_alerts.status` 与 `.severity` 在库里都是裸 `varchar(20)`,
 * 既无 CHECK 也无 TS 枚举,而消费侧全靠 `Record<键>` 取值 ⇒ 前端各页自己抄了一套词表:
 *   · `admin/monitor/alerts/helpers.ts` 用 `active / acknowledged / resolved`
 *     —— 其中 `acknowledged` **全仓不存在**(后端 ack 写的是 `suppressed`);
 *   · `admin/error-dashboard/page.tsx` 又用 `open / resolved / ignored`;
 *   · 库侧与后端一律 `firing / suppressed / resolved`(`schema/monitor.ts` 的默认值与
 *     `admin-extended/monitor-routes.ts` 的 ack/resolve 写入)。
 * 三套词表并存的直接后果:汇总卡恒 0、确认按钮永不出现、状态列空白,
 * 以及 `LEVEL_STYLE[a.level]` 取到 undefined 后 `.icon` 抛 TypeError 崩表。
 *
 * 形态照守门 200 的 `PROVIDER_HEALTH_STATUSES` 先例:canonical `as const` 一处声明,
 * 类型与派生表都从它走,门扫同值副本(第二份必然漂移,§0.6)。
 * 文案**不进这里** —— 标签归各端 i18n,这里只管"合法值有哪些"。
 */

/** 告警状态封闭词表(与 `monitor_alerts.status` 的写入侧逐字一致)。 */
export const MONITOR_ALERT_STATUSES = ['firing', 'suppressed', 'resolved'] as const
export type MonitorAlertStatus = (typeof MONITOR_ALERT_STATUSES)[number]

/** 告警严重度封闭词表(与 `monitor_alerts.severity` 的写入侧逐字一致)。 */
export const MONITOR_ALERT_SEVERITIES = ['info', 'warning', 'critical'] as const
export type MonitorAlertSeverity = (typeof MONITOR_ALERT_SEVERITIES)[number]

/**
 * 判定是否合法状态。**未知值不抛错、不折成某个具体档** —— 返回 false 由调用方决定
 * 兜底形态(读侧兜底成"原样显示",写侧兜底成 400),避免出现"未知即 firing"的假数据。
 */
export function isMonitorAlertStatus(value: unknown): value is MonitorAlertStatus {
  return typeof value === 'string' && (MONITOR_ALERT_STATUSES as readonly string[]).includes(value)
}

/** 同上,严重度档。 */
export function isMonitorAlertSeverity(value: unknown): value is MonitorAlertSeverity {
  return (
    typeof value === 'string' && (MONITOR_ALERT_SEVERITIES as readonly string[]).includes(value)
  )
}

/** 库侧默认值(与 `schema/monitor.ts` 的 `$default` 同源,由该文件 import 本常量,不另写一份)。 */
export const MONITOR_ALERT_STATUS_DEFAULT: MonitorAlertStatus = 'firing'
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
