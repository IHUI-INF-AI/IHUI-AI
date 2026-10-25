// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

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
  // b76-12g-3-40(G-998167):把「答不了」编进稳定 errorCode,三档各管一层:
  //  - CAPABILITY_UNSUPPORTED(501):能力结构上不存在,重试永远不可能成功 ⇒ UI 停止无效轮询;
  //  - CAPABILITY_UNAVAILABLE(503):此刻没有实例/未就绪,稍后也许可以 ⇒ 允许退避重试;
  //  - DUPLICATE_REQUEST(409):被去重拒绝 ⇒ 不得当成新任务已入队、不得展示「已触发」。
  CAPABILITY_UNSUPPORTED: { status: 501, code: 'CAPABILITY_UNSUPPORTED' },
  CAPABILITY_UNAVAILABLE: { status: 503, code: 'CAPABILITY_UNAVAILABLE' },
  DUPLICATE_REQUEST: { status: 409, code: 'DUPLICATE_REQUEST' },
} as const

export type ErrorCodeKey = keyof typeof ErrorCode

// ===================== ErrorCode → ErrorCategory 全量映射(b76-01 票3) =====================
// wave-2 已在 @ihui/types error-serialize.ts 落了封闭的 ErrorCategory 联合
// (rate_limited / quota_exhausted / auth / forbidden / not_found / conflict /
// validation / upstream / internal)。本映射是两套体系的唯一接线点:
//  - 全量封顶:`Record<ErrorCodeKey, ErrorCategory>` 让 TS 编译期强制每个
//    ErrorCode 恰好一个类别 —— 新增 ErrorCode 而映射缺格必须编译红,
//    写入非法类别值同样编译红。缺一格都不行,没有兜底出口。
//  - 纯类型导入:只 `import type`,不引入任何运行时重依赖
//    (@ihui/types 本就在 apps/api dependencies,先例见 plugins/api-key-auth.ts)。
//  - quota_exhausted 暂无对应 ErrorCode:余额/支付类失败目前未编稳定码,
//    待相关码落地时在此表补格(编译期不缺格,类别联合先于码集存在是正常的)。
import type { ErrorCategory } from '@ihui/types'

export const ERROR_CODE_CATEGORY: Record<ErrorCodeKey, ErrorCategory> = {
  // ---- validation:请求载荷/参数非法,客户端改了重发才可能成功 ----
  VALIDATION_FAILED: 'validation',
  INVALID_MONEY: 'validation',
  INVALID_TIMEZONE: 'validation',
  // 501 = 能力结构上不存在:请求的内容本身不可满足,属不可挽回的客户端侧错误,
  // 与"参数非法"同族(重试无效),故归 validation 而非 internal。
  CAPABILITY_UNSUPPORTED: 'validation',

  // ---- auth:身份未通过(没登录/凭证失效),与"登录了但不许"的 forbidden 分开 ----
  UNAUTHORIZED: 'auth',

  // ---- forbidden:身份已确认但权限不足 ----
  FORBIDDEN: 'forbidden',

  // ---- not_found:目标资源不存在 ----
  NOT_FOUND: 'not_found',

  // ---- conflict:与当前状态/并发竞争相撞 ----
  CONFLICT: 'conflict',
  MEMBER_EXISTS: 'conflict',
  OPTIMISTIC_LOCK: 'conflict',
  // 423 = 资源被锁,是并发竞争的一种形态,可稍后重试,与 409 同族归 conflict。
  LOCKED: 'conflict',
  // 被去重拒绝:同一任务撞上在途请求,状态竞争 → conflict。
  DUPLICATE_REQUEST: 'conflict',

  // ---- rate_limited:频率/限流,判定只能由该类别得出 ----
  RATE_LIMITED: 'rate_limited',

  // ---- upstream:下游依赖不可用(503 此刻无实例/未就绪、稍后也许可以) ----
  UPSTREAM_FAILURE: 'upstream',
  SERVICE_UNAVAILABLE: 'upstream',
  CAPABILITY_UNAVAILABLE: 'upstream',

  // ---- internal:我方代码/基础设施故障,客户端重试无意义 ----
  INTERNAL_ERROR: 'internal',
}

/** 取值 helper:由稳定 ErrorCode 查封闭类别(表已全量封顶,必中)。 */
export function categoryOf(code: ErrorCodeKey): ErrorCategory {
  return ERROR_CODE_CATEGORY[code]
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
