// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 对标 Qoder 借鉴清单第 10 项:流错误的**命名错误码分类处置**。
 *
 * ## 在修什么
 * web 发送链的流错误此前只有一张脸:`formatSSEError` 按 HTTP 码分档(401/403/429/5xx/…),
 * 落到界面就是"AI 服务异常,请稍后重试" —— 用户既不知道是哪一类,也不知道下一步该做什么
 * (重试?换模型?看额度?找管理员?)。后端产出的 100+ 命名错误码在端上被压成同一句话,
 * 重试按钮也无差别地挂给每一档,包括"重试必然再撞"的那些。
 *
 * ## 与既有设施的关系(§0.6:不建第二套码表)
 * - **码表唯一真相源** = `./error-catalog.ts` 的 `ERROR_CODE_CATALOG`(errorCode → 标题键/建议
 *   动作键/分类)。本模块**不新增任何错误码**,也不重写任何文案:它只回答"这一类该给哪种
 *   下一步动作、能不能重试",标题与具体建议仍由目录表的键给出。
 * - **分类学唯一真相源** = `../utils/view-failure-taxonomy.ts` 的 `ViewFailureKind`(15 类)。
 *   分类 → 默认处置的映射写在这里,是这一层的**新增判据**(目录表里没有"能不能重试"这一维)。
 *
 * ## 为什么"能不能重试"不能靠 HTTP 码推
 * 同一个 429 在两种世界里含义相反:`RATE_LIMITED` 是等一会儿就能过(可重试),
 * `BUDGET_EXHAUSTED` 要到次日 0 点才重置(重试必然再撞)。HTTP 码把它们压成同一个数,
 * 命名错误码才分得开 —— 这正是本模块存在的理由。
 *
 * ## 失效方向
 * 未收录的码 ⇒ 返回 `null`(**不给"未知错误"兜底**),调用方保持既有行为。
 * 目录表里没有 `UNKNOWN` 条目是既有判据(零兜底),本层沿用同一条纪律:误报比不报更贵。
 */

import {
  ERROR_CODE_CATALOG,
  resolveErrorCatalog,
  type ErrorCatalogEntry,
} from './error-catalog'
import type { ViewFailureKind } from '../utils/view-failure-taxonomy'

/** 词包命名空间(与 `ai.pane.errorCatalog` 并列但独立,见下条注)。 */
export const STREAM_ERRORS_NAMESPACE = 'streamErrors' as const

/**
 * 为什么动作标签单开一个命名空间、而不并进 `ai.pane.errorCatalog`:
 * 目录表的键是 **per-code** 的(139 码 × 2 键),动作标签是 **per-action** 的(9 个)。
 * 并进去会让每个码各带一份"重试"译文(139 份同义文案,改一次要改 139 处);
 * 分开则是"码 → 标题/建议"沿用目录,"动作 → 按钮文案"由本命名空间提供,两者按 id 拼装。
 */

/**
 * 可执行下一步。前四档是票面点名的最小集(重试 / 切模型 / 查额度 / 联系管理员),
 * 其余是同类产品里真实存在且本仓确有对应出口的档(见各条注)。
 */
export const STREAM_ERROR_ACTIONS = [
  /** 立刻重发同一请求(瞬态故障:内部错误 / 超时 / 连接被关闭) */
  'retry',
  /** 等一会儿再发(限频;重试有意义但有最小等待) */
  'waitAndRetry',
  /** 换一个模型(当前模型不可用 / 拒绝服务 / 上下文窗口不够) */
  'switchModel',
  /** 去查额度与计费(预算用尽 / 厂商通道欠费 / 试用额度到期) */
  'checkQuota',
  /** 找管理员(账户受限 / 配置缺失 / 依赖未装 —— 用户自助救不回来) */
  'contactAdmin',
  /** 重新登录(令牌过期) */
  'relogin',
  /** 升级客户端(协议版本过低,服务端已不支持当前版本) */
  'upgradeApp',
  /** 精简输入(上下文 / 单条消息超长 —— 原样重发必然再撞) */
  'trimContext',
  /** 没有可执行动作(请求本身不合法 / 资源不存在):只给文案,不给按钮 */
  'none',
] as const
export type StreamErrorAction = (typeof STREAM_ERROR_ACTIONS)[number]

/** 表外取值一律 false(未知档不得被当成已知档)。 */
export function isStreamErrorAction(value: unknown): value is StreamErrorAction {
  return typeof value === 'string' && (STREAM_ERROR_ACTIONS as readonly string[]).includes(value)
}

