/**
 * 安全工具集（合并版）
 *
 * 合并自旧架构 utils/ 下的 9 个安全相关文件：
 * - security / rbac / sessionManager / twoFactorService / ipWhitelistService
 * - passwordStrength / securityScoreService / securityLogService
 * - securityNotificationService
 *
 * 新架构基于纯 TypeScript，无 Vue 依赖，兼容 SSR。
 */
import type { ApiResult } from '@ihui/types'

import { fetchApi } from '@/lib/api'

/* ------------------------------------------------------------------ */
/* 基础安全工具（security）                                            */
/* ------------------------------------------------------------------ */

/** HTML 转义，防 XSS */
export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** 反转义 HTML */
export function unescapeHtml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

/** 简单 sanitize：去掉 <script> 与 on* 事件 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
}

/** 判断是否为合法的 URL（防 javascript: scheme） */
export function isSafeUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('#') || url.startsWith('/')) return true
  try {
    const u = new URL(
      url,
      typeof window !== 'undefined' ? window.location.href : 'http://localhost',
    )
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(u.protocol)
  } catch {
    return false
  }
}

/** CSRF token 读取（从 meta 标签或 cookie） */
export function getCsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  const meta = document.querySelector('meta[name="csrf-token"]')
  if (meta?.getAttribute('content')) return meta.getAttribute('content')
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match && match[1] ? decodeURIComponent(match[1]) : null
}

/* ------------------------------------------------------------------ */
/* RBAC（rbac）                                                        */
/* ------------------------------------------------------------------ */

export interface Permission {
  code: string
  name: string
  description?: string
}

export interface Role {
  id: string
  code: string
  name: string
  permissions: Permission[]
}

const userRoles = new Set<string>()
const userPermissions = new Set<string>()

export function setUserRoles(roles: string[]): void {
  userRoles.clear()
  for (const r of roles) userRoles.add(r)
}

export function setUserPermissions(perms: string[]): void {
  userPermissions.clear()
  for (const p of perms) userPermissions.add(p)
}

export function hasPermission(code: string): boolean {
  if (userRoles.has('admin') || userRoles.has('administrator')) return true
  return userPermissions.has(code) || userPermissions.has('*')
}

export function hasAnyPermission(codes: string[]): boolean {
  return codes.some(hasPermission)
}

export function hasAllPermissions(codes: string[]): boolean {
  return codes.every(hasPermission)
}

export function hasRole(role: string): boolean {
  return userRoles.has(role)
}

/* ------------------------------------------------------------------ */
/* 会话管理（sessionManager）                                          */
/* ------------------------------------------------------------------ */

const SESSION_KEY = 'ihui:session'
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 分钟无操作超时

interface SessionInfo {
  sessionId: string
  userId: string
  loginAt: number
  lastActiveAt: number
  expiresAt: number
  ip: string | null
  userAgent: string | null
}

export function createSession(userId: string): SessionInfo {
  const now = Date.now()
  const session: SessionInfo = {
    sessionId: `sess_${now}_${Math.random().toString(36).slice(2, 10)}`,
    userId,
    loginAt: now,
    lastActiveAt: now,
    expiresAt: now + SESSION_TIMEOUT,
    ip: null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
  }
  saveSession(session)
  return session
}

export function getSession(): SessionInfo | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as SessionInfo
    if (Date.now() > session.expiresAt) {
      destroySession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function touchSession(): SessionInfo | null {
  const session = getSession()
  if (!session) return null
  session.lastActiveAt = Date.now()
  session.expiresAt = Date.now() + SESSION_TIMEOUT
  saveSession(session)
  return session
}

export function destroySession(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SESSION_KEY)
  } catch {
    // 忽略
  }
}

function saveSession(session: SessionInfo): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // 忽略
  }
}

/* ------------------------------------------------------------------ */
/* 双因素认证（twoFactorService）                                      */
/* ------------------------------------------------------------------ */

