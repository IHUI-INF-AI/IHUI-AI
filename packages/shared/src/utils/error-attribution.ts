// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-816012(2026-10-13 立):错误归因的唯一出口。
 *
 * 上游可抄的是**出口形状**,不是它的文本判据散布面(上游把 `message.includes(` 散在 40 处,
 * 那是反面教材):单个 evidence 模块 + 低基数 allowlist + 每条规则**原子返回**
 * `{errorSource, failureReason}` + 稳定 errno 表;未命中一律落 unknown 并**在返回值里报名**
 * (`attributed:false` + `ruleId:'unattributed'`)—— 禁止静默降级,更禁止默认归 provider
 * (默认归错档会把用户导向"再试一次",那是把配置缺失修成"重试就好")。
 *
 * 调用点纪律:端内**不得**再写 `.message.includes('…')` 自判成因 —— 那是在别处重算一遍归因,
 * 必然与本表漂移(同一错误在两处读成两档)。对账门:
 * `scripts/check-error-attribution-single-source.mjs`(判据① 生产面不得再出现该形态;
 * ② 调用点必须 import 本出口;③ 不同文本不得被读成重复规则)。
 *
 * 读取边界(写明,免得下一手以为它会走 cause 链):只读**顶层**三个字段 `name` / `message` /
 * `code`,非字符串一律视为缺席;不递归 `cause`。需要认 cause 链的场景得先在本表立档,
 * 不得在调用点绕开本出口自己扒链。
 *
 * 规则求值顺序:具体业务档(pg-uuid / config-missing / bulkhead)先于通用传输档 ——
 * 业务错误的文案里出现 "timeout" 这类通用词时,必须归它自己那一档。
 */

/** 错误来源档(封闭集,低基数)。未命中一律 unknown —— 禁止默认归 provider/任何具体档。 */
export type ErrorSource = 'transport' | 'storage' | 'config' | 'capacity' | 'unknown'

/**
 * 失败原因档(封闭集,低基数)。
 * `unattributed` 只由"未命中报名"那条兜底产生,**规则表不得产出它** ——
 * 规则产出了它就等于有一条规则在自己头上挂"我没判"。
 */
export type FailureReason =
  | 'timeout'
  | 'network'
  | 'executable-busy'
  | 'invalid-identifier'
  | 'not-configured'
  | 'concurrency-limit'
  | 'unattributed'

export interface ErrorAttribution {
  errorSource: ErrorSource
  failureReason: FailureReason
  /** 命中的规则 id;未命中 = {@link UNATTRIBUTED_RULE_ID}。两条不同文本是两条规则,不得并成一条。 */
  ruleId: string
  /** false = 未命中(已在返回值里显式报名)。调用点不得把 unknown 当具体档用。 */
  attributed: boolean
}

/** 未命中报名位:返回值里出现它 = "这一档还没立规则" —— 要立档,不是可以忽略。 */
export const UNATTRIBUTED_RULE_ID = 'unattributed'

/** 稳定 errno 表(上游 STABLE_TRANSPORT_ERROR_CODES 的我方版,按档分组):新增 errno 只许进这两张表。 */
const TIMEOUT_ERRNOS = ['ETIMEDOUT', 'ESOCKETTIMEDOUT'] as const
const EXECUTABLE_BUSY_ERRNOS = ['ETXTBSY', 'ENOEXEC'] as const
const NETWORK_ERRNOS = [
  'EAI_AGAIN',
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTDOWN',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ENOTFOUND',
  'EPIPE',
] as const

interface AttributionRule {
  id: string
  /** message 文本 allowlist(精确子串,大小写敏感)—— 低基数:一档一句,不收样本腔。 */
  needles?: readonly string[]
  /** error.code(ErrnoException.code)allowlist —— 只认顶层 code,不走 cause 链。 */
  errnos?: readonly string[]
  /** error.name allowlist(如 AbortError)。 */
  names?: readonly string[]
  /** 每条规则**原子返回**完整归因:调用点不得只取一半再自己补另一半。 */
  resolve: () => { errorSource: ErrorSource; failureReason: FailureReason }
}

