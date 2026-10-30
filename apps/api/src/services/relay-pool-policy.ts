// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 账号池选号策略单一真相源(2026-10-29 立,台账票 O93,对标竞品
 * workbuddy2api-panel 的 `pool.*` 配置块)。
 *
 * 纯判据层,零 IO:不碰数据库、不碰 Redis、不打日志、不发网络。消费方两处 =
 * relay-account-forwarder.ts(选号管线 + 全局并发闸取钮值)、admin 只读端点
 * GET /api/admin/relay/pool-policy(经 relayPoolPolicyView 把八枚钮的生效档/默认档
 * 摊给运维看;只读,不提供写钮)。镜像测试
 * (tests/relay-pool-policy.test.ts + tests/relay-pool-policy-view.test.ts)经
 * `__test__` 直接用本实现钉死判据(§22c 禁复制第二份判据/常量,§0.6 单一真相源)。
 *
 * 六项能力(默认值全部保持既有行为语义,旋钮经 env 显式开启):
 * 1. strategy: 'deterministic'(默认,priority asc → 有效权重 desc → 最久未用 asc,
 *    与改造前的确定性排序同族)| 'weighted_random'(按有效权重无放回加权抽样;
 *    rng 可注入 ⇒ 测试可复现)
 * 2. 闲置加权 idleWeightPerHour/idleWeightMax:lastUsedAt 距今年数小时 × perHour,
 *    封顶 max(从未用过 ⇒ 直接按封顶计,与旧序「未用优先」同向)
 * 3. preferExpiring + expiringSoonMs:开启后同优先级内「窗口内将到期」的号排前
 *    (临期票先消耗,降低整池集体过期的轮换断档)
 * 4. creditFloor:按号行 extraMetadata 的数值积分过滤(取值键序 =
 *    creditRemaining → credit → balanceCents,首个有限数生效;账号池表无
 *    balanceCents 列 —— 该列在 key_pool,这里只读 jsonb,不加迁移)。
 *    无积分信息的行「判不了 ⇒ 保留」;过滤会把候选清空 ⇒ 回落未过滤集并记
 *    fallback 标签(§0.3/§0.10:失效方向恒为"多留一份",绝不静默清零)。
 * 5. maxInFlightGlobal:全局在途并发上限的**钮值**(闸本体住在
 *    relay-account-shared-state.ts 的 tryAcquireGlobalInflight,Redis INCR/DECR +
 *    内存兜底;本模块只供读取默认值与 env 解析,不持计数)。
 * 6. crossDomainFallback:域 = 号行 realm。号池表**无 realm/domain 列**(不造列、
 *    不加迁移),判据实读 `providerCode === 'workbuddy'` 行的
 *    `extraMetadata.domain`(经 workbuddy-protocol.resolveRealm 单源换算,
 *    workbuddy-adapter 选上游基址用的就是同一把尺子);trae/codearts/qoder 行无
 *    域概念 ⇒ 过滤恒放行。「请求域」的取材 = 会话亲和命中账号所在域(亲和是
 *    唯一的会话域信号源);无亲和或账号无域 ⇒ 不做域过滤。过滤清空 ⇒ 回落全域
 *    并记标签(同第 4 条永不排空纪律)。
 *
 * 所有默认数字只住本文件 DEFAULT_RELAY_POOL_POLICY 一处;env 前缀
 * IHUI_RELAY_POOL_*(与既有 IHUI_RELAY_ACCOUNT_MAX_INFLIGHT 同族风格)。
 * 非法 env 值一律回落默认(失效方向 = 维持既有行为,绝不因配置脏而改选号)。
 */
import { resolveRealm } from './upstream-adapters/workbuddy-protocol.js'

// =============================================================================
// 策略类型与默认值(env 钮名与 §22d 出口)
// =============================================================================

export type RelayPoolStrategy = 'deterministic' | 'weighted_random'