/** 生成 base32 密钥（用于 TOTP） */
export function generateBase32Secret(length = 20): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let secret = ''
  const bytes = new Uint8Array(length)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes)
  } else {
    for (let i = 0; i < length; i++) {
      bytes[i] = Math.floor(Math.random() * 256)
    }
  }
  for (let i = 0; i < length; i++) {
    const byte = bytes[i] ?? 0
    const ch = chars[byte % 32]
    if (ch) secret += ch
  }
  return secret
}

/** 生成 otpauth URL */
export function buildOtpauthUrl(account: string, secret: string, issuer = 'IHUI-AI'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

/** 生成一次性备份码 */
export function generateBackupCodes(count = 10): string[] {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    const n = Math.floor(Math.random() * 1_000_000_000_000)
    codes.push(
      n
        .toString()
        .padStart(12, '0')
        .replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3'),
    )
  }
  return codes
}

/* ------------------------------------------------------------------ */
/* IP 白名单（ipWhitelistService）                                     */
/* ------------------------------------------------------------------ */

const whitelist = new Set<string>()

export function addIpToWhitelist(ip: string): void {
  whitelist.add(ip)
}

export function removeIpFromWhitelist(ip: string): boolean {
  return whitelist.delete(ip)
}

export function isIpWhitelisted(ip: string): boolean {
  if (whitelist.size === 0) return true // 未配置白名单时放行
  return whitelist.has(ip)
}

export function getWhitelist(): string[] {
  return Array.from(whitelist)
}

/** 简单 IP 校验 */
export function isValidIp(ip: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(ip) || /^[0-9a-fA-F:]+$/.test(ip)
}

/** 判断 IP 是否在 CIDR 范围内（IPv4 简化实现） */
export function isIpInCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/')
  if (!range || !bitsStr) return false
  const bits = parseInt(bitsStr, 10)
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false
  const ipNum = ipToInt(ip)
  const rangeNum = ipToInt(range)
  if (ipNum === null || rangeNum === null) return false
  const mask = bits === 0 ? 0 : ~((1 << (32 - bits)) - 1) >>> 0
  return (ipNum & mask) === (rangeNum & mask)
}

function ipToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const p of parts) {
    const v = parseInt(p, 10)
    if (Number.isNaN(v) || v < 0 || v > 255) return null
    n = (n << 8) + v
  }
  return n >>> 0
}

/* ------------------------------------------------------------------ */
/* 密码强度（passwordStrength）                                        */
/* ------------------------------------------------------------------ */

export interface PasswordStrengthResult {
  score: 0 | 1 | 2 | 3 | 4
  label: '很弱' | '弱' | '一般' | '强' | '很强'
  suggestions: string[]
}

export function checkPasswordStrength(password: string): PasswordStrengthResult {
  const suggestions: string[] = []
  let score = 0
  if (password.length >= 8) score += 1
  else suggestions.push('密码长度至少 8 位')
  if (password.length >= 12) score += 1
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1
  else suggestions.push('建议同时包含大小写字母')
  if (/\d/.test(password)) score += 1
  else suggestions.push('建议包含数字')
  if (/[^a-zA-Z0-9]/.test(password)) score += 1
  else suggestions.push('建议包含特殊字符')
  // 常见弱密码惩罚
  if (/^(123|abc|password|qwerty|111|000)/i.test(password)) score = Math.min(score, 1)
  const clamped = Math.min(4, Math.max(0, score)) as PasswordStrengthResult['score']
  const labels: PasswordStrengthResult['label'][] = ['很弱', '弱', '一般', '强', '很强']
  return { score: clamped, label: labels[clamped]!, suggestions }
}

/* ------------------------------------------------------------------ */
/* 安全评分（securityScoreService）                                    */
/* ------------------------------------------------------------------ */

export interface SecurityScoreInput {
  passwordStrength: number
  twoFactorEnabled: boolean
  lastPasswordChangeDays: number
  activeSessions: number
  recentFailedLogins: number
  emailVerified: boolean
  phoneVerified: boolean
}

