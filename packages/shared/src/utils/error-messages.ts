/**
 * 错误消息工具:errorCode 映射 + 用户友好中文化转换。
 *
 * 设计目标(2026-08-01 立):
 * - 后端 AppError 的 errorCode 是稳定标识符,前端通过此映射得到中文文案
 * - 任意错误(string / Error / ApiResult 失败分支 / unknown)都能转成普通用户能看懂的中文
 * - 已是中文的错误原样返回,避免过度处理
 * - 不依赖 i18n key 是否补齐,直接返回中文(适合所有端,包括未接入 i18n 的端)
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
 * 优先用 errorCode 对应的 i18n 文案,fallback 到原始 message。
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

/**
 * errorCode → 固定中文文案映射(不依赖 i18n,所有端通用)。
 * 用于 toUserFriendlyMessage 的第一优先级匹配。
 */
const ERROR_CODE_TO_ZH: Record<string, string> = {
  VALIDATION_FAILED: '提交的信息有误,请检查后重试',
  UNAUTHORIZED: '登录已过期,请重新登录',
  FORBIDDEN: '没有权限执行此操作',
  NOT_FOUND: '找不到对应的资源',
  CONFLICT: '操作冲突,请刷新后重试',
  RATE_LIMITED: '操作过于频繁,请稍后再试',
  LOCKED: '资源已被锁定,请稍后再试',
  INTERNAL_ERROR: '服务器开小差了,请稍后重试',
  UPSTREAM_FAILURE: '上游服务异常,请稍后重试',
  SERVICE_UNAVAILABLE: '服务暂不可用,请稍后重试',
  MEMBER_EXISTS: '该成员已存在',
  OPTIMISTIC_LOCK: '数据已被其他人修改,请刷新后重试',
  INVALID_MONEY: '金额格式不正确',
  INVALID_TIMEZONE: '时区格式不正确',
}

/**
 * HTTP 状态码 → 中文文案映射。
 */
const STATUS_TO_ZH: Record<number, string> = {
  400: '提交的信息有误,请检查后重试',
  401: '登录已过期,请重新登录',
  403: '没有权限执行此操作',
  404: '找不到对应的资源',
  409: '操作冲突,请刷新后重试',
  429: '操作过于频繁,请稍后再试',
  500: '服务器开小差了,请稍后重试',
  502: '网关异常,请稍后重试',
  503: '服务暂不可用,请稍后重试',
  504: '网关超时,请稍后重试',
}

/**
 * 英文关键词 → 中文文案映射(按优先级排序,先匹配先返回)。
 * 用于识别裸 Error 的英文 message。
 */
const ENGLISH_PATTERNS: ReadonlyArray<{ pattern: RegExp; zh: string }> = [
  // 认证/授权类
  { pattern: /authentication required|not authenticated|not logged in/i, zh: '请先登录' },
  {
    pattern: /unauthorized|token (?:expired|invalid)|jwt (?:expired|invalid)/i,
    zh: '登录已过期,请重新登录',
  },
  { pattern: /forbidden|access denied|permission denied|not allowed/i, zh: '没有权限执行此操作' },
  // 限流类
  { pattern: /rate limit|too many requests|throttl/i, zh: '操作过于频繁,请稍后再试' },
  // 网络类
  {
    pattern:
      /network|fetch failed|connection refused|connection reset|failed to fetch|err_network/i,
    zh: '网络连接异常,请检查网络后重试',
  },
  { pattern: /timeout|timed out/i, zh: '请求超时,请稍后重试' },
  { pattern: /abort/i, zh: '请求已取消' },
  // 资源类
  { pattern: /not found|not exist|cannot find|no such/i, zh: '找不到对应的资源' },
  { pattern: /already exist|duplicate|conflict/i, zh: '数据已存在,请刷新后重试' },
  // 参数类
  { pattern: /invalid|missing|required|must be|expected/i, zh: '提交的信息有误,请检查后重试' },
  // 服务类
  { pattern: /internal server error|server error/i, zh: '服务器开小差了,请稍后重试' },
  { pattern: /service unavailable|unavailable/i, zh: '服务暂不可用,请稍后重试' },
  { pattern: /upstream|bad gateway|gateway/i, zh: '上游服务异常,请稍后重试' },
  // 通用失败
  { pattern: /failed to|could not|unable to|cannot|can't/i, zh: '操作失败,请稍后重试' },
  { pattern: /unknown error|unknown/i, zh: '发生未知错误,请稍后重试' },
]

/** 判断字符串是否"以英文为主"(需要中文化处理) */
function isMostlyEnglish(s: string): boolean {
  if (!s) return false
  // 含中文 → 视为已中文化
  if (/[\u4e00-\u9fa5]/.test(s)) return false
  // 含英文字母 → 视为英文
  return /[a-zA-Z]/.test(s)
}

/**
 * 把任意错误归一化为"用户友好的中文消息"。
 *
 * 优先级:
 * 1. errorCode → 固定中文文案(最稳定)
 * 2. HTTP status → 中文文案
 * 3. 英文关键词匹配 → 中文文案
 * 4. 已是中文 → 原样返回
 * 5. 英文兜底 → "操作失败,请稍后重试"
 * 6. 空值 → "操作失败,请稍后重试"
 *
 * @param error 任意错误(string / Error / { error?, message?, errorCode?, status? } / unknown)
 * @returns 普通用户能看懂的中文消息
 */
export function toUserFriendlyMessage(error: unknown): string {
  // 解构出关键字段
  let message: string | undefined
  let errorCode: string | undefined
  let status: number | undefined

  if (typeof error === 'string') {
    message = error
  } else if (error instanceof Error) {
    message = error.message
    const ext = error as Error & { errorCode?: string; status?: number }
    errorCode = ext.errorCode
    status = ext.status
  } else if (error && typeof error === 'object') {
    const obj = error as {
      message?: unknown
      error?: unknown
      errorCode?: unknown
      status?: unknown
    }
    // ApiResult 失败分支优先用 error 字段,fallback 到 message
    message =
      typeof obj.error === 'string'
        ? obj.error
        : typeof obj.message === 'string'
          ? obj.message
          : undefined
    if (typeof obj.errorCode === 'string') errorCode = obj.errorCode
    if (typeof obj.status === 'number') status = obj.status
  }

  // 1. errorCode 优先
  if (errorCode) {
    const zh = ERROR_CODE_TO_ZH[errorCode]
    if (zh) return zh
  }

  // 2. HTTP status
  if (status) {
    const zh = STATUS_TO_ZH[status]
    if (zh) return zh
  }

  // 3. 空值兜底
  if (!message || !message.trim()) {
    return '操作失败,请稍后重试'
  }

  const trimmed = message.trim()

  // 4. 已是中文 → 原样返回(保留业务方精心写的中文文案)
  if (!isMostlyEnglish(trimmed)) {
    return trimmed
  }

  // 5. 英文关键词匹配
  for (const { pattern, zh } of ENGLISH_PATTERNS) {
    if (pattern.test(trimmed)) {
      return zh
    }
  }

  // 6. 英文兜底
  return '操作失败,请稍后重试'
}
