// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 插件 / MCP 视图失败分类学(PROJECT_PLAN D92,对标 G-125)。
 *
 * 一张表三种信息:`错误码 → 分类标题键 → 建议动作键`,外加**始终可用**的统一恢复动作。
 *
 * 为什么落在 `packages/shared/src/utils/` 而不是新建 `src/errors/`:
 * `packages/shared/package.json` 的 `exports` 白名单只登记了 `./utils/*` 等子路径,
 * 新增 `./errors/*` 必须改 package.json(本任务禁止修改),否则端内 `@ihui/shared/errors/*`
 * 在 webpack `exports` 解析下直接 module not found。故复用既有 `./utils/*` 通道。
 *
 * **与 D71 共用一张表(PLAN 明令"不另起")的接口形状**:
 *   D71(Turn 错误分类族)不要新建映射表。它只需:
 *   1. 把后端 `errorCode` 原样塞进 `ViewFailureSignal.errorCode`
 *      (`packages/api-client` 的 `attachErrorMeta` 已在 Error 上挂了
 *       `name='SSEError' / code:number / errorCode:string / retryAfter:number`,
 *       本模块的 `readViewFailureSignal` 按这四个字段名直读,无需适配层);
 *   2. 调 `classifyViewFailure()` / `resolveViewFailure()` 拿 `ViewFailureResolution`;
 *   3. 需要新的对话流分类时,**在本文件的 `VIEW_FAILURE_ENTRIES` 追加条目**
 *      (并同步 `packages/i18n/messages/shared/*.json` 的 `viewFailure.<kind>.*` 五语言键),
 *      不得在 web 端内另建第二张私有表。
 *   分类学只产出**键名与判据**,不产出文案,因此同一张表可被 UI 面板与对话流卡共用。
 */

/** 视图所在生命周期阶段(分类的立项依据,也用于分类表自检)。 */
export type ViewFailureStage =
  | 'register'
  | 'activate'
  | 'install'
  | 'initialize'
  | 'configure'
  | 'connect'
  | 'request'
  | 'respond'
  | 'render'

export type ViewFailureKind =
  | 'resourceNotFound'
  | 'runtimeException'
  | 'entrypointNotRegistered'
  | 'entrypointInvalid'
  | 'dependencyModuleMissing'
  | 'resourceLimitExceeded'
  | 'environmentInitFailed'
  | 'disabled'
  | 'backendTimeout'
  | 'backendExited'
  | 'capabilityNotOffered'
  | 'backendCrashed'
  | 'protocolMismatch'
  | 'authForbidden'
  | 'invalidResponse'

/** 回落通用态:不属于 15 类,不得用它冒充任何一类的结论。 */
export const UNKNOWN_FAILURE_KIND = 'unknown' as const
export type ViewFailureKindOrUnknown = ViewFailureKind | typeof UNKNOWN_FAILURE_KIND

export interface ViewFailureEntry {
  kind: ViewFailureKindOrUnknown
  /** 稳定分类码(埋点 / 日志用,与 i18n 键解耦,永不改名)。 */
  code: string
  /** `viewFailure` 命名空间内的标题键(相对路径,供 `t()` 直接用)。 */
  titleKey: string
  /** `viewFailure` 命名空间内的建议动作键。 */
  actionKey: string
  /** 该分类真实对应的生命周期阶段(15 类立项依据,非装饰字段)。 */
  stage: ViewFailureStage
  /** 分类判据说明:为什么这一类在本项目真实存在(MCP / 插件视图生命周期)。 */
  lifecycleBasis: string
  isFallback: boolean
}

export const VIEW_FAILURE_NAMESPACE = 'viewFailure' as const
/** 统一恢复动作键:任何分类下都渲染,永不禁用。 */
export const VIEW_FAILURE_RELOAD_KEY = 'reloadView' as const
/** `错误码:{errorCode}` 标签键。 */
export const VIEW_FAILURE_ERROR_CODE_KEY = 'errorCodeLabel' as const

