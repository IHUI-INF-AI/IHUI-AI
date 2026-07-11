/**
 * 日期工具函数（迁移自历史项目 code/edu/web/web/src/util/dateUtils.js）
 */

/**
 * 格式化日期
 * @param date 日期对象或时间戳或日期字符串
 * @param format 格式模板，支持 YYYY MM DD HH mm ss
 * @returns 格式化后的日期字符串
 */
export function dateFormat(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return format
    .replace(/YYYY/g, String(d.getFullYear()))
    .replace(/MM/g, pad(d.getMonth() + 1))
    .replace(/DD/g, pad(d.getDate()))
    .replace(/HH/g, pad(d.getHours()))
    .replace(/mm/g, pad(d.getMinutes()))
    .replace(/ss/g, pad(d.getSeconds()))
}

/**
 * 格式化日期（简写）
 */
export function formatDate(date: Date | number | string): string {
  return dateFormat(date, 'YYYY-MM-DD')
}

/**
 * 友好时间显示（如"3分钟前"、"2小时前"、"昨天"等）
 */
export function friendlyDate(date: Date | number | string): string {
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days === 1) return '昨天'
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

/**
 * 秒转 mm:ss 格式
 */
export function formatMinutes(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/**
 * 秒转分钟小数
 */
export function formatMinute(seconds: number): string {
  return (seconds / 60).toFixed(1)
}