export interface RelayPoolPolicy {
  /** 选号策略:确定性排序(默认)或有效权重加权随机 */
  strategy: RelayPoolStrategy
  /** 闲置加权:每闲置 1 小时加的分(<=0 关闭加权) */
  idleWeightPerHour: number
  /** 闲置加权封顶(小时数再大也不无限抬分) */
  idleWeightMax: number
  /** 是否让「窗口内将到期」的号在同优先级内排前 */
  preferExpiring: boolean
  /** 「临期」窗口(毫秒) */
  expiringSoonMs: number
  /** 积分地板(<=0 = 关闭过滤;号无积分信息一律保留) */
  creditFloor: number
  /** 全局在途并发上限(<=0 = 关闭闸;消费方 = shared-state 的闸) */
  maxInFlightGlobal: number
  /** 跨域互兜(仅对有域概念的 provider 生效;清空即回落全域) */
  crossDomainFallback: boolean
}

/** 一小时毫秒数(闲置小时与临期窗口的换算基数,单源于此) */
export const HOUR_MS = 3_600_000

export const DEFAULT_RELAY_POOL_POLICY: RelayPoolPolicy = {
  strategy: 'deterministic',
  idleWeightPerHour: 0.5,
  idleWeightMax: 5,
  preferExpiring: false,
  expiringSoonMs: 168 * HOUR_MS,
  creditFloor: 0,
  maxInFlightGlobal: 0,
  crossDomainFallback: false,
}

/** env 钮名登记表(测试与文档以此为准;实现只认这些键) */
export const RELAY_POOL_ENV_KEYS = {
  strategy: 'IHUI_RELAY_POOL_STRATEGY',
  idleWeightPerHour: 'IHUI_RELAY_POOL_IDLE_WEIGHT_PER_HOUR',
  idleWeightMax: 'IHUI_RELAY_POOL_IDLE_WEIGHT_MAX',
  preferExpiring: 'IHUI_RELAY_POOL_PREFER_EXPIRING',
  expiringSoonMs: 'IHUI_RELAY_POOL_EXPIRING_SOON_MS',
  creditFloor: 'IHUI_RELAY_POOL_CREDIT_FLOOR',
  maxInFlightGlobal: 'IHUI_RELAY_POOL_MAX_IN_FLIGHT_GLOBAL',
  crossDomainFallback: 'IHUI_RELAY_POOL_CROSS_DOMAIN_FALLBACK',
} as const

type EnvLike = Record<string, string | undefined>

/**
 * env 解析结果:`invalid` = 该钮在 env 里写了**非空但代码认不出**的值,已回落默认。
 * 只有一条判序(§0.6):numEnv/boolEnv/strategyEnv 与只读视图都取这里的 value,
 * 绝不允许"读的那套认、看的那套不认"。
 */
interface KnobResolution<T> {
  value: T
  invalid: boolean
}

function resolveNumEnv(raw: string | undefined, def: number): KnobResolution<number> {
  if (raw === undefined || raw.trim() === '') return { value: def, invalid: false }
  const n = Number(raw)
  // 非有限/负数 = 脏值 ⇒ 回落默认(0 是合法值,含义为"关闭")
  if (!Number.isFinite(n) || n < 0) return { value: def, invalid: true }
  return { value: n, invalid: false }
}

function resolveBoolEnv(raw: string | undefined, def: boolean): KnobResolution<boolean> {
  if (raw === undefined || raw.trim() === '') return { value: def, invalid: false }
  const t = raw.trim().toLowerCase()
  if (t === '1' || t === 'true' || t === 'yes' || t === 'on') return { value: true, invalid: false }
  if (t === '0' || t === 'false' || t === 'no' || t === 'off') {
    return { value: false, invalid: false }
  }
  return { value: def, invalid: true }
}

function resolveStrategyEnv(
  raw: string | undefined,
  def: RelayPoolStrategy,
): KnobResolution<RelayPoolStrategy> {
  const t = (raw ?? '').trim().toLowerCase()
  if (t === '') return { value: def, invalid: false }
  if (t === 'weighted_random' || t === 'deterministic') return { value: t, invalid: false }
  return { value: def, invalid: true }
}

function numEnv(raw: string | undefined, def: number): number {
  return resolveNumEnv(raw, def).value
}

function boolEnv(raw: string | undefined, def: boolean): boolean {
  return resolveBoolEnv(raw, def).value
}

function strategyEnv(raw: string | undefined, def: RelayPoolStrategy): RelayPoolStrategy {
  return resolveStrategyEnv(raw, def).value
}