const entry = (
  kind: ViewFailureKind,
  stage: ViewFailureStage,
  lifecycleBasis: string,
): ViewFailureEntry => ({
  kind,
  code: kind.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toUpperCase(),
  titleKey: `${kind}.title`,
  actionKey: `${kind}.action`,
  stage,
  lifecycleBasis,
  isFallback: false,
})

/**
 * 15 类失败分类表(顺序即注册顺序,`unknown` 另置于 `VIEW_FAILURE_FALLBACK`)。
 * 每条都有真实生命周期根因,不凭空造类。
 */
export const VIEW_FAILURE_ENTRIES: readonly ViewFailureEntry[] = [
  entry(
    'resourceNotFound',
    'request',
    'MCP `resources/read` 对未列出的 uri 返回 -32002;REST 侧 404/ENOENT。视图按 uri 取资源是首要失败面。',
  ),
  entry(
    'runtimeException',
    'respond',
    '工具处理器 / 资源读取器在 server 内抛错,MCP 侧表现为 JSON-RPC -32603 internal error、REST 侧 500。',
  ),
  entry(
    'entrypointNotRegistered',
    'register',
    '插件视图声明了 view/container 但宿主未拿到启动入口(未注册 activation 或配置里缺该 server),面板连不上任何 server。',
  ),
  entry(
    'entrypointInvalid',
    'activate',
    '入口字段非法:stdio `command` 不可执行(EACCES / command not found)、`url` 非合法端点、transport 取值超出 `' +
      "'stdio'|'sse'|'http'" +
      '`。',
  ),
  entry(
    'dependencyModuleMissing',
    'install',
    'server 依赖的模块未提供:Node `MODULE_NOT_FOUND` / `cannot find module`、Python 侧缺包。装好主体但缺依赖是真实高频形态。',
  ),
  entry(
    'resourceLimitExceeded',
    'respond',
    '资源超限:413 payload 过大、429 频率超限、工具输出超出截断上限、上下文长度超限。',
  ),
  entry(
    'environmentInitFailed',
    'initialize',
    '环境初始化失败:MCP `initialize` 握手未完成即调用、缺运行时/缺密钥导致 server 起不来、REST 503 服务未就绪。',
  ),
  entry(
    'disabled',
    'configure',
    '已停用:`mcp_servers.status` 为断开/被禁用、市场项下架、管理员回收授权。属**预期态而非故障**,建议动作是启用而非重试。',
  ),
  entry(
    'backendTimeout',
    'request',
    '后端超时:AbortError/TimeoutError、408/504、ETIMEDOUT。与"已退出"分开,因为恢复动作不同(等待重试 vs 重新拉起)。',
  ),
  entry(
    'backendExited',
    'connect',
    '后端退出:stdio 子进程正常结束、SSE/HTTP 连接被关闭(ECONNREFUSED / socket hang up / EPIPE)、REST 502 上游不可达。',
  ),
  entry(
    'capabilityNotOffered',
    'request',
    '未提供所需能力:server 的 `capabilities` 未声明 resources/tools/prompts,调用落到 JSON-RPC -32601 method not found 或 501。',
  ),
  entry(
    'backendCrashed',
    'connect',
    '崩溃:子进程带非零码异常退出、SIGSEGV/SIGABRT、OOMKilled。与超时/正常退出三分,恢复要重建而非仅重连。',
  ),
  entry(
    'protocolMismatch',
    'initialize',
    '协议协商失败:`initialize` 的 `protocolVersion` 不被支持、客户端版本过低、-32600 形态的协议级无效请求。',
  ),
  entry(
    'authForbidden',
    'connect',
    '授权失败:401/403、token 过期或无效。MCP server 普遍带 bearer 凭据,过期是独立根因,动作是重新登录而非重载。',
  ),
  entry(
    'invalidResponse',
    'render',
    '响应无效:-32700 parse error、非法 JSON、Zod schema 校验失败,结果无法渲染(与"运行时异常"区别:server 没报错,是回包不合契约)。',
  ),
] as const

