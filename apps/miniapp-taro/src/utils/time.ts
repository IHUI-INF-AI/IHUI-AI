export function formatDate(date: Date | number | string, format = 'YYYY-MM-DD HH:mm:ss'): string {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hours = String(d.getHours()).padStart(2, '0')
  const minutes = String(d.getMinutes()).padStart(2, '0')
  const seconds = String(d.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

export function nowDate(): string {
  return formatDate(new Date(), 'YYYY-MM-DD')
}

export function happenTimeFun(timestamp: number): string {
  return formatDate(new Date(timestamp * 1000), 'YYYY-MM-DD')
}

export function formatFullTime(timestamp: number): string {
  return formatDate(new Date(timestamp * 1000), 'YYYY-MM-DD HH:mm:ss')
}

export function getYMD(date: Date): string {
  return formatDate(date, 'YYYY-MM-DD')
}

export function relativeTime(date: Date | number | string): string {
  const d = new Date(date)
  const now = Date.now()
  const diff = now - d.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  if (days < 365) return `${Math.floor(days / 30)}个月前`
  return `${Math.floor(days / 365)}年前`
}

export function formatPrice(cents: number): string {
  if (!cents || isNaN(cents)) return '0.00'
  return (Number(cents) / 100).toFixed(2)
}

export function formatMoney(amount: number, decimals = 2): string {
  return Number(amount || 0).toFixed(decimals)
}

export function formatTokenValue(value: number | string): string {
  if (!value) return '0'
  const num = parseInt(String(value), 10)
  if (num >= 10000) {
    const truncated = Math.floor((num / 10000) * 100) / 100
    return `${truncated}万`
  }
  return num.toString()
}

export function formatPhone(phone: string): string {
  return String(phone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

export function formatFileSize(bytes: number): string {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}
