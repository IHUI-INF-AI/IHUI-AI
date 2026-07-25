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

/**
 * 格式化 token 数为人类可读字符串(如 32K / 128K / 1M / 2M)。
 *
 * 单一来源:@ihui/shared/utils(2026-07-25 立,从 @ihui/api-client 迁入)。
 * api-client 的同名函数保留作为向后兼容 re-export,新代码应优先从 @ihui/shared/utils 导入。
 */
export function formatTokenCount(tokens: number): string {
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`
  }
  if (tokens >= 1_000) {
    const k = tokens / 1_000
    return `${Number.isInteger(k) ? k : k.toFixed(0)}K`
  }
  return String(tokens)
}