/** 通用回落态:未知错误码一律落此,只说"未能判定原因",不冒充任何一类。 */
export const VIEW_FAILURE_FALLBACK: ViewFailureEntry = {
  kind: UNKNOWN_FAILURE_KIND,
  code: 'UNKNOWN',
  titleKey: `${UNKNOWN_FAILURE_KIND}.title`,
  actionKey: `${UNKNOWN_FAILURE_KIND}.action`,
  stage: 'respond',
  lifecycleBasis: '判据穷尽仍无法归位 —— 必须回落通用态,严禁猜测具体原因(误报比不报更贵)。',
  isFallback: true,
}

export const VIEW_FAILURE_BY_KIND: Readonly<Record<ViewFailureKindOrUnknown, ViewFailureEntry>> =
  Object.freeze({
    ...Object.fromEntries(VIEW_FAILURE_ENTRIES.map((e) => [e.kind, e])),
    [UNKNOWN_FAILURE_KIND]: VIEW_FAILURE_FALLBACK,
  } as Record<ViewFailureKindOrUnknown, ViewFailureEntry>)

/** 归位来源:用于"是否真判出"的可观测性,回落必须记 fallback。 */
export type ViewFailureMatchedBy =
  'errorCode' | 'jsonRpcCode' | 'httpStatus' | 'errorName' | 'message' | 'fallback'

export interface ViewFailureSignal {
  /** 上游业务错误码(字符串),既接受分类码本身,也接受 `MCP_` 前缀形态。 */
  errorCode?: string
  /** JSON-RPC 错误码(MCP 走这条),或 REST HTTP 状态码。 */
  jsonRpcCode?: number
  httpStatus?: number
  /** Error.name(`AbortError` / `SSEError` / `TimeoutError` …)。 */
  errorName?: string
  /** Error.message 或响应文本,仅作兜底启发式判据。 */
  message?: string
}

