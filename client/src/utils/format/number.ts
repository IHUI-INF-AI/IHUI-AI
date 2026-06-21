export function formatNumber(num: number): string {
  if (num < 1000) {
    return num.toString()
  }
  if (num < 10000) {
    return (num / 1000).toFixed(1) + 'k'
  }
  return (num / 10000).toFixed(1) + 'w'
}

export function formatPercent(value: number, total: number): string {
  if (total === 0) return '0%'
  return ((value / total) * 100).toFixed(1) + '%'
}

/**
 * 格式化智汇值显示（大于五位数时显示为万单位，不四舍五入）
 */
export function formatTokenValue(value: number | string | null | undefined): string {
  if (!value) return '0'
  const num = parseInt(String(value))
  if (num >= 10000) {
    const divided = num / 10000
    const truncated = Math.floor(divided * 100) / 100
    return truncated + '万'
  }
  return num.toString()
}

/**
 * 金额格式化
 */
export function formatMoney(amount: number | string, decimals: number = 2): string {
  return Number(amount).toFixed(decimals)
}

/**
 * 分转元（后端金额单位统一为分，前端显示为元）
 * 解决项目金额单位混乱问题：所有地方都用这个函数把分转成元显示
 */
export function fenToYuan(fen: number | string | null | undefined, decimals: number = 2): string {
  if (fen === null || fen === undefined || fen === '') return '0.00'
  const num = Number(fen)
  if (isNaN(num)) return '0.00'
  return (num / 100).toFixed(decimals)
}

/**
 * 元转分（前端输入元，提交后端用分）
 */
export function yuanToFen(yuan: number | string): number {
  const num = Number(yuan)
  if (isNaN(num)) return 0
  return Math.round(num * 100)
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return '0B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return (bytes / Math.pow(k, i)).toFixed(2) + sizes[i]
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