export function computeSecurityScore(input: SecurityScoreInput): {
  score: number
  level: 'A' | 'B' | 'C' | 'D'
  recommendations: string[]
} {
  let score = 0
  const recommendations: string[] = []
  score += Math.min(40, input.passwordStrength * 10)
  if (input.passwordStrength < 3) recommendations.push('提升密码强度')
  if (input.twoFactorEnabled) score += 20
  else recommendations.push('开启双因素认证')
  if (input.lastPasswordChangeDays < 90) score += 10
  else recommendations.push('近期修改密码')
  if (input.activeSessions <= 3) score += 10
  else recommendations.push('清理多余会话')
  if (input.recentFailedLogins < 5) score += 10
  if (input.emailVerified) score += 5
  if (input.phoneVerified) score += 5
  score = Math.min(100, score)
  const level: 'A' | 'B' | 'C' | 'D' =
    score >= 90 ? 'A' : score >= 75 ? 'B' : score >= 60 ? 'C' : 'D'
  return { score, level, recommendations }
}

/* ------------------------------------------------------------------ */
/* 安全日志（securityLogService）                                      */
/* ------------------------------------------------------------------ */

export type SecurityLogLevel = 'info' | 'warning' | 'critical'
export type SecurityLogEvent =
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'password_change'
  | '2fa_enable'
  | '2fa_disable'
  | 'permission_granted'
  | 'permission_denied'
  | 'session_expired'
  | 'suspicious_activity'

export interface SecurityLogEntry {
  id: string
  userId?: string
  event: SecurityLogEvent
  level: SecurityLogLevel
  ip: string | null
  userAgent: string | null
  message: string
  metadata?: Record<string, unknown>
  timestamp: number
}

const logBuffer: SecurityLogEntry[] = []
const MAX_BUFFER = 200

export function logSecurityEvent(
  event: SecurityLogEvent,
  level: SecurityLogLevel,
  message: string,
  metadata?: Record<string, unknown>,
): SecurityLogEntry {
  const entry: SecurityLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event,
    level,
    ip: null,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    message,
    metadata,
    timestamp: Date.now(),
  }
  logBuffer.push(entry)
  if (logBuffer.length > MAX_BUFFER) logBuffer.shift()
  return entry
}

export function getSecurityLogs(limit = 50): SecurityLogEntry[] {
  return logBuffer.slice(-limit)
}

export function clearSecurityLogs(): number {
  const n = logBuffer.length
  logBuffer.length = 0
  return n
}

/* ------------------------------------------------------------------ */
/* 安全通知（securityNotificationService）                              */
/* ------------------------------------------------------------------ */

export type NotificationChannel = 'email' | 'sms' | 'in_app' | 'webhook'
export type NotificationSeverity = 'info' | 'warning' | 'critical'

export interface SecurityNotification {
  id: string
  userId?: string
  title: string
  content: string
  severity: NotificationSeverity
  channels: NotificationChannel[]
  read: boolean
  createdAt: number
}

const notifications: SecurityNotification[] = []

export function pushSecurityNotification(
  title: string,
  content: string,
  severity: NotificationSeverity,
  channels: NotificationChannel[] = ['in_app'],
): SecurityNotification {
  const n: SecurityNotification = {
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title,
    content,
    severity,
    channels,
    read: false,
    createdAt: Date.now(),
  }
  notifications.push(n)
  return n
}

export function getSecurityNotifications(onlyUnread = false): SecurityNotification[] {
  return onlyUnread ? notifications.filter((n) => !n.read) : notifications.slice()
}

export function markNotificationRead(id: string): boolean {
  const n = notifications.find((x) => x.id === id)
  if (!n) return false
  n.read = true
  return true
}

/* ------------------------------------------------------------------ */
/* 远程 API（写入后端审计日志）                                        */
/* ------------------------------------------------------------------ */

export async function apiReportSecurityEvent(
  input: Pick<SecurityLogEntry, 'event' | 'level' | 'message' | 'metadata'>,
): Promise<ApiResult<{ reported: boolean }>> {
  return fetchApi<{ reported: boolean }>('/security/log', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function apiGetSecurityScore(): Promise<
  ApiResult<{ score: number; level: 'A' | 'B' | 'C' | 'D' }>
> {
  return fetchApi<{ score: number; level: 'A' | 'B' | 'C' | 'D' }>('/security/score')
}