/**
 * 该动作的按钮文案键(`streamErrors` 命名空间内的相对键,`t()` 直接用)。
 * 单源:UI 只认这个函数,不得在组件里再写一份 switch。
 */
export function streamErrorActionLabelKey(action: StreamErrorAction): string {
  return `action.${action}`
}

/** 动作是否真的会"再发一次请求"。`none` / `trimContext` 等档挂重试按钮就是把用户送进同一个坑。 */
export function isRetryableAction(action: StreamErrorAction): boolean {
  return action === 'retry' || action === 'waitAndRetry'
}

/**
 * 分类 → 默认动作。15 类全覆盖(类型层面强制:`Record<ViewFailureKind, …>`,
 * 分类学新增一类而这里没跟上 ⇒ tsc 当场红,不会静默落到某个兜底档)。
 */
const ACTION_BY_CATEGORY: Readonly<Record<ViewFailureKind, StreamErrorAction>> = Object.freeze({
  // 请求的资源/条目不存在:换一次请求也是同一个 404,没有自助出路
  resourceNotFound: 'none',
  // 服务端处理时抛错:瞬态居多,重发有意义
  runtimeException: 'retry',
  // 入口未注册:部署 / 配置面缺件,用户侧无法自救
  entrypointNotRegistered: 'contactAdmin',
  // 入口字段非法:EACCES / 命令不存在 —— 同上
  entrypointInvalid: 'contactAdmin',
  // 依赖模块缺失:装环境,不是用户能改的
  dependencyModuleMissing: 'contactAdmin',
  // 容量上限:413/429/超长。**默认查额度**,超长两码由下面的 override 改判 trimContext
  resourceLimitExceeded: 'checkQuota',
  // 环境初始化失败:缺运行时 / 缺密钥 / 服务未就绪
  environmentInitFailed: 'contactAdmin',
  // 已被停用:预期态而非故障,恢复动作是启用(用户侧 = 找管理员)
  disabled: 'contactAdmin',
  // 后端超时:等一等再发
  backendTimeout: 'retry',
  // 后端退出(连接被关闭 / 上游不可达):重发是标准出路
  backendExited: 'retry',
  // 能力未提供:当前模型/工具档不支持,换一个
  capabilityNotOffered: 'switchModel',
  // 崩溃(进程带非零码退出 / OOM):重发有意义,但连续两次就走 contactAdmin 由调用方决定
  backendCrashed: 'retry',
  // 协议协商失败:服务端已不支持当前客户端版本
  protocolMismatch: 'upgradeApp',
  // 授权失败:默认找管理员;令牌过期这一码由 override 改判 relogin
  authForbidden: 'contactAdmin',
  // 回包不合契约:同一请求重发必得同一份坏回包
  invalidResponse: 'none',
})

/**
 * 逐码 override:分类默认档答不了的那几格。
 * 每条都要能说出"为什么分类给不出正确答案",否则它该回到分类表里而不是在这里。
 */
const ACTION_OVERRIDES: Readonly<Record<string, StreamErrorAction>> = Object.freeze({
  // 令牌过期 = 用户点一下重新登录就能过,不需要惊动管理员
  TOKEN_EXPIRED: 'relogin',
  // 限频:等一会儿就好,与"额度用尽"是两回事(同一个 429,处置相反)
  RATE_LIMITED: 'waitAndRetry',
  // 预算按日重置:重试必然再撞,只能看额度 / 等次日
  BUDGET_EXHAUSTED: 'checkQuota',
  // 厂商通道欠费:换模型可绕过,同时要去看额度
  PROVIDER_QUOTA_EXHAUSTED: 'switchModel',
  // 试用额度到期:与预算同档
  TRIAL_QUOTA_EXCEEDED: 'checkQuota',
  // 上下文超长 / 单条超长:精简后可重发,原样重发必撞
  CONTEXT_TOO_LONG: 'trimContext',
  TEXT_TOO_LONG: 'trimContext',
  // 当前模型拒绝服务:换模型是唯一出路
  MODEL_REFUSED: 'switchModel',
  // 模型已下线 / 未配置:换模型
  MODEL_RETIRED: 'switchModel',
  MODEL_NOT_CONFIGURED: 'switchModel',
  PROVIDER_NOT_CONFIGURED: 'switchModel',
  // 工具档位不支持该模式:换档 / 换模型,重发无效
  TOOL_MODE_UNAVAILABLE: 'switchModel',
  // 账户被限制:用户自助救不回来
  ACCOUNT_RESTRICTED: 'contactAdmin',
})

