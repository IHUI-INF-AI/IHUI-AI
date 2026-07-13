/**
 * errorCode → i18n key 映射表。
 * 后端 AppError 的 errorCode 是稳定标识符，前端通过此映射实现错误消息国际化。
 * 优先使用 errorCode 对应的 i18n 文案，fallback 到原始 error.message。
 */

const ERROR_CODE_TO_I18N_KEY: Record<string, string> = {
  VALIDATION_FAILED: 'errors.validationFailed',
  UNAUTHORIZED: 'errors.unauthorized',
  FORBIDDEN: 'errors.forbidden',
  NOT_FOUND: 'errors.notFound',
  CONFLICT: 'errors.conflict',
  RATE_LIMITED: 'errors.rateLimited',
  LOCKED: 'errors.locked',
  INTERNAL_ERROR: 'errors.internalError',
  UPSTREAM_FAILURE: 'errors.upstreamFailure',
  SERVICE_UNAVAILABLE: 'errors.serviceUnavailable',
  MEMBER_EXISTS: 'errors.memberExists',
  OPTIMISTIC_LOCK: 'errors.optimisticLock',
  INVALID_MONEY: 'errors.invalidMoney',
  INVALID_TIMEZONE: 'errors.invalidTimezone',
}

export function getErrorI18nKey(errorCode: string): string | undefined {
  return ERROR_CODE_TO_I18N_KEY[errorCode]
}

/**
 * 从 ApiError 获取国际化错误消息。
 * 优先用 errorCode 对应的 i18n 文案，fallback 到原始 message。
 */
export function resolveErrorMessage(
  error: { message?: string; errorCode?: string },
  t: (key: string) => string,
): string {
  if (error.errorCode) {
    const i18nKey = getErrorI18nKey(error.errorCode)
    if (i18nKey) return t(i18nKey)
  }
  return error.message ?? t('errors.unknown')
}
