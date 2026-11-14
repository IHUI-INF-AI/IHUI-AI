// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  // D200 补 413/422 专门档:此前 413(bodyLimit 超限)落"操作失败,请稍后重试"通用兜底,
  // 失"过大"语义;422(语义无效)与 400 同档但显式给位。映射方向沿 failure-code.ts
  // (413→context_limit、422→invalid_arguments,B 层 error-catalog 同步登记)。
  413: '请求内容过大,请精简后重试',
  422: '提交的内容无法处理,请检查后重试',
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
    // 词序必须双向覆盖:后端实际下发的是 `Invalid or expired token`(形容词在前),
    // 而旧正则只写了 `token (expired|invalid)`(名词在前) ⇒ 该句落到下面的参数类
    // `/invalid/`,用户看到「提交的信息有误,请检查后重试」,被引导去改表单。
    // 2026-11-14 由 toFriendlyOr 的用例实测抓出(L15 断言红)。
    pattern:
      /unauthorized|(?:token|jwt).{0,24}?(?:expired|invalid)|(?:expired|invalid).{0,16}?(?:token|jwt)/i,
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
 * 5. 英文兜底 → {@link GENERIC_FAILURE_TEXT}
 * 6. 空值 → {@link GENERIC_FAILURE_TEXT}
 *
 * @param error 任意错误(string / Error / { error?, message?, errorCode?, status? } / unknown)
 * @returns 普通用户能看懂的中文消息
 *
 * ⚠️ **返回值恒非空**(第 5/6 步都会给出兜底文案)。因此
 * `toUserFriendlyMessage(e) || '本页自己的文案'` 里的 `||` 分支是**死代码**。
 * 想让"错误确实没带任何可用信息"时回落到调用方本地文案,用 {@link toFriendlyOr}:
 * `toFriendlyOr(e, '本页文案')` —— 它就是这段判空 + 转文案的两行写法的单一实现。
 * (2026-09-24 实测:mobile-rn 24 处吞错改造先按两行写法落地,2026-11-14 起收成一处出口。)
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
    return GENERIC_FAILURE_TEXT
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
  return GENERIC_FAILURE_TEXT
}

/**
 * 通用兜底文案:识别不出具体原因时给用户看的那一句。
 *
 * 导出成常量是为了让 {@link toFriendlyOr} 能判"这次是不是落到了兜底" ——
 * 两处各写一份字面量,一旦有人改了其中一处,判等就静默失效。
 */
export const GENERIC_FAILURE_TEXT = '操作失败,请稍后重试'

/**
 * 原始异常 → 文案,**识别不出时回落到调用方自己的文案**。
 *
 * 存在的理由:`e instanceof Error ? e.message : t('x')` 这种写法在移动端有 105 处,
 * 它的兜底分支是对的(每屏有自己的「加载失败」「保存失败」),但**成功分支会把
 * `fetch failed` / `Cannot read properties of undefined` 这类英文术语直接贴到界面上**
 * (2026-11-14 真机:登录页横幅 `fetch failed: The operation was aborted.`)。
 *
 * 这里做的是两件事的合成:
 *  1. 错误本身带得动信息(有 message/字符串)⇒ 交 {@link toUserFriendlyMessage} 归一;
 *  2. 什么可用信息都没有 ⇒ 用调用方那句更具体的文案,不降级成通用兜底。
 *
 * 与 `toUserFriendlyMessage(e) || fallback` 的区别:后者是死代码(前者恒非空),
 * 会把每屏专属文案抹成「操作失败,请稍后重试」。
 */
export function toFriendlyOr(error: unknown, fallback: string): string {
  return hasUsableSignal(error) ? toUserFriendlyMessage(error) : fallback
}

/**
 * 这个错误**自身**是否带得动信息(消息或身份)。
 *
 * 不能只判 `error instanceof Error`:后端失败载荷常常是裸对象
 * `{ errorCode, message }` 或 `{ status, error }`(见 `apiFailureToError` 的入参形态),
 * 只认 Error 会把带 errorCode 的对象当成"没信息"、退回调用方兜底,
 * 于是 401 又变回「加载失败」—— 正是本函数要消灭的那类降级。
 */
