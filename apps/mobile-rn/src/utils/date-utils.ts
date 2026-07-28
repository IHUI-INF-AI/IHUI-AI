/**
 * mobile-rn 端日期格式化兼容层(re-export 自 @ihui/shared/utils)
 * 统一 Asia/Shanghai 时区(AGENTS.md §4),空值返回 ''
 */
export {
  formatDate,
  formatDateByTemplate,
  formatDateOnly,
  formatShortDateTime,
  formatShortDate,
  formatShortDateWithYear,
  formatTimeOnly,
  formatRelativeTime,
} from '@ihui/shared/utils/date-utils'