/** 读 env 装配策略(纯函数:env 作参数注入,不摸全局 ⇒ 测试无需 stubEnv) */
export function readRelayPoolPolicy(env: EnvLike = process.env): RelayPoolPolicy {
  return {
    strategy: strategyEnv(env[RELAY_POOL_ENV_KEYS.strategy], DEFAULT_RELAY_POOL_POLICY.strategy),
    idleWeightPerHour: numEnv(
      env[RELAY_POOL_ENV_KEYS.idleWeightPerHour],
      DEFAULT_RELAY_POOL_POLICY.idleWeightPerHour,
    ),
    idleWeightMax: numEnv(
      env[RELAY_POOL_ENV_KEYS.idleWeightMax],
      DEFAULT_RELAY_POOL_POLICY.idleWeightMax,
    ),
    preferExpiring: boolEnv(
      env[RELAY_POOL_ENV_KEYS.preferExpiring],
      DEFAULT_RELAY_POOL_POLICY.preferExpiring,
    ),
    expiringSoonMs: numEnv(
      env[RELAY_POOL_ENV_KEYS.expiringSoonMs],
      DEFAULT_RELAY_POOL_POLICY.expiringSoonMs,
    ),
    creditFloor: numEnv(
      env[RELAY_POOL_ENV_KEYS.creditFloor],
      DEFAULT_RELAY_POOL_POLICY.creditFloor,
    ),
    maxInFlightGlobal: numEnv(
      env[RELAY_POOL_ENV_KEYS.maxInFlightGlobal],
      DEFAULT_RELAY_POOL_POLICY.maxInFlightGlobal,
    ),
    crossDomainFallback: boolEnv(
      env[RELAY_POOL_ENV_KEYS.crossDomainFallback],
      DEFAULT_RELAY_POOL_POLICY.crossDomainFallback,
    ),
  }
}

// =============================================================================
// 只读视图(面板/排障用;立因@2026-10-29:这八枚钮此前只活在代码里,
// .env.example 零命中 ⇒ 换机/排障无从发现,运维在面板上也看不到当前生效档位)
// =============================================================================

/** 钮值类型(与 RelayPoolPolicy 的取值域一致,禁 any) */
export type RelayPoolKnobValue = number | boolean | RelayPoolStrategy

/** 钮的种类(决定走哪一把 env 解析尺) */
export type RelayPoolKnobKind = 'number' | 'boolean' | 'strategy'

/** 登记表条目:env 钮名/策略键名/种类/一句话语义(面板 tooltip 单源) */
export interface RelayPoolKnobSpec {
  name: keyof RelayPoolPolicy
  envKey: string
  kind: RelayPoolKnobKind
  description: string
}

/**
 * 八枚钮的登记表。**新增钮必须同笔在这里登记**,否则 relayPoolPolicyView 的
 * registryComplete 翻 false(relay-pool-policy-view.test.ts 钉住"登记表键集 ==
 * DEFAULT_RELAY_POOL_POLICY 键集 == RELAY_POOL_ENV_KEYS 值集"三方对账)——
 * 这一格是"钮只活在代码里、面板看不见"这个失效方向的封口。
 */
export const RELAY_POOL_KNOB_SPECS: readonly RelayPoolKnobSpec[] = [
  {
    name: 'strategy',
    envKey: RELAY_POOL_ENV_KEYS.strategy,
    kind: 'strategy',
    description:
      '选号策略:deterministic(默认,priority asc → 有效权重 desc → 最久未用 asc)/ weighted_random(按有效权重无放回抽样)',
  },
  {
    name: 'idleWeightPerHour',
    envKey: RELAY_POOL_ENV_KEYS.idleWeightPerHour,
    kind: 'number',
    description: '闲置加权:每闲置 1 小时加的分(<=0 = 关闭加权)',
  },
  {
    name: 'idleWeightMax',
    envKey: RELAY_POOL_ENV_KEYS.idleWeightMax,
    kind: 'number',
    description: '闲置加权封顶分(闲置再久也不无限抬分)',
  },
  {
    name: 'preferExpiring',
    envKey: RELAY_POOL_ENV_KEYS.preferExpiring,
    kind: 'boolean',
    description: '同优先级内让「窗口内将到期」的号排前(临期票先消耗,降低整池集体过期断档)',
  },
  {
    name: 'expiringSoonMs',
    envKey: RELAY_POOL_ENV_KEYS.expiringSoonMs,
    kind: 'number',
    description: '「临期」窗口(毫秒,默认 168 小时 = 604800000)',
  },
  {
    name: 'creditFloor',
    envKey: RELAY_POOL_ENV_KEYS.creditFloor,
    kind: 'number',
    description: '积分地板(<=0 = 关闭过滤;读不到积分信息的号一律保留,滤空即回落全集)',
  },
  {
    name: 'maxInFlightGlobal',
    envKey: RELAY_POOL_ENV_KEYS.maxInFlightGlobal,
    kind: 'number',
    description: '全局在途并发上限钮值(<=0 = 关闭闸;闸本体住 relay-account-shared-state)',
  },
  {
    name: 'crossDomainFallback',
    envKey: RELAY_POOL_ENV_KEYS.crossDomainFallback,
    kind: 'boolean',
    description: '跨域互兜(仅对有域概念的 workbuddy 行生效;过滤清空即回落全域并记标签)',
  },
]

