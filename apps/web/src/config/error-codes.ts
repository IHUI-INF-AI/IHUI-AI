/**
 * 错误码定义 — 迁移自旧架构 client/src/config/error-codes.ts
 * 业务错误码枚举、判定函数与错误消息映射
 */

export const ERROR_CODES = {
  TOKEN_EXPIRED: [40101, 499, 401],
  // 2026-06-28 联调: 后端统一响应码 SUCCESS="0" (server/app/schemas/error_codes.py),
  // 同时保留 200/201 兼容旧 Java 后端返回的 HTTP 状态码作为业务码的场景.
  SUCCESS: [200, 201, 0],
  BAD_REQUEST: [400],
  FORBIDDEN: [403],
  NOT_FOUND: [404],
  INTERNAL_SERVER_ERROR: [500],
  SERVICE_UNAVAILABLE: [503],
  ACCOUNT_LOCKED: [40301, 40302],
  ACCOUNT_DISABLED: [40303, 40304],
  ACCOUNT_DELETED: [40305],
  PASSWORD_EXPIRED: [40310],
  PASSWORD_WRONG: [40102, 40103],
  CAPTCHA_EXPIRED: [40001],
  CAPTCHA_WRONG: [40002],
  PHONE_NOT_VERIFIED: [40320],
  TOO_MANY_REQUESTS: [429],
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES][number]

export function isTokenExpired(code: number | string): boolean {
  if (typeof code === 'number') {
    return (ERROR_CODES.TOKEN_EXPIRED as readonly number[]).includes(code)
  }

  const str = String(code).trim()
  if (/^\d+$/.test(str)) {
    const numCode = parseInt(str, 10)
    return (ERROR_CODES.TOKEN_EXPIRED as readonly number[]).includes(numCode)
  }

  if (str === 'A40101' || str.endsWith('40101')) return true

  return false
}

export function isSuccess(code: number | string): boolean {
  const numCode = typeof code === 'string' ? parseInt(code, 10) : code
  return (ERROR_CODES.SUCCESS as readonly number[]).includes(numCode)
}

export function isBadRequest(code: number): boolean {
  return (ERROR_CODES.BAD_REQUEST as readonly number[]).includes(code)
}

export function isForbidden(code: number): boolean {
  return (ERROR_CODES.FORBIDDEN as readonly number[]).includes(code)
}

export function isNotFound(code: number): boolean {
  return (ERROR_CODES.NOT_FOUND as readonly number[]).includes(code)
}

export function isInternalServerError(code: number): boolean {
  return (ERROR_CODES.INTERNAL_SERVER_ERROR as readonly number[]).includes(code)
}

export function isServiceUnavailable(code: number): boolean {
  return (ERROR_CODES.SERVICE_UNAVAILABLE as readonly number[]).includes(code)
}

export function isAccountLocked(code: number): boolean {
  return (ERROR_CODES.ACCOUNT_LOCKED as readonly number[]).includes(code)
}

export function isAccountDisabled(code: number): boolean {
  return (ERROR_CODES.ACCOUNT_DISABLED as readonly number[]).includes(code)
}

export function isAccountDeleted(code: number): boolean {
  return (ERROR_CODES.ACCOUNT_DELETED as readonly number[]).includes(code)
}

export function isPasswordExpired(code: number): boolean {
  return (ERROR_CODES.PASSWORD_EXPIRED as readonly number[]).includes(code)
}

export function isPasswordWrong(code: number): boolean {
  return (ERROR_CODES.PASSWORD_WRONG as readonly number[]).includes(code)
}

export function isCaptchaExpired(code: number): boolean {
  return (ERROR_CODES.CAPTCHA_EXPIRED as readonly number[]).includes(code)
}

export function isCaptchaWrong(code: number): boolean {
  return (ERROR_CODES.CAPTCHA_WRONG as readonly number[]).includes(code)
}

export function isPhoneNotVerified(code: number): boolean {
  return (ERROR_CODES.PHONE_NOT_VERIFIED as readonly number[]).includes(code)
}

export function isTooManyRequests(code: number): boolean {
  return (ERROR_CODES.TOO_MANY_REQUESTS as readonly number[]).includes(code)
}

/** 错误码 -> i18n key 映射（供前端展示） */
export function getErrorMessage(code: number): string {
  if (isAccountLocked(code)) return 'errors.accountLocked'
  if (isAccountDisabled(code)) return 'errors.accountDisabled'
  if (isAccountDeleted(code)) return 'errors.accountDeleted'
  if (isPasswordExpired(code)) return 'errors.passwordExpired'
  if (isPasswordWrong(code)) return 'errors.passwordWrong'
  if (isCaptchaExpired(code)) return 'errors.captchaExpired'
  if (isCaptchaWrong(code)) return 'errors.captchaWrong'
  if (isPhoneNotVerified(code)) return 'errors.phoneNotVerified'
  if (isTooManyRequests(code)) return 'errors.tooManyRequests'
  if (isTokenExpired(code)) return 'errors.tokenExpired'
  if (isForbidden(code)) return 'errors.forbidden'
  if (isNotFound(code)) return 'errors.notFound'
  if (isInternalServerError(code)) return 'errors.serverError'
  if (isServiceUnavailable(code)) return 'errors.serviceUnavailable'
  return 'errors.unknown'
}
