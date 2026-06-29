/**
 * 登录时长管理
 * 提供登录时长相关的配置和工具
 */

/**
 * 登录时长选项
 */
export interface LoginDuration {
  label: string
  value: number // 毫秒
  days: number
}

/**
 * 登录时长选项列表
 */
export const LOGIN_DURATION_OPTIONS: LoginDuration[] = [
  { label: '1天', value: 1 * 24 * 60 * 60 * 1000, days: 1 },
  { label: '7天', value: 7 * 24 * 60 * 60 * 1000, days: 7 },
  { label: '30天', value: 30 * 24 * 60 * 60 * 1000, days: 30 },
  { label: '90天', value: 90 * 24 * 60 * 60 * 1000, days: 90 },
]

/**
 * 默认登录时长（7天）
 */
export const DEFAULT_LOGIN_DURATION = 7 * 24 * 60 * 60 * 1000

/**
 * 获取默认登录时长
 */
export function getDefaultLoginDuration(): number {
  return DEFAULT_LOGIN_DURATION
}

/**
 * 获取登录时长标签
 */
export function getLoginDurationLabel(days: number): string {
  const option = LOGIN_DURATION_OPTIONS.find(opt => opt.days === days)
  return option?.label || `${days}天`
}

/**
 * 初始化登录时长
 */
export function initLoginDuration(): void {
  const saved = localStorage.getItem('login_duration')
  if (!saved) {
    localStorage.setItem('login_duration', String(DEFAULT_LOGIN_DURATION))
  }
}

/**
 * 检查登录是否过期
 */
export function isLoginExpired(loginTime?: number, duration?: number): boolean {
  if (!loginTime) return true
  const expiry = duration || DEFAULT_LOGIN_DURATION
  return Date.now() - loginTime > expiry
}

/**
 * 检查过期时间戳是否已过
 * @param expiryTime 过期时间戳（毫秒）
 * @returns true 表示已过期
 */
export function isExpiryTimePassed(expiryTime: number): boolean {
  return Date.now() > expiryTime
}

/**
 * 计算过期时间
 */
export function calculateExpiryTime(duration: number): number {
  return Date.now() + duration
}
