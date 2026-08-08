// 私信时间格式化（zh-CN，含时分）

export const letterTimeFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

/** 将后端时间戳格式化为 "08/07 14:30" 风格；非法值返回空字符串 */
export function formatLetterTime(value: string | null | undefined): string {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return letterTimeFormatter.format(d)
}
