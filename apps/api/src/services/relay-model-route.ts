// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型路由区域判据层(2026-11-17 立,对标 qoder2api-hub 的「双区 catalog + 别名与独占表」)。
 *
 * 立因:qoder2api 系网关把 qoder.com.cn(国内)与 qoder.com(国际)接成一个 OpenAI 端点,
 * 并声明三件本仓此前没有完整表达的事:
 *   ① 同一 upstream_key 在**不同区**可能指向不同模型(mm 国际 = MiniMax-M3,国内 = MiniMax-M2.7);
 *   ② 区域独占模型按归属出口自动路由;
 *   ③ Key 出口与模型区域不匹配时回通俗 400,而不是上游晦涩拒流。
 * 本仓已有:模型别名表(relay-model-catalog,DB 驱动)、`<平台>/<模型>` 两段前缀、
 * workbuddy 的 domain 跨域互兜。缺的是「模型 → 区」与「账号 → 区」两端统一判据。
 *
 * 本模块是**纯判据层,零 IO**:不碰数据库、不碰 Redis、不打日志、不发网络。
 * 消费方 = relay-account-forwarder(选号前定 requestedRegion / 剥三段前缀)与
 * relay-pool-policy(账号行 → 区)。所有内置表与 env 键只住本文件一处(§0.6)。
 *
 * 纪律:
 * - **歧义不猜**:同一 match 命中多个区 ⇒ 返回 `ambiguous:true` + region=null,调用方按
 *   「不指定区」处理(不过滤),绝不挑一个区冒充结论(§0.3)。
 * - **判不了不排空**:账号行区取不到 ⇒ null ⇒ 区过滤恒放行(与 relay-pool-policy 的
 *   filterByDomain 同一纪律)。
 * - 非法 env 一律整条丢弃并点名(静默丢弃 = 本仓记过无数次的「安静」型失效)。
 */

// =============================================================================
// 区域枚举与归一
// =============================================================================

export const ROUTE_REGIONS = ['cn', 'global'] as const
export type RouteRegion = (typeof ROUTE_REGIONS)[number]

/** 区字段的取值归一表(单一真相源;账号行 jsonb 与规则表共用这一把尺) */
const REGION_ALIASES: Readonly<Record<string, RouteRegion>> = {
  cn: 'cn',
  china: 'cn',
  mainland: 'cn',
  domestic: 'cn',
  国内: 'cn',
  global: 'global',
  intl: 'global',
  international: 'global',
  overseas: 'global',
  国际: 'global',
  海外: 'global',
}

/**
 * 任意区字段值 → 标准区键。判不了(空/未知)⇒ null,绝不猜。
 * 大小写与首尾空白不计入(账号行 jsonb 是人工/提取器写入,形态必然不齐)。
 */
export function normalizeRegion(raw: unknown): RouteRegion | null {
  if (typeof raw !== 'string') return null
  const key = raw.trim().toLowerCase()
  if (!key) return null
  return REGION_ALIASES[key] ?? null
}

// =============================================================================
// 账号行 → 区(账号侧的单一判据)
// =============================================================================

export interface RegionCandidateRow {
  providerCode: string
  /** jsonb 明文元数据(区信息可能住这里) */
  extraMetadata?: unknown
}

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

/**
 * 账号行的区归属(选号区过滤的取材)。
 *
 * 取值顺序(首个命中生效;单一真相源):
 * 1. `extraMetadata.region` —— minimax/zcode 等提取器已写入单值区;
 * 2. `extraMetadata.regions` —— 同一账号在多区可用时的数组;首项有效即取首项
 *    (该形态来自 zcode 提取器的双区凭证;多区号在选号上按「首个登记区」归属,
 *    不是按请求区动态展开 —— 展开等于把一条账号行当成两条,会破坏并发闸的账号粒度);
 * 3. workbuddy 的 `extraMetadata.domain` 经 resolveRealm 换算(与适配器选上游基址
 *    同一把尺子)—— 但那是适配器层的换算,**本模块不复制它**:workbuddy 的两个域名
 *    由调用方传入的 domain 原文按同一 REGION_ALIASES 归一时不成立('workbuddy.ai'
 *    不在表里),故 workbuddy 的域判定仍由 relay-pool-policy 的 domainKeyOfRow 负责,
 *    本函数对 workbuddy 返回 null 并在注释里点名,避免两份实现漂移。
 *
 * 判不了 ⇒ null(区过滤恒放行)。
 */