/** 单条处置(全部字段都是键名或稳定 id,不含任何文案本体 —— 文案住词包)。 */
export interface StreamErrorDisposition {
  /** 后端产出的原始错误码(不改名、不归一:归一会让排障时 grep 不到) */
  readonly code: string
  /** 标题键:`ai.pane.errorCatalog` 内相对键,`t()` 直接用 */
  readonly titleKey: string
  /**
   * 该码的具体建议键(目录表给的,如"换模型"/"精简上下文");目录里没有 actionKey 时为
   * `undefined` —— 那时只有通用动作标签,不编造一句具体建议。
   */
  readonly detailKey?: string
  /** 可执行下一步(见 `STREAM_ERROR_ACTIONS`) */
  readonly action: StreamErrorAction
  /** `streamErrors` 内相对键:该动作的按钮 / 链接文案 */
  readonly actionLabelKey: string
  /** 是否可以再发一次同一请求。`retry` / `waitAndRetry` 之外一律 false */
  readonly retryable: boolean
  /** 分类(沿用 15 类分类学,供埋点/日志与 MCP 失败卡共用同一套语义) */
  readonly category: ViewFailureKind
}

/** 目录表条目 → 处置(纯函数;`code` 必须已确认在表内)。 */
function dispositionOf(code: string, entry: ErrorCatalogEntry): StreamErrorDisposition {
  const action = ACTION_OVERRIDES[code] ?? ACTION_BY_CATEGORY[entry.category]
  const base: Omit<StreamErrorDisposition, 'detailKey'> = {
    code,
    titleKey: entry.titleKey,
    action,
    actionLabelKey: streamErrorActionLabelKey(action),
    retryable: isRetryableAction(action),
    category: entry.category,
  }
  // 缺席 = 无键:不写 `detailKey: undefined` 把"没有具体建议"这一态顶掉
  return entry.actionKey ? { ...base, detailKey: entry.actionKey } : base
}

/**
 * 命名错误码 → 分类处置。未收录的码返回 `null`(调用方保持既有兜底,不得凭空造标题)。
 *
 * 三条输入口径:
 * - `undefined` / 空串 ⇒ null(没有码就没有分类,不猜);
 * - 表内但分类不在 15 类里 ⇒ null(目录表被写坏时宁可回落,也不拿错分类处置);
 * - 大小写不归一:目录表的键就是 wire 上的原样,归一会让 `file_not_ready` 与
 *   `FILE_NOT_READY` 两条真实并存的码撞在一起(它们在本仓确实并存)。
 */
export function resolveStreamErrorDisposition(
  code: string | undefined | null,
): StreamErrorDisposition | null {
  if (!code) return null
  const entry = resolveErrorCatalog(code)
  if (!entry) return null
  // 类型层面已保证 category 是 15 类之一;运行时再问一次是因为目录表是 `Record<string, …>`,
  // 有人手写一条 `category: 'unknown'` 时 tsc 只会报在那一行(若被 as 断言绕过就报不出来)。
  if (!(entry.category in ACTION_BY_CATEGORY)) return null
  return dispositionOf(code, entry)
}

/**
 * 是否"重试必然再撞"的一档(供 UI 决定隐藏重试按钮)。
 * 未收录的码返回 `null` = 未判定:调用方按既有行为处理,不得读成 false(那等于说"可以重试")。
 */
export function isRetryableErrorCode(code: string | undefined | null): boolean | null {
  const d = resolveStreamErrorDisposition(code)
  return d ? d.retryable : null
}

/**
 * 覆盖度自检:目录表里每一条都必须能给出处置(即分类都能在 `ACTION_BY_CATEGORY` 里找到)。
 * 返回未覆盖的码清单 —— 空数组才是全覆盖。供测试与只读体检用,不在运行时热路径上。
 */
export function uncoveredErrorCodes(): string[] {
  const missing: string[] = []
  for (const [code, entry] of Object.entries(ERROR_CODE_CATALOG)) {
    if (!(entry.category in ACTION_BY_CATEGORY)) missing.push(code)
  }
  return missing
}

export const __test__ = {
  ACTION_BY_CATEGORY,
  ACTION_OVERRIDES,
  dispositionOf,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
