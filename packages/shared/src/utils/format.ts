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

/**
 * 格式化金额(空值返回 fallback,默认 '—';千分位 + 2 位小数)。
 * 跨端统一:mobile-rn 6 screens + UserInfoCard 共用。
 * IncomeScreen 等需空值返回 '0.00' 的场景,传 fallback = '0.00'。
 */
export function formatAmount(
  n: number | string | undefined | null,
  fallback = '—',
): string {
  const num = typeof n === 'string' ? Number(n) : n
  if (typeof num !== 'number' || isNaN(num)) return fallback
  return num.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * 中文金额格式化(≥10000→'X.XX万',≥100000000→'X.XX亿',其他→向下取整的数字字符串)。
 * 跨端统一:mobile-rn/UserInfoCard + miniapp-taro/time.ts 共用(采用 mobile-rn 版本,支持亿)。
 * 实现依据 mobile-rn/UserInfoCard.tsx 原始逻辑(parseFloat + Math.floor),miniapp-taro 旧版不支亿,统一升级。
 */
export function formatTokenValue(value: number | string | undefined): string {
  if (value === undefined || value === null || value === '') return '0'
  const num = typeof value === 'string' ? parseFloat(value) : value
  if (isNaN(num)) return '0'
  if (num >= 100000000) return `${(num / 100000000).toFixed(2)}亿`
  if (num >= 10000) return `${(num / 10000).toFixed(2)}万`
  return String(Math.floor(num))
}

/**
 * 格式化时长(秒 → HH:MM:SS,跨端统一:mobile-rn/LiveHostScreen + miniapp-taro/live/host 共用)。
 */
export function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':')
}

/**
 * 格式化短时长(秒 → MM:SS,跨端统一:mobile-rn/VoiceInput 录音时长显示)。
 * 与 formatDuration(HH:MM:SS)区别:录音场景不需要小时。
 */
export function formatShortDuration(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

/**
 * 格式化媒体时长(秒 → M:SS 或 H:MM:SS 自适应,跨端统一:mobile-rn/VideoPlayer + 直播回放共用)。
 * 无效值(非有限数/负数)返回 '0:00'。
 */
export function formatMediaTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * 格式化人类可读时长(分钟 → Xh Ym,跨端统一:mobile-rn/StudyRecordScreen 学习记录共用)。
 * 输入 0 或负数返回 '0m';小于 60 分钟返回 'Xm';≥60 分钟返回 'Xh Ym' 或 'Xh'。
 */
export function formatHumanDuration(minutes: number): string {
  if (!minutes || minutes <= 0) return '0m'
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}