export const ERROR_CODES = {
  // 2026-06-24 修复: 增加 0 (后端 schemas/common.py success code "0") 和 6 位业务码
  TOKEN_EXPIRED: [40101, 499, 401, 401000, 401001, 401002, 401003],
  SUCCESS: [0, 200, 201],
  BAD_REQUEST: [400, 400000],
  FORBIDDEN: [403, 403000],
  NOT_FOUND: [404, 404000],
  INTERNAL_SERVER_ERROR: [500, 500000],
  SERVICE_UNAVAILABLE: [503, 503000],
  ACCOUNT_LOCKED: [40301, 40302, 403010, 403011],
  ACCOUNT_DISABLED: [40303, 40304, 403020, 403021],
  ACCOUNT_DELETED: [40305, 403030],
  PASSWORD_EXPIRED: [40310, 403040],
  PASSWORD_WRONG: [40102, 40103, 401010, 401011],
  CAPTCHA_EXPIRED: [40001, 400010],
  CAPTCHA_WRONG: [40002, 400020],
  PHONE_NOT_VERIFIED: [40320, 403050],
  TOO_MANY_REQUESTS: [429, 429000],
} as const

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES][number]

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