/** 单枚钮的可展示面 */
export interface RelayPoolKnobView {
  /** 策略字段名(camelCase,与 RelayPoolPolicy 的键逐字同源) */
  name: keyof RelayPoolPolicy
  /** env 钮名(与 RELAY_POOL_ENV_KEYS 的值逐字同源) */
  envKey: string
  kind: RelayPoolKnobKind
  /** 当前生效值 = readRelayPoolPolicy 读出的那一档(与消费方同一把尺,零复算) */
  effective: RelayPoolKnobValue
  /** 默认档值(DEFAULT_RELAY_POOL_POLICY 单源) */
  defaultValue: RelayPoolKnobValue
  /** 生效值 ≠ 默认值(即"这枚钮被 env 改过且被代码认出") */
  differsFromDefault: boolean
  /** env 原文:undefined = 环境里没这个键;空白串 = 设了空值 ⇒ 两种都算走默认档 */
  rawEnv: string | undefined
  /** rawEnv 非空但代码认不出 ⇒ 已回落默认并在此点名(§0.3:脏值绝不冒充合法档) */
  invalidEnv: boolean
  /** 一句话语义(面板/日志直接展示,不在调用方另写一份) */
  description: string
}

/** 八枚钮 + 对账结论的整档视图 */
export interface RelayPoolPolicyView {
  /** 按 RELAY_POOL_KNOB_SPECS 顺序逐枚展开 */
  knobs: RelayPoolKnobView[]
  /** 生效策略整档(与 readRelayPoolPolicy(env) 逐键等值) */
  policy: RelayPoolPolicy
  /** 登记表键集 ⇄ 策略键集 ⇄ env 钮名集三方对账结论 */
  registryComplete: boolean
  /** 策略里有、登记表没登记 ⇒ 面板读不到的钮(必须显式点名,不得当成"没有这一钮") */
  missingKnobs: string[]
  /** 登记表里有、策略里没有的钮名(没有默认档可比 ⇒ 不进 knobs) */
  orphanKnobs: string[]
  /** 偏离默认档的钮数 */
  deviatedKnobs: number
  /** env 写了脏值而回落默认的钮数(>0 ⇒ 有人在 .env 里写了代码认不出的形态) */
  invalidEnvKnobs: number
  /** true = 生效档与 DEFAULT_RELAY_POOL_POLICY 逐键等值(既有确定性选号行为,未开任何新能力) */
  allDefault: boolean
}

function resolveKnobEnv(
  kind: RelayPoolKnobKind,
  raw: string | undefined,
  def: RelayPoolKnobValue,
): KnobResolution<RelayPoolKnobValue> {
  if (kind === 'number') return resolveNumEnv(raw, def as number)
  if (kind === 'boolean') return resolveBoolEnv(raw, def as boolean)
  return resolveStrategyEnv(raw, def as RelayPoolStrategy)
}

/**
 * 把八枚钮输出成可展示结构(纯函数、零 IO:env 作参数注入,默认 process.env;
 * 不摸时钟、不摸数据库、不发网络)。
 * effective 一律取 readRelayPoolPolicy 的结果(消费方真正读到的那一档),invalid
 * 一律取同一批 resolve* 原语 ⇒ 视图与选号行为结构上不可能分叉。
 */
