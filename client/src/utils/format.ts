import dayjs from 'dayjs'

export function formatTime(time: string | number | Date | undefined, format = 'YYYY-MM-DD HH:mm:ss'): string {
  if (!time) return ''
  return dayjs(time).format(format)
}

export function formatDateTime(time: string | number | Date | undefined, format = 'YYYY-MM-DD HH:mm:ss'): string {
  return formatTime(time, format)
}