export function accountRegionOfRow(row: RegionCandidateRow): RouteRegion | null {
  if (row.providerCode === 'workbuddy') return null
  const meta = metaObject(row.extraMetadata)
  if (!meta) return null
  const single = normalizeRegion(meta['region'])
  if (single) return single
  const list = meta['regions']
  if (Array.isArray(list)) {
    for (const item of list) {
      const r = normalizeRegion(item)
      if (r) return r
    }
  }
  return null
}

// =============================================================================
// 模型名解析:三段前缀优先 → 规则表兜底
// =============================================================================

/** 命中方式(日志与结论的唯一词表;新增一档必须同笔更新测试) */
export const MODEL_ROUTE_MATCHES = [
  'provider_prefix',
  'provider_region_prefix',
  'rule_exact',
  'rule_prefix',
] as const
export type ModelRouteMatch = (typeof MODEL_ROUTE_MATCHES)[number]

export interface ParsedProviderPrefix {
  providerCode: string
  /** 三段形态里的区段;两段形态为 null */
  region: RouteRegion | null
  /** 剥前缀后的模型名(三段形态剥两段) */
  model: string
}

/**
 * 解析 `<provider>[/<region>]/<model>`。
 *
 * 只认调用方给的 `isProvider` 判据(不复制 RELAY_PROVIDERS);非法前缀(空段、
 * 首段不是平台)⇒ null,绝不把任意 `<x>/<y>` 当平台(否则渠道模型会被误吞)。
 * 区段非法(`qoder/tokyo/x`)⇒ 整条当两段形态处理:provider=qoder、model=`tokyo/x`,
 * 而不是「有区但判不了」的半成品 —— 上游模型名允许带斜杠(部分平台的自定义模型
 * 就是 `org/model` 形态)。
 */
export function parseProviderPrefix(
  rawModel: string,
  isProvider: (v: string) => boolean,
): ParsedProviderPrefix | null {
  const first = rawModel.indexOf('/')
  if (first <= 0) return null
  const head = rawModel.slice(0, first)
  if (!isProvider(head)) return null
  const rest = rawModel.slice(first + 1)
  const second = rest.indexOf('/')
  if (second > 0) {
    const maybeRegion = normalizeRegion(rest.slice(0, second))
    if (maybeRegion) {
      const model = rest.slice(second + 1)
      if (model) return { providerCode: head, region: maybeRegion, model }
    }
  }
  // 尾部空段(`qoder/global/`)不是模型名:按非法输入回 null,而不是把它当两段形态
  // 交给上游(上游会收到一个带尾斜杠的伪模型名,报错文案与真实原因脱节)。
  if (!rest || rest.endsWith('/')) return null
  return { providerCode: head, region: null, model: rest }
}

/** 规则表一条:match 精确或前缀 → 区(可绑定平台) */
export interface ModelRegionRule {
  match: string
  mode: 'exact' | 'prefix'
  region: RouteRegion
  /** 限定的平台(省略 = 任意平台) */
  providerCode?: string
  /** 人话理由(面板与日志用;不得空着) */
  note: string
}

/**
 * 内置规则(本机一手取证,均来自 qoder2api-hub 公开能力页的「双区模型清单」节):
 * - `q37fmodel` / `glm-5.2`:页面明确标注「独占模型」,归国内版;
 * - `mmodel`:页面写明「国际 = MiniMax-M3、国内 = MiniMax-M2.7」⇒ 同一 key 跨区不同模型;
 *   这条**不得**写成单向规则,否则会把国际模型请求打到国内模型(答非所问)。
 *   ⇒ 只把展示名 `MiniMax-M3`(国际)与 `MiniMax-M2.7`(国内)各立一条,`mmodel`
 *   本身不立规则 = 歧义时按「不指定区」处理。
 *
 * 该表只登记「页面明说区域归属」的条目。qoder 的其余模型(千问/DeepSeek/Kimi/GLM-5.3
 * 等)页面未逐条标注独占,一律不立规则 —— 不凭印象补区(否则会把双区可用模型错判成独占)。
 */