function hasUsableSignal(error: unknown): boolean {
  if (typeof error === 'string') return error.trim().length > 0
  if (error instanceof Error) return error.message.trim().length > 0
  if (!error || typeof error !== 'object') return false
  const o = error as {
    message?: unknown
    error?: unknown
    errorCode?: unknown
    status?: unknown
  }
  if (typeof o.message === 'string' && o.message.trim()) return true
  if (typeof o.error === 'string' && o.error.trim()) return true
  if (typeof o.errorCode === 'string' && o.errorCode.trim()) return true
  return typeof o.status === 'number'
}
/**
 * ApiResult 的失败分支 → Error,并把 `status` / `errorCode` / `retryAfter` 一起挂在错误对象上。
 *
 * 为什么要专门有这个出口,而不是各处写 `throw new Error(res.error)`:全仓实测 **213 处**
 * `throw new Error(res.error)`,而 ApiResult 的失败分支本来带着 status/errorCode ——
 * 只取 message 就等于把"这个错误是鉴权失败 / 限流 / 校验失败"的身份信息整份丢掉。
 * 本文件的判序是 **errorCode → HTTP status → 文案正则**,前两档一旦被丢,
 * 401 的 "Invalid or expired token" 就只能落到参数类正则 `/invalid|missing|required/` 上,
 * 用户看到「提交的信息有误,请检查后重试」—— 真机实测:进「广场」tab 一进来就弹这句
 * (PROJECT_PLAN「广场 tab 一进即弹错误框」条)。这不是文案偏好问题:它把"去登录"
 * 引导成了"改表单",用户照着做永远修不好。
 *
 * 迁移这 213 处时**逐处换成本函数**,不要各处再手搓一次 Object.assign(那正是本仓
 * "两处算同一件事必漂移"反复记过的形态)。
 */
export function apiFailureToError(
  res: {
    /** 收 `string | undefined`:见 {@link apiFailureToText} 参数上那段"else 不被收窄"的说明 ——
     *  两出口必须同形,否则调用点换个出口就得改控制流。运行时按空处理并取兜底。 */
    error?: string
    status?: number
    errorCode?: string
    retryAfter?: number
  },
  fallback?: string,
): Error {
  // 兜底文案:调用方原先普遍写 `throw new Error(r.error || '导入失败')`,换成具名出口时
  // 那句端内文案会被顺手丢掉。空串按 `||` 处理(取兜底)—— 有站点原本写 `?? `,而 `'' ?? x` 会得到
  // 空消息;空消息 toast 渲成"只有图标没有文字的方块"(api-client 侧真机实测过),所以这里
  // 刻意统一到 `||` 语义,不给"可见长度为 0 的成功文案"留活路。
  const message = typeof res.error === 'string' && res.error ? res.error : (fallback ?? '')
  const err = new Error(message)
  // 只挂"真的带了值"的字段:挂 status: undefined 会让 toUserFriendlyMessage 的
  // `if (status)` 判空分支与"字段不存在"混成一类,以后想区分就分不出来了。
  if (typeof res.status === 'number') (err as Error & { status?: number }).status = res.status
  if (typeof res.errorCode === 'string')
    (err as Error & { errorCode?: string }).errorCode = res.errorCode
  if (typeof res.retryAfter === 'number')
    (err as Error & { retryAfter?: number }).retryAfter = res.retryAfter
  return err
}

/**
 * ApiResult 失败分支 → **直接可显示的文案**(与 {@link apiFailureToError} 同一份判序,只是不落 Error)。
 *
 * 为什么要有第二个出口而不是让调用方自己 `toUserFriendlyMessage(res)`:后者看着等价,实则
 * 少了一层 —— `ApiResult` 的字段名是 `error`,而 `toUserFriendlyMessage` 的对象分支虽认 `error`,
 * 却**不会**把 `''` 换成调用方原本写的兜底文案;那 93 处 `setError(res.error || t('x.loadFailed'))`
 * 一旦直改就会把每屏各自的「加载失败」退化成通用「操作失败,请稍后重试」——信息量净减。
 * 本出口把两件事一次做完:先按 errorCode → status → 兜底 定身份,再取文案。
 *
 * 射程是"错误身份被丢掉"的**另一半**:守门 135 判的是 `throw` 站点,而这一族把 message
 * 直接塞进 state 显示,`throw` 根本没出现,所以那道门结构上看不见它(真机实测:登录过期时
 * 「我的」页整屏显示「操作失败,请稍后重试」,而同一台机上的广场 tab 显示「登录已过期,请重新登录」)。
 */
export function apiFailureToText(
  res: {
    /**
     * 刻意收 `string | undefined`:调用点有一族守卫写成 `if (res.success && res.data) {…} else {…}`,
     * 那个 else **不被 TS 收窄**到 ApiResult 的失败分支(它还覆盖"success 为真但 data 假"这一格),
     * 于是在 else 里 `res.error` 的类型是 `string | undefined` —— 参数写成必填 `string` 会让
     * 这些正当调用点整片 TS2345(实测 6 处:NewsScreen / PublishScreen / CircleDetailScreen /
     * AigcPublishScreen / LoginScreen×2),而修它们要么重排守卫(改控制流)要么放宽判据。
     * 运行时语义不变:下面 `typeof res.error === 'string' && res.error` 本就把非串按空处理并取兜底。
     */
    error?: string
    status?: number
    errorCode?: string
    retryAfter?: number
  },
  fallback?: string,
): string {
  return toUserFriendlyMessage(apiFailureToError(res, fallback))
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
