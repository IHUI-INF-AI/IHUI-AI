import { t } from '@/utils/i18n'

export function formatDateTime(time?: string | Date): string {
  if (!time) return '从未'
  const date = typeof time === 'string' ? new Date(time) : time
  if (isNaN(date.getTime())) return t('text.format.无效时间')
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatDate(time?: string | Date): string {
  if (!time) return '从未'
  const date = typeof time === 'string' ? new Date(time) : time
  if (isNaN(date.getTime())) return t('text.format.无效时间1')
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

export function formatTime(time?: string | Date): string {
  if (!time) return '从未'
  const date = typeof time === 'string' ? new Date(time) : time
  if (isNaN(date.getTime())) return t('text.format.无效时间2')
  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatRelativeTime(time?: string | Date): string {
  if (!time) return '从未'
  const date = typeof time === 'string' ? new Date(time) : time
  if (isNaN(date.getTime())) return t('text.format.无效时间3')

  const now = new Date()
  const diff = now.getTime() - date.getTime()
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

export function formatNumber(num: number): string {
  if (num >= 100000000) {
    return `${(num / 100000000).toFixed(2)}亿`
  }
  if (num >= 10000) {
    return `${(num / 10000).toFixed(2)}万`
  }
  return num.toLocaleString()
}

export function formatPrice(price: number, currency: string = '¥'): string {
  return `${currency}${price.toFixed(2)}`
}

export function formatPercent(value: number, decimals: number = 2): string {
  return `${(value * 100).toFixed(decimals)}%`
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
  if (minutes > 0) {
    return `${minutes}:${String(secs).padStart(2, '0')}`
  }
  return `${secs}秒`
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return `${cleaned.substring(0, 3)} ${cleaned.substring(3, 7)} ${cleaned.substring(7)}`
  }
  return phone
}

export function formatIdCard(idCard: string): string {
  if (idCard.length >= 6) {
    return `${idCard.substring(0, 3)}********${idCard.substring(idCard.length - 4)}`
  }
  return idCard
}

export function formatBankCard(cardNumber: string): string {
  const cleaned = cardNumber.replace(/\D/g, '')
  const groups = cleaned.match(/.{1,4}/g)
  return groups ? groups.join(' ') : cardNumber
}

export function truncateText(text: string, maxLength: number, suffix: string = '...'): string {
  if (text.length <= maxLength) return text
  return text.substring(0, maxLength) + suffix
}

export function highlightKeyword(
  text: string,
  keyword: string,
  className: string = 'highlight'
): string {
  if (!keyword) return text
  const regex = new RegExp(`(${keyword})`, 'gi')
  return text.replace(regex, `<span class="${className}">$1</span>`)
}