export const BUILTIN_MODEL_REGION_RULES: readonly ModelRegionRule[] = [
  {
    match: 'q37fmodel',
    mode: 'exact',
    region: 'cn',
    providerCode: 'qoder',
    note: 'qoder2api-hub 公开页「独占模型 q37fmodel」:国内版独占',
  },
  {
    match: 'glm-5.2',
    mode: 'exact',
    region: 'cn',
    providerCode: 'qoder',
    note: 'qoder2api-hub 公开页「独占模型 glm-5.2」:国内版独占',
  },
  {
    match: 'MiniMax-M3',
    mode: 'exact',
    region: 'global',
    providerCode: 'qoder',
    note: 'qoder2api-hub 公开页:mm 国际版 = MiniMax-M3',
  },
  {
    match: 'MiniMax-M2.7',
    mode: 'exact',
    region: 'cn',
    providerCode: 'qoder',
    note: 'qoder2api-hub 公开页:mm 国内版 = MiniMax-M2.7',
  },
]

const RULE_MODES: ReadonlySet<string> = new Set(['exact', 'prefix'])

export interface ParsedModelRegionEnv {
  rules: ModelRegionRule[]
  rejected: Array<{ index: number; reason: string }>
}

/**
 * 解析 `IHUI_RELAY_MODEL_REGION_JSON`(数组或 `{rules:[...]}` 皆可)。
 *
 * 整条丢弃 + 点名(而不是宽松收下):一条区写错的规则会把某模型的请求固定打到
 * 另一个区,表现为「模型答非所问」,比没有这条规则更危险。
 */
export function parseModelRegionEnv(raw: string | undefined | null): ParsedModelRegionEnv {
  const text = (raw ?? '').trim()
  if (!text) return { rules: [], rejected: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      rules: [],
      rejected: [
        { index: -1, reason: `JSON 解析失败:${e instanceof Error ? e.message : String(e)}` },
      ],
    }
  }
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { rules?: unknown }).rules)
      ? (parsed as { rules: unknown[] }).rules
      : []
  if (list.length === 0) {
    return { rules: [], rejected: [{ index: -1, reason: '缺少 rules 数组或数组为空' }] }
  }
  const rules: ModelRegionRule[] = []
  const rejected: Array<{ index: number; reason: string }> = []
  list.forEach((item, index) => {
    const rec = item && typeof item === 'object' ? (item as Record<string, unknown>) : null
    if (!rec) {
      rejected.push({ index, reason: '不是对象' })
      return
    }
    const match = typeof rec['match'] === 'string' ? rec['match'].trim() : ''
    if (!match) {
      rejected.push({ index, reason: 'match 为空' })
      return
    }
    const modeRaw = typeof rec['mode'] === 'string' ? rec['mode'].trim() : 'exact'
    if (!RULE_MODES.has(modeRaw)) {
      rejected.push({ index, reason: `mode 非法:${modeRaw}` })
      return
    }
    const region = normalizeRegion(rec['region'])
    if (!region) {
      rejected.push({ index, reason: `region 非法:${String(rec['region'])}` })
      return
    }
    const providerCode =
      typeof rec['providerCode'] === 'string' && rec['providerCode'].trim()
        ? rec['providerCode'].trim()
        : undefined
    const note = typeof rec['note'] === 'string' ? rec['note'].trim() : ''
    if (!note) {
      rejected.push({ index, reason: 'note 为空(必须给可问责理由)' })
      return
    }
    rules.push({ match, mode: modeRaw as 'exact' | 'prefix', region, providerCode, note })
  })
  return { rules, rejected }
}

/** 规则命中判定(大小写不敏感;prefix 模式按字符串前缀;平台限定不匹配即跳过) */
function ruleHits(rule: ModelRegionRule, model: string, providerCode: string | null): boolean {
  // 规则限定平台时,请求的归属平台必须**已知且相等**才算命中 —— 判不出平台
  // (providerCode=null)不等于「任意平台」:把 `gpt-6` 这类别家模型套上本平台的
  // 区规则,会把请求打到错误的出口(失效方向必须是「不命中、不指定区」)。
  if (rule.providerCode && rule.providerCode !== providerCode) return false
  const a = rule.match.toLowerCase()
  const b = model.toLowerCase()
  return rule.mode === 'exact' ? a === b : b.startsWith(a)
}

export interface ModelRoute {
  /** 归属平台(判不了 ⇒ null) */
  providerCode: string | null
  /** 发给上游的模型名(已剥平台/区前缀) */
  upstreamModel: string
  /** 区归属;歧义或未命中 ⇒ null */
  region: RouteRegion | null
  /** 同一 match 命中多个区(调用方必须按「不指定区」处理) */
  ambiguous: boolean
  matchedBy: ModelRouteMatch | null
  /** 命中的规则说明(日志用;未命中为 null) */
  note: string | null
}