export function relayPoolPolicyView(env: EnvLike = process.env): RelayPoolPolicyView {
  const policy = readRelayPoolPolicy(env)
  const policyKeys = Object.keys(DEFAULT_RELAY_POOL_POLICY) as (keyof RelayPoolPolicy)[]
  const specNames = new Set<string>(RELAY_POOL_KNOB_SPECS.map((s) => s.name))
  const missingKnobs = policyKeys.filter((k) => !specNames.has(k))
  const orphanKnobs = RELAY_POOL_KNOB_SPECS.map((s) => s.name).filter(
    (k) => !policyKeys.includes(k),
  )
  const knobs: RelayPoolKnobView[] = []
  for (const spec of RELAY_POOL_KNOB_SPECS) {
    if (!policyKeys.includes(spec.name)) continue
    const raw = env[spec.envKey]
    const def = DEFAULT_RELAY_POOL_POLICY[spec.name]
    const res = resolveKnobEnv(spec.kind, raw, def)
    const effective = policy[spec.name]
    knobs.push({
      name: spec.name,
      envKey: spec.envKey,
      kind: spec.kind,
      effective,
      defaultValue: def,
      differsFromDefault: effective !== def,
      rawEnv: raw,
      invalidEnv: res.invalid,
      description: spec.description,
    })
  }
  const deviatedKnobs = knobs.filter((k) => k.differsFromDefault).length
  const invalidEnvKnobs = knobs.filter((k) => k.invalidEnv).length
  return {
    knobs,
    policy,
    registryComplete: missingKnobs.length === 0 && orphanKnobs.length === 0,
    missingKnobs,
    orphanKnobs,
    deviatedKnobs,
    invalidEnvKnobs,
    allDefault: deviatedKnobs === 0,
  }
}

// =============================================================================
// 候选行形状(结构化最小面:db 行 AiRelayAccountPool 天然满足,测试夹具零 mock)
// =============================================================================

export interface PoolCandidateRow {
  id: string
  providerCode: string
  /** 越小越优先(0 = 最高) */
  priority: number
  /** 基础权重 */
  weight: number
  lastUsedAt: Date | null
  tokenExpiresAt: Date | null
  /** jsonb 明文元数据(积分/域信息住这里;非对象一律按"无信息"处理) */
  extraMetadata?: unknown
}

// =============================================================================
// extraMetadata 读取(判不了 ⇒ 保留/放行,永不因数据脏而排空候选)
// =============================================================================

function metaObject(raw: unknown): Record<string, unknown> | null {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  return null
}

function finiteNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** 积分取值键序(首个命中有限数生效);全不命中 ⇒ null = 判不了 */
const CREDIT_META_KEYS = ['creditRemaining', 'credit', 'balanceCents'] as const

export function creditOfRow(row: PoolCandidateRow): number | null {
  const meta = metaObject(row.extraMetadata)
  if (!meta) return null
  for (const key of CREDIT_META_KEYS) {
    const n = finiteNumber(meta[key])
    if (n !== null) return n
  }
  return null
}

/**
 * 号行的域键(跨域互兜的取材)。
 * 仅 workbuddy 行有域概念:extraMetadata.domain 经 resolveRealm 单源换算
 * ('workbuddy.ai'/*.workbuddy.ai → 'global';缺失/其他 → 'cn',与适配器选
 * 上游基址同一把尺子)。其他 provider ⇒ null(无域,域过滤恒放行)。
 */
export function domainKeyOfRow(row: PoolCandidateRow): 'cn' | 'global' | null {
  if (row.providerCode !== 'workbuddy') return null
  const meta = metaObject(row.extraMetadata)
  const domain = typeof meta?.domain === 'string' ? meta.domain : ''
  return resolveRealm(domain)
}

// =============================================================================
// 打分
// =============================================================================

/** 闲置小时数(null = 从未用过 ⇒ Infinity,由封顶收敛) */
export function idleHoursOf(row: PoolCandidateRow, nowMs: number): number {
  if (!row.lastUsedAt) return Number.POSITIVE_INFINITY
  return Math.max(0, (nowMs - row.lastUsedAt.getTime()) / HOUR_MS)
}

