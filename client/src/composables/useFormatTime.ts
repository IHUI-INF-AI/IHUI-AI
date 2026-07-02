/**
 * useFormatTime — 统一时间格式化 Composable
 *
 * 设计目的：
 * 项目中 formatTime/formatDateTime 散落在 119+ 个文件中，存在大量重复的
 * `new Date(xxx).getFullYear()` 式手写格式化逻辑，维护困难且 i18n 处理不一致。
 * 本 composable 作为新代码的统一对外 API，逐步收敛散落的格式化调用。
 *
 * 使用方式：
 * ```ts
 * const { formatTime, formatDateTime, formatRelative } = useFormatTime()
 * const s = formatTime(Date.now())            // 2026-06-30 17:00:00
 * const s2 = formatDateTime(Date.now())       // 2026/06/30 17:00 (带 i18n)
 * ```
 *
 * 迁移策略：
 * - 新代码：强制使用本 composable 或直接从 @/utils/format/date 导入
 * - 旧代码：逐步迁移，不要求一次性重构（ESLint 规则 prefer-format-time 为 warn 级）
 */

import { formatDateTime, formatTime } from '@/utils/format/date'

/**
 * 相对时间格式化（"刚刚" / "x 分钟前" / "x 小时前" / 超过 1 天回退到绝对时间）
 * @param input 时间戳/日期字符串/Date 对象
 * @returns 格式化后的相对时间字符串
 */
function formatRelative(input?: string | number | Date | null): string {
  if (!input) return ''

  const d = new Date(input)
  if (isNaN(d.getTime())) return ''

  const now = Date.now()
  const diff = now - d.getTime()
  const ONE_MIN = 60 * 1000
  const ONE_HOUR = 60 * ONE_MIN
  const ONE_DAY = 24 * ONE_HOUR

  if (diff < 0) {
    // 未来时间，回退到绝对格式
    return formatTime(input)
  }
  if (diff < ONE_MIN) return '刚刚'
  if (diff < ONE_HOUR) return `${Math.floor(diff / ONE_MIN)} 分钟前`
  if (diff < ONE_DAY) return `${Math.floor(diff / ONE_HOUR)} 小时前`
  // 超过 1 天，回退到日期格式
  return formatTime(input, 'YYYY-MM-DD')
}

/**
 * 时间格式化统一 composable
 *
 * 返回一组纯函数，封装项目内通用的时间格式化逻辑。
 * 推荐新代码通过本 composable 获取格式化函数，而非直接 `new Date()` 手写。
 */
export function useFormatTime() {
  return {
    /** 绝对时间：默认 YYYY-MM-DD HH:mm:ss，可自定义 format */
    formatTime,
    /** 绝对时间（带 i18n 的"永不"/"无效时间"兜底），输出 YYYY/MM/DD HH:mm */
    formatDateTime,
    /** 相对时间：刚刚 / x 分钟前 / x 小时前 / 超过 1 天回退日期 */
    formatRelative,
  }
}

export { formatTime, formatDateTime, formatRelative }