const RULES: readonly AttributionRule[] = [
  {
    // PG 22P02:id 非合法 uuid ⇒ 等价"未找到"(apps/api/routes/agent-creation.ts 的 404 档)
    id: 'storage.pg-uuid-syntax',
    needles: ['invalid input syntax for type uuid'],
    resolve: () => ({ errorSource: 'storage', failureReason: 'invalid-identifier' }),
  },
  {
    // 配置缺失(apps/api coze-oauth 等):400 档,不是 500,更不是"再试一次"
    id: 'config.missing',
    needles: ['未配置'],
    resolve: () => ({ errorSource: 'config', failureReason: 'not-configured' }),
  },
  {
    // 并发上限拒绝(apps/api under-pressure bulkhead)
    id: 'capacity.bulkhead',
    needles: ['Bulkhead rejected'],
    resolve: () => ({ errorSource: 'capacity', failureReason: 'concurrency-limit' }),
  },
  {
    id: 'transport.abort',
    names: ['AbortError', 'TimeoutError'],
    resolve: () => ({ errorSource: 'transport', failureReason: 'timeout' }),
  },
  {
    // 中英两个 needle 是同一档的两个载体(旧站点 im-outbound-policy 两侧都判),不是两条规则
    id: 'transport.timeout',
    errnos: TIMEOUT_ERRNOS,
    needles: ['超时', 'timeout'],
    resolve: () => ({ errorSource: 'transport', failureReason: 'timeout' }),
  },
  {
    // ETXTBSY 是 Linux 特有;Node 把它映射成 ENOEXEC 或把码写进消息(spawn-isolated 重试档)
    id: 'transport.executable-busy',
    errnos: EXECUTABLE_BUSY_ERRNOS,
    needles: ['ETXTBSY'],
    resolve: () => ({ errorSource: 'transport', failureReason: 'executable-busy' }),
  },
  {
    id: 'transport.network',
    errnos: NETWORK_ERRNOS,
    needles: ['ECONNREFUSED', 'fetch failed'],
    resolve: () => ({ errorSource: 'transport', failureReason: 'network' }),
  },
]

/** 规则 id 有序表(只读快照,给测试与对账用;不是第二份规则表 —— 它派生自 RULES)。 */
export const ERROR_ATTRIBUTION_RULE_IDS: readonly string[] = Object.freeze(RULES.map((r) => r.id))

export interface AttributionRuleInfo {
  readonly id: string
  readonly needles: readonly string[]
  readonly errnos: readonly string[]
  readonly names: readonly string[]
  readonly errorSource: ErrorSource
  readonly failureReason: FailureReason
}

/**
 * 规则表现读(每条规则原子求值一次)。给"低基数 / 无重复 needle"这类**结构断言**用:
 * 两条规则共享同一 needle ⇒ 第二条永远不可达,那是重复规则,必须被测出来而不是被注释掉。
 */
export function listAttributionRules(): readonly AttributionRuleInfo[] {
  return RULES.map((rule) => {
    const { errorSource, failureReason } = rule.resolve()
    return Object.freeze({
      id: rule.id,
      needles: Object.freeze([...(rule.needles ?? [])]),
      errnos: Object.freeze([...(rule.errnos ?? [])]),
      names: Object.freeze([...(rule.names ?? [])]),
      errorSource,
      failureReason,
    })
  })
}

/** 顶层三字段的形状提取:非对象 / 非字符串一律视为缺席(不递归 cause,不猜)。 */
function readShape(err: unknown): { name: string | null; message: string | null; code: string | null } {
  if (err === null || typeof err !== 'object') return { name: null, message: null, code: null }
  const o = err as { name?: unknown; message?: unknown; code?: unknown }
  return {
    name: typeof o.name === 'string' ? o.name : null,
    message: typeof o.message === 'string' ? o.message : null,
    code: typeof o.code === 'string' ? o.code : null,
  }
}

/**
 * 错误 → `{errorSource, failureReason}` 的唯一归因出口。
 *
 * 命中:首条规则胜出,连同 `ruleId` 一起原子返回;
 * 未命中:**落 unknown 并报名** —— `failureReason:'unattributed'` + `ruleId:'unattributed'`
 * + `attributed:false` 三个位同时给出,任何一位被摘掉都算静默降级(测试钉着)。
 */
export function attributeError(err: unknown): ErrorAttribution {
  const shape = readShape(err)
  for (const rule of RULES) {
    const hitName = shape.name !== null && rule.names !== undefined && rule.names.includes(shape.name)
    const hitCode = shape.code !== null && rule.errnos !== undefined && rule.errnos.includes(shape.code)
    const hitText =
      shape.message !== null &&
      rule.needles !== undefined &&
      rule.needles.some((needle) => shape.message!.includes(needle))
    if (hitName || hitCode || hitText) {
      return { ...rule.resolve(), ruleId: rule.id, attributed: true }
    }
  }
  return {
    errorSource: 'unknown',
    failureReason: 'unattributed',
    ruleId: UNATTRIBUTED_RULE_ID,
    attributed: false,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