/** 闲置加分:min(闲置小时 × perHour, max);perHour<=0 ⇒ 0(关闭) */
export function idleBonusOf(row: PoolCandidateRow, nowMs: number, policy: RelayPoolPolicy): number {
  if (policy.idleWeightPerHour <= 0) return 0
  const hours = idleHoursOf(row, nowMs)
  const raw = hours * policy.idleWeightPerHour
  return Math.min(Number.isFinite(raw) ? raw : policy.idleWeightMax, policy.idleWeightMax)
}

/** 是否「窗口内将到期」(含已过期;无到期时刻 ⇒ 判不了 ⇒ 不算临期) */
export function isExpiringSoon(
  row: PoolCandidateRow,
  nowMs: number,
  policy: RelayPoolPolicy,
): boolean {
  if (!row.tokenExpiresAt) return false
  return row.tokenExpiresAt.getTime() - nowMs <= policy.expiringSoonMs
}

/** 有效权重 = max(基础权重, 0) + 闲置加分(加权随机与确定性排序共用这一把尺) */
export function effectiveWeightOf(
  row: PoolCandidateRow,
  nowMs: number,
  policy: RelayPoolPolicy,
): number {
  return Math.max(0, row.weight) + idleBonusOf(row, nowMs, policy)
}

// =============================================================================
// 排序(两种策略)
// =============================================================================

/**
 * 确定性排序:priority asc → [preferExpiring 时临期先] → 有效权重 desc → 最久未用 asc。
 * preferExpiring 关 + perHour 供 0 ⇒ 逐字还原改造前的 weight desc + lastUsedAt asc 序。
 */
export function orderDeterministic<T extends PoolCandidateRow>(
  rows: T[],
  nowMs: number,
  policy: RelayPoolPolicy,
): T[] {
  return [...rows].sort((a, b) => {
    const byPriority = a.priority - b.priority
    if (byPriority !== 0) return byPriority
    if (policy.preferExpiring) {
      const byExpiring =
        (isExpiringSoon(a, nowMs, policy) ? 0 : 1) - (isExpiringSoon(b, nowMs, policy) ? 0 : 1)
      if (byExpiring !== 0) return byExpiring
    }
    const byScore = effectiveWeightOf(b, nowMs, policy) - effectiveWeightOf(a, nowMs, policy)
    if (byScore !== 0) return byScore
    return (a.lastUsedAt?.getTime() ?? 0) - (b.lastUsedAt?.getTime() ?? 0)
  })
}

/**
 * 加权随机(无放回抽样到全序):每轮按有效权重抽一枚,抽完移除。
 * rng 注入 ⇒ 测试可用种子序列复现;rng 产出脏值(NaN/越界)⇒ 按 0 处理(取首个
 * 累计覆盖点,失效方向是"仍产出一个全序",绝不空手而归)。
 * 总权重 <= 0(全零权 + 加权关)⇒ 回落确定性排序(候选一枚都不能丢)。
 */
export function orderWeighted<T extends PoolCandidateRow>(
  rows: T[],
  nowMs: number,
  policy: RelayPoolPolicy,
  rng: () => number,
): T[] {
  const total = rows.reduce((sum, r) => sum + effectiveWeightOf(r, nowMs, policy), 0)
  if (!(total > 0)) return orderDeterministic(rows, nowMs, policy)
  const pool = [...rows]
  const out: T[] = []
  let weightSum = total
  while (pool.length > 0) {
    const rollRaw = rng()
    const roll = Number.isFinite(rollRaw) && rollRaw >= 0 && rollRaw < 1 ? rollRaw : 0
    let pick = roll * weightSum
    let idx = pool.length - 1
    for (let i = 0; i < pool.length; i++) {
      const row = pool[i]
      if (!row) continue
      const w = effectiveWeightOf(row, nowMs, policy)
      if (pick < w) {
        idx = i
        break
      }
      pick -= w
    }
    const chosen = pool.splice(idx, 1)[0]
    if (chosen) out.push(chosen)
    weightSum = Math.max(
      0,
      weightSum - (chosen ? Math.max(0, chosen.weight) + idleBonusOf(chosen, nowMs, policy) : 0),
    )
  }
  return out
}

// =============================================================================
// 过滤(credit_floor / cross_domain;两者都受"永不排空"纪律约束)
// =============================================================================

export interface FilterOutcome<T> {
  rows: T[]
  /** true = 过滤会把候选清空,已回落未过滤集(调用方须把这一事实记进日志/结论) */
  fallbackApplied: boolean
}

