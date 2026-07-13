/**
 * 错误码枚举（HTTP-aligned + 业务标识符）。
 * errorCode 是稳定的业务错误标识符，前端可基于此做 i18n key 映射和细粒度 UI 处理。
 * code 字段保持与 HTTP status 对齐（0=成功，4xx/5xx=错误）。
 */
export const ErrorCode = {
  VALIDATION_FAILED: { status: 400, code: 'VALIDATION_FAILED' },
  UNAUTHORIZED: { status: 401, code: 'UNAUTHORIZED' },
  FORBIDDEN: { status: 403, code: 'FORBIDDEN' },
  NOT_FOUND: { status: 404, code: 'NOT_FOUND' },
  CONFLICT: { status: 409, code: 'CONFLICT' },
  RATE_LIMITED: { status: 429, code: 'RATE_LIMITED' },
  LOCKED: { status: 423, code: 'LOCKED' },
  INTERNAL_ERROR: { status: 500, code: 'INTERNAL_ERROR' },
  UPSTREAM_FAILURE: { status: 502, code: 'UPSTREAM_FAILURE' },
  SERVICE_UNAVAILABLE: { status: 503, code: 'SERVICE_UNAVAILABLE' },
  MEMBER_EXISTS: { status: 409, code: 'MEMBER_EXISTS' },
  OPTIMISTIC_LOCK: { status: 409, code: 'OPTIMISTIC_LOCK' },
  INVALID_MONEY: { status: 400, code: 'INVALID_MONEY' },
  INVALID_TIMEZONE: { status: 400, code: 'INVALID_TIMEZONE' },
} as const

export type ErrorCodeKey = keyof typeof ErrorCode
