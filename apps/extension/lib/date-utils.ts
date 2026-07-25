/**
 * extension 端日期格式化兼容层(re-export 自 @ihui/shared/utils)
 * - fmtDate: 月日时分(MM-DD HH:mm),原模式 A 页面用
 * - fmtDateOnly: 仅月日(MM-DD),原模式 B 页面用
 * - fmtDateWithYear: 年月日(YYYY-MM-DD),原模式 C 页面用
 * 统一 Asia/Shanghai 时区,空值返回 ''
 */
export { formatShortDateTime as fmtDate } from '@ihui/shared/utils/date-utils'
export { formatShortDate as fmtDateOnly } from '@ihui/shared/utils/date-utils'
export { formatShortDateWithYear as fmtDateWithYear } from '@ihui/shared/utils/date-utils'