/** 积分地板过滤:地板<=0 关闭;行无积分信息(判不了)保留;清空 ⇒ 回落全集 */
export function filterCreditFloor<T extends PoolCandidateRow>(
  rows: T[],
  floor: number,
): FilterOutcome<T> {
  if (!(floor > 0)) return { rows, fallbackApplied: false }
  const kept = rows.filter((r) => {
    const credit = creditOfRow(r)
    return credit === null || credit >= floor
  })
  if (kept.length > 0) return { rows: kept, fallbackApplied: false }
  return { rows, fallbackApplied: rows.length > 0 }
}

/** 域过滤:requestedDomain 为 null ⇒ 不过滤;无域概念的行恒保留;清空 ⇒ 回落全集 */
export function filterByDomain<T extends PoolCandidateRow>(
  rows: T[],
  requestedDomain: 'cn' | 'global' | null,
): FilterOutcome<T> {
  if (requestedDomain === null) return { rows, fallbackApplied: false }
  const kept = rows.filter((r) => {
    const d = domainKeyOfRow(r)
    return d === null || d === requestedDomain
  })
  if (kept.length > 0) return { rows: kept, fallbackApplied: false }
  return { rows, fallbackApplied: rows.length > 0 }
}

// =============================================================================
// 选号管线(消费方唯一入口)
// =============================================================================

/** 过滤回空的标签(日志与结论里的 reason tag 唯一词表) */
export type PoolFallbackTag = 'credit_floor_fallback' | 'cross_domain_fallback'

export interface PoolSelectionOptions {
  policy: RelayPoolPolicy
  /** 时钟注入(默认 Date.now;测试用固定时刻) */
  nowMs?: number
  /** 加权随机的随机源(默认 Math.random;测试注入种子序列 ⇒ 复现) */
  rng?: () => number
  /** 请求域(会话亲和账号所在域);null/undefined = 不做域过滤 */
  requestedDomain?: 'cn' | 'global' | null
}

export interface PoolSelectionOutcome<T> {
  rows: T[]
  /** 命中的"永不排空"回落标签(空 = 全部过滤都按预期生效) */
  fallbacks: PoolFallbackTag[]
  strategy: RelayPoolStrategy
}

/**
 * 管线:credit_floor 过滤 → (flag 开时)域过滤 → 按策略排序。
 * 只做"排序 + 可回退的过滤",不做冷却/亲和(那些住 forwarder,依赖 IO)。
 */
export function selectPoolOrdered<T extends PoolCandidateRow>(
  rows: T[],
  opts: PoolSelectionOptions,
): PoolSelectionOutcome<T> {
  const nowMs = opts.nowMs ?? Date.now()
  const fallbacks: PoolFallbackTag[] = []
  let working = rows
  const credit = filterCreditFloor(working, opts.policy.creditFloor)
  working = credit.rows
  if (credit.fallbackApplied) fallbacks.push('credit_floor_fallback')
  if (opts.policy.crossDomainFallback) {
    const domain = filterByDomain(working, opts.requestedDomain ?? null)
    working = domain.rows
    if (domain.fallbackApplied) fallbacks.push('cross_domain_fallback')
  }
  const ordered =
    opts.policy.strategy === 'weighted_random'
      ? orderWeighted(working, nowMs, opts.policy, opts.rng ?? Math.random)
      : orderDeterministic(working, nowMs, opts.policy)
  return { rows: ordered, fallbacks, strategy: opts.policy.strategy }
}

// =============================================================================
// 测试出口(§22c 镜像判据单源;本文件非 CLI,无 main ⇒ §22d 守卫不适用)
// =============================================================================

export const __test__ = {
  DEFAULT_RELAY_POOL_POLICY,
  RELAY_POOL_ENV_KEYS,
  RELAY_POOL_KNOB_SPECS,
  HOUR_MS,
  readRelayPoolPolicy,
  relayPoolPolicyView,
  creditOfRow,
  domainKeyOfRow,
  idleHoursOf,
  idleBonusOf,
  isExpiringSoon,
  effectiveWeightOf,
  orderDeterministic,
  orderWeighted,
  filterCreditFloor,
  filterByDomain,
  selectPoolOrdered,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
