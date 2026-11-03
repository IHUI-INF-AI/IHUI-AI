// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import {
  UNKNOWN_FAILURE_KIND,
  classifyViewFailure,
  type ViewFailureKind,
} from './view-failure-taxonomy'

/**
 * 重放安全性分类(G-998106)—— 失败契约里写明"这次失败能否安全重放"。
 *
 * 上游机制(学习副本 .ihui-agent/tmp/zcode-study,zcode `browser-use/result.ts`):
 * 结果壳用 `ok` 判别联合,失败侧错误体带 `sideEffect: z.enum(["none","uncertain"]).optional()`
 * ——失败不只是"错了",还要回答"失败时副作用落到哪一步":调用方据此决定**直接重试**还是
 * **先查状态**。`none` = 失败发生在任何副作用之前(请求被前置拒绝),重放安全;
 * `uncertain` = 失败点在副作用可能已发生之后(或无法证明未发生),不得自动重试。
 *
 * 本模块在 @ihui/shared 定这份副作用/可重放枚举,并给出唯一分类纯函数
 * `classifyReplaySafety(errorCode)`:**未知错误码一律落保守值 `uncertain`**,
 * 即"未知码 ⇒ uncertain ⇒ 上层不自动重试,先查状态"。把"不知道"当"不安全"处理,
 * 因为两端代价不对称:误判不安全的代价是多一次状态查询,误判安全的代价是
 * 重复扣款 / 重复发帖这类真实副作用。
 *
 * 分类底座复用 D92 视图失败分类学(`./view-failure-taxonomy` 同一张 `VIEW_FAILURE_ENTRIES`
 * 表,不另起第二张码表):已登记的码先归一到 15 类,再按"失败点相对副作用的位置"分两档;
 * 归不进 15 类的码(含未知业务码)走保守档。码形归一随之复用:
 * `backend-timeout` / `backend_timeout` / `MCP_BACKEND_TIMEOUT` / `backendTimeout` 同判。
 */

/**
 * 重放安全档(副作用/可重放枚举;封闭面,对齐上游 `sideEffect: "none" | "uncertain"`)。
 *
 * - `none`:副作用确定未发生 —— 失败发生在请求进入处理器之前(参数校验、鉴权、
 *   路由/能力协商、依赖缺失、环境未就绪、目标不存在等前置拒绝)。上层**可以**安全重放。
 * - `uncertain`:副作用可能已发生,或无法证明未发生(超时/断连后服务端可能已完成、
 *   处理器中途抛错/崩溃、回包丢失、响应无法解析等)。上层**不得自动重试**,先查状态再决策。
 *
 * 刻意只有两档、不设第三档 "safe-replay":上游契约即 `none | uncertain`,
 * "确定可重放"已由 `none` 表达,第三档只会与 `none` 语义重叠。
 */
export type ReplaySafety = 'none' | 'uncertain'

/** 枚举全集(封闭面;消费方漏档分支由 `never` 检查或此长度断言兜住)。 */
export const REPLAY_SAFETIES: readonly ReplaySafety[] = Object.freeze(['none', 'uncertain'])

/** 保守默认档:任何判不出安全的情况都落这里(未知码 ⇒ uncertain ⇒ 上层不自动重试)。 */
export const REPLAY_UNCERTAIN: ReplaySafety = 'uncertain'

/**
 * 15 类失败 → 重放安全档。判据只有一条:**失败点相对副作用的位置**。
 *
 * `none`(请求根本没进处理器就被拒):
 *   资源不存在(404/ENOENT —— 目标不在,读写都一样,什么都没发生)、入口未注册/非法、
 *   依赖模块缺失、环境初始化失败(503 未就绪)、已停用(预期态)、
 *   能力未提供(405/501/-32601)、协议协商失败(-32600)、鉴权拒绝(401/403)。
 *
 * `uncertain`(处理器已开始执行后才失败,或结果无法确认):
 *   运行时异常(500/-32603 处理器中途抛错,前后不可知)、
 *   资源超限(413/429 是前置拒绝,但输出截断/上下文超限发生在执行后 —— 混合形态取保守)、
 *   后端超时(408/504/AbortError —— 服务端可能在放弃后完成)、
 *   后端退出(连接关闭/502 —— 回包丢失 ≠ 事务未发生)、
 *   崩溃(SIGSEGV/OOM —— 现场不可信)、
 *   响应无效(-32700/schema 校验失败 —— 有回包说明事务已执行,重放会二次执行)。
 *
 * 以 `Record<ViewFailureKind, …>` 书写:D92 分类学新增第 16 类时本表编译即红,
 * 不允许"新类静默落保守档"之外的任何漂移路径。
 */
const KIND_SAFETY: Readonly<Record<ViewFailureKind, ReplaySafety>> = Object.freeze({
  resourceNotFound: 'none',
  entrypointNotRegistered: 'none',
  entrypointInvalid: 'none',
  dependencyModuleMissing: 'none',
  environmentInitFailed: 'none',
  disabled: 'none',
  capabilityNotOffered: 'none',
  protocolMismatch: 'none',
  authForbidden: 'none',
  runtimeException: 'uncertain',
  resourceLimitExceeded: 'uncertain',
  backendTimeout: 'uncertain',
  backendExited: 'uncertain',
  backendCrashed: 'uncertain',
  invalidResponse: 'uncertain',
})

/**
 * 错误码 → 重放安全档(纯函数,唯一分类入口)。
 *
 * **未知错误码 ⇒ 副作用取保守值 `uncertain` ⇒ 上层不得自动重试**(只能先查状态)。
 * 判出仅认 `matchedBy === 'errorCode'`:兜底态(含字面 `UNKNOWN`)一律保守,
 * 绝不因为"看着像已知码"就给出 `none`。
 */
export function classifyReplaySafety(errorCode: string): ReplaySafety {
  const resolution = classifyViewFailure({ errorCode })
  if (resolution.matchedBy !== 'errorCode' || resolution.kind === UNKNOWN_FAILURE_KIND) {
    return REPLAY_UNCERTAIN
  }
  return KIND_SAFETY[resolution.kind]
}

/**
 * 上层唯一的自动重试决策点:`none` ⇒ 可自动重试;`uncertain` ⇒ 不得自动重试(先查状态)。
 * 把"能不能自动重试"收在这里,而不是散落在各调用点的布尔参数里。
 */
export function canAutoRetry(safety: ReplaySafety): boolean {
  return safety === 'none'
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