export interface ResolveModelRouteOptions {
  isProvider: (v: string) => boolean
  /** 追加规则(env 档);内置规则恒在且优先级更高(本机取证优先于运维配置) */
  extraRules?: readonly ModelRegionRule[]
  /** 模型目录里已登记的平台归属(`<provider>/` 前缀之外的第二判据) */
  catalogProvider?: string | null
}

/**
 * 模型名 → 路由(唯一出口)。
 *
 * 判序(单一真相源):
 * 1. 三段前缀 `<provider>/<region>/<model>` —— 显式区,最高优先,永远不被规则覆盖;
 * 2. 两段前缀 `<provider>/<model>` —— 平台确定;区只由规则表补,规则未命中 ⇒ null;
 * 3. 裸名 —— 规则表(内置优先、env 追加)按「精确 → 前缀」两轮扫描;
 *    同一轮命中多个区 ⇒ ambiguous=true、region=null(不猜);
 * 4. 全未命中 ⇒ { providerCode: catalogProvider ?? null, region: null }。
 *
 * 前缀命中的模型名,在「剥前缀」之后**不再二次套规则**:`qoder/global/x` 已经由
 * 用户显式定了区,再按裸名 `x` 套一条国内规则会与用户的显式意图冲突。
 */
export function resolveModelRoute(rawModel: string, opts: ResolveModelRouteOptions): ModelRoute {
  const prefix = parseProviderPrefix(rawModel, opts.isProvider)
  if (prefix) {
    if (prefix.region) {
      return {
        providerCode: prefix.providerCode,
        upstreamModel: prefix.model,
        region: prefix.region,
        ambiguous: false,
        matchedBy: 'provider_region_prefix',
        note: '三段前缀显式指定区',
      }
    }
    const rule = matchRule(prefix.model, prefix.providerCode, opts)
    return {
      providerCode: prefix.providerCode,
      upstreamModel: prefix.model,
      region: rule.region,
      ambiguous: rule.ambiguous,
      matchedBy: rule.region ? rule.matchedBy : 'provider_prefix',
      note: rule.note,
    }
  }

  const rule = matchRule(rawModel, opts.catalogProvider ?? null, opts)
  if (rule.region || rule.ambiguous) {
    return {
      providerCode: rule.providerCode ?? opts.catalogProvider ?? null,
      upstreamModel: rawModel,
      region: rule.region,
      ambiguous: rule.ambiguous,
      matchedBy: rule.matchedBy,
      note: rule.note,
    }
  }
  return {
    providerCode: opts.catalogProvider ?? null,
    upstreamModel: rawModel,
    region: null,
    ambiguous: false,
    matchedBy: null,
    note: null,
  }
}

interface RuleOutcome {
  providerCode: string | null
  region: RouteRegion | null
  ambiguous: boolean
  matchedBy: ModelRouteMatch | null
  note: string | null
}

/** 两轮扫描(精确优先于前缀);同轮多区命中 ⇒ 歧义 */
function matchRule(
  model: string,
  providerCode: string | null,
  opts: ResolveModelRouteOptions,
): RuleOutcome {
  const all = [...BUILTIN_MODEL_REGION_RULES, ...(opts.extraRules ?? [])]
  for (const mode of ['exact', 'prefix'] as const) {
    const hits = all.filter((r) => r.mode === mode && ruleHits(r, model, providerCode))
    if (hits.length === 0) continue
    const regions = new Set(hits.map((h) => h.region))
    if (regions.size > 1) {
      return {
        providerCode: hits[0]?.providerCode ?? providerCode,
        region: null,
        ambiguous: true,
        matchedBy: mode === 'exact' ? 'rule_exact' : 'rule_prefix',
        note: `规则命中多个区(${[...regions].join('/')}),不猜`,
      }
    }
    const hit = hits[0] as ModelRegionRule
    return {
      providerCode: hit.providerCode ?? providerCode,
      region: hit.region,
      ambiguous: false,
      matchedBy: mode === 'exact' ? 'rule_exact' : 'rule_prefix',
      note: hit.note,
    }
  }
  return { providerCode, region: null, ambiguous: false, matchedBy: null, note: null }
}

// =============================================================================
// 测试出口(§22c 镜像判据单源;本文件非 CLI,无 main ⇒ §22d 守卫不适用)
// =============================================================================

export const __test__ = {
  REGION_ALIASES,
  BUILTIN_MODEL_REGION_RULES,
  normalizeRegion,
  accountRegionOfRow,
  parseProviderPrefix,
  parseModelRegionEnv,
  ruleHits,
  matchRule,
  resolveModelRoute,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
