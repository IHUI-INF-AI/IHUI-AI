/**
 * 格式化文件大小（1024 进制，保留 1 位小数，单位 B/KB/MB/GB/TB）。
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1)
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

/**
 * 格式化价格（分 → 元，保留 2 位小数）。
 */
export function formatPrice(cents: number): string {
  if (!cents || isNaN(cents)) return '0.00'
  return (Number(cents) / 100).toFixed(2)
}

/**
 * 格式化金额（千分位 + 2 位小数）。
 */
export function formatMoney(amount: number): string {
  return Number(amount || 0)
    .toFixed(2)
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * 手机号脱敏:13812345678 → 138****4567
 */
export function formatPhone(phone: string): string {
  return String(phone || '').replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}