export interface ViewFailureResolution {
  entry: ViewFailureEntry
  kind: ViewFailureKindOrUnknown
  titleKey: string
  actionKey: string
  /** 统一恢复动作键(始终可用)。 */
  reloadKey: typeof VIEW_FAILURE_RELOAD_KEY
  /** 展示给用户的 `错误码:{errorCode}` 值;无可信码时为 null(此时整行不渲染)。 */
  errorCodeText: string | null
  matchedBy: ViewFailureMatchedBy
  /** true = 回落通用态。UI 据此避免出现"确定性措辞"。 */
  isFallback: boolean
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null

const asString = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

const asFiniteNumber = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined

/** JSON-RPC 错误码带判定(MCP 回包用的就是这个负数段)。 */
export function isJsonRpcErrorBand(code: number | undefined): code is number {
  return code !== undefined && code <= -32000 && code >= -32999
}

/**
 * 从任意失败源读取分类信号(零 `any`,全走类型守卫)。
 * 兼容:`attachErrorMeta` 挂过字段的 Error、普通 Error、SSE/REST 的 json 对象、裸字符串、null。
 */
export function readViewFailureSignal(source: unknown): ViewFailureSignal {
  if (source === null || source === undefined) return {}
  if (typeof source === 'string') return { message: source }
  if (typeof source !== 'object') return {}

  const bag = source as Partial<ViewFailureSignal> & Record<string, unknown>
  const errorCode = asString(bag.errorCode) ?? asString(bag.bizCode)
  const errorName = asString(bag.name)
  const message = asString(bag.message) ?? asString(bag.error)

  const rpcRaw = asFiniteNumber(bag.jsonRpcCode) ?? asFiniteNumber(bag.code)
  // JSON-RPC 错误码带(MCP 走这条):-32700/-32600..-32603 标准码 + -32000..-32099 服务端码。
  // 落在此带外的一律按 HTTP 状态处理(如 500),避免把 -32601 当状态码去查 HTTP 表。
  const inJsonRpcBand = isJsonRpcErrorBand(rpcRaw)
  const jsonRpcCode = inJsonRpcBand ? rpcRaw : undefined
  const httpStatus =
    asFiniteNumber(bag.httpStatus) ??
    asFiniteNumber(bag.statusCode) ??
    asFiniteNumber(bag.status) ??
    (rpcRaw !== undefined && jsonRpcCode === undefined ? rpcRaw : undefined)

  return { errorCode, jsonRpcCode, httpStatus, errorName, message }
}

/** 分类码归一:`backend-timeout` / `backend_timeout` / `MCP_BACKEND_TIMEOUT` → `backend_timeout`。 */
function normalizeCode(raw: string): string {
  const bare = raw.replace(/^(MCP|VIEW|PLUGIN)_/i, '')
  return bare
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toUpperCase()
}

const CODE_INDEX: ReadonlyMap<string, ViewFailureKindOrUnknown> = new Map(
  [...VIEW_FAILURE_ENTRIES, VIEW_FAILURE_FALLBACK].flatMap((e) =>
    [e.kind, e.code, normalizeCode(e.kind), normalizeCode(e.code)].map(
      (k) => [k, e.kind] as [string, ViewFailureKindOrUnknown],
    ),
  ),
)

/** MCP JSON-RPC 码 → 分类(-32002 是 MCP `resources/read` 规范值,余为 JSON-RPC 标准值)。 */
const JSON_RPC_KIND: Readonly<Record<number, ViewFailureKind>> = Object.freeze({
  [-32700]: 'invalidResponse',
  [-32600]: 'protocolMismatch',
  [-32601]: 'capabilityNotOffered',
  [-32602]: 'invalidResponse',
  [-32603]: 'runtimeException',
  [-32002]: 'resourceNotFound',
})

const HTTP_KIND: Readonly<Record<number, ViewFailureKind>> = Object.freeze({
  401: 'authForbidden',
  403: 'authForbidden',
  404: 'resourceNotFound',
  405: 'capabilityNotOffered',
  408: 'backendTimeout',
  413: 'resourceLimitExceeded',
  429: 'resourceLimitExceeded',
  500: 'runtimeException',
  501: 'capabilityNotOffered',
  502: 'backendExited',
  503: 'environmentInitFailed',
  504: 'backendTimeout',
  505: 'protocolMismatch',
  507: 'resourceLimitExceeded',
})

const ERROR_NAME_KIND: Readonly<Record<string, ViewFailureKind>> = Object.freeze({
  AbortError: 'backendTimeout',
  TimeoutError: 'backendTimeout',
  NotFoundError: 'resourceNotFound',
  AuthenticationError: 'authForbidden',
  ForbiddenError: 'authForbidden',
  ConstraintError: 'resourceLimitExceeded',
})

/**
 * 文案启发式(最后一档):顺序即优先级,更具体的在前。
 * 例:`command not found` 必须早于 `not found`,否则入口无效会被误判成资源未找到。
 */
const MESSAGE_PATTERNS: ReadonlyArray<readonly [RegExp, ViewFailureKind]> = Object.freeze([
  [/timed?\s*out|timeout|etimedout|deadline_exceeded|超时|读取超时/i, 'backendTimeout'],
  [/aborterror|timeouterror/i, 'backendTimeout'],
  [/crash|sigsegv|sigabrt|core dumped|oomkilled|异常退出|崩溃/i, 'backendCrashed'],
  [
    /exited|exit code|econnrefused|socket hang up|epipe|connection (?:closed|reset|terminated)|上游不可达|连接已关闭/i,
    'backendExited',
  ],
  [/disabled|deactivated|revoked|已停用|被停用|停用状态|已禁用|未启用/i, 'disabled'],
  [/not registered|no activation|未注册|没有?启动入口|无激活入口/i, 'entrypointNotRegistered'],
  [
    /command not found|not executable|eacces|入口无效|invalid (?:entry|command|url)|transport 不合法/i,
    'entrypointInvalid',
  ],
  [
    /cannot find module|module_not_found|missing dependency|依赖模块|未提供所需模块|未安装/i,
    'dependencyModuleMissing',
  ],
  [
    /env(?:ironment)? (?:init|setup)|初始化失败|not initialized|服务未就绪|尚未就绪|init_failed/i,
    'environmentInitFailed',
  ],
  [
    /too large|size limit|payload|exceeds|超限|超出限制|too many requests|rate.?limit|context length/i,
    'resourceLimitExceeded',
  ],
  [
    /capabilit|not supported by (?:the )?server|未提供.{0,8}能力|不支持的?能力/i,
    'capabilityNotOffered',
  ],
  [
    /unauthorized|forbidden|permission denied|token (?:expired|invalid)|授权失败|无权限|登录已过期/i,
    'authForbidden',
  ],
  [
    /protocol\s*version|版本过低|version (?:not )?supported|协商失败|不兼容的?协议/i,
    'protocolMismatch',
  ],
  [
    /invalid json|json\.parse|解析失败|malformed|schema validation|校验失败|格式不合/i,
    'invalidResponse',
  ],
  [/not found|no such|404|enoent|未找到|不存在|已删除/i, 'resourceNotFound'],
  [/internal (?:server )?error|runtime error|内部错误|运行时异常/i, 'runtimeException'],
])

function kindOf(code: string | undefined): ViewFailureKindOrUnknown | undefined {
  return code === undefined ? undefined : CODE_INDEX.get(normalizeCode(code))
}

/**
 * 主判据:错误码 → 分类。**判不出必回落通用态并标记 `isFallback`,绝不猜类。**
 */
export function classifyViewFailure(signal: ViewFailureSignal): ViewFailureResolution {
  const attempts: ReadonlyArray<
    readonly [ViewFailureKindOrUnknown | undefined, ViewFailureMatchedBy]
  > = [
    [kindOf(signal.errorCode), 'errorCode'],
    [
      signal.jsonRpcCode === undefined
        ? undefined
        : (JSON_RPC_KIND[signal.jsonRpcCode] ??
          (isJsonRpcErrorBand(signal.jsonRpcCode) ? 'runtimeException' : undefined)),
      'jsonRpcCode',
    ],
    [signal.httpStatus === undefined ? undefined : HTTP_KIND[signal.httpStatus], 'httpStatus'],
    [signal.errorName === undefined ? undefined : ERROR_NAME_KIND[signal.errorName], 'errorName'],
    [
      signal.message === undefined
        ? undefined
        : MESSAGE_PATTERNS.find(([re]) => re.test(signal.message as string))?.[1],
      'message',
    ],
  ]

  for (const [kind, matchedBy] of attempts) {
    if (kind === undefined) continue
    const resolvedEntry = VIEW_FAILURE_BY_KIND[kind]
    return build(resolvedEntry, matchedBy, signal)
  }
  return build(VIEW_FAILURE_FALLBACK, 'fallback', signal)
}

function errorCodeTextOf(signal: ViewFailureSignal): string | null {
  if (signal.errorCode) return signal.errorCode
  if (signal.jsonRpcCode !== undefined) return String(signal.jsonRpcCode)
  if (signal.httpStatus !== undefined) return String(signal.httpStatus)
  return null
}

function build(
  resolvedEntry: ViewFailureEntry,
  matchedBy: ViewFailureMatchedBy,
  signal: ViewFailureSignal,
): ViewFailureResolution {
  return {
    entry: resolvedEntry,
    kind: resolvedEntry.kind,
    titleKey: resolvedEntry.titleKey,
    actionKey: resolvedEntry.actionKey,
    reloadKey: VIEW_FAILURE_RELOAD_KEY,
    // 回落态不给错误码行:没有可信码时写"错误码:undefined"就是误报。
    errorCodeText: resolvedEntry.isFallback ? null : errorCodeTextOf(signal),
    matchedBy,
    isFallback: resolvedEntry.isFallback,
  }
}

/** 便捷入口:任意失败源(unknown) → 分类结果。 */
export function resolveViewFailure(source: unknown): ViewFailureResolution {
  return classifyViewFailure(readViewFailureSignal(source))
}

/** 15 类全覆盖自检用(测试断言 `VIEW_FAILURE_ENTRIES.length === 15` 且 kind 唯一)。 */
export const VIEW_FAILURE_KINDS: readonly ViewFailureKind[] = VIEW_FAILURE_ENTRIES.map(
  (e) => e.kind as ViewFailureKind,
)
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
