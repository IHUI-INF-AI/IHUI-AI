// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 模型规格宣告判据层(2026-11-17 立,对标 qoder2api-hub 的 `/v1/models`「能力与规格宣告」)。
 *
 * 立因:`GET /v1/models` 在本仓此前只回 OpenAI 标准四字段(id/object/created/owned_by),
 * 客户端拿不到「这个模型能不能看图 / 能不能调工具 / 上下文多大 / 有没有思考档位」;
 * qoder2api-hub 把这些**随模型列表一起宣告**,客户端不必再猜。本模块只做判据,
 * 不做 IO:是否列入列表、是否上架仍由调用方(DB 的 is_relay_public)决定。
 *
 * 纪律:
 * - **不编数字**:上下文/输出上限只登记有公开一手出处的条目(目前仅 qoder 双区公开页
 *   明写的两条),其余一律 null。null 在响应里**整键省略**,不是写 0、也不是写 "未知"。
 * - 能力是「族级规则 + 显式覆盖」:规则只断言模型族公开支持的能力;判不了 ⇒ 空数组,
 *   由调用方决定是否原样宣告(空数组 = 不宣告,不等于「不支持」)。
 * - 思考档位:**能判就判**(名称含 thinking/reasoner/o1/o3/r1 ⇒ 支持),判不了 ⇒
 *   supported=false + levels=[] —— 这是明确的「不支持」,与「未判定」分开表达。
 */

// =============================================================================
// 类型
// =============================================================================

export interface ModelSpec {
  /** 能力标签(vision / tools / reasoning / code / audio);空数组 = 不宣告 */
  capabilities: string[]
  /** 上下文窗口(tokens);null = 无一手出处,响应里省略 */
  contextWindow: number | null
  /** 单次输出上限(tokens);null = 同上 */
  maxOutputTokens: number | null
  /** 思考档位;判不了按 supported=false 明确宣告 */
  thinking: { supported: boolean; levels: string[] }
  /** 判据来源(日志/排障用;不得作为对外字段) */
  declaredBy: 'rule' | 'override' | 'none'
}

/** 显式覆盖(env / 运营登记;优先级高于族级规则) */
export interface ModelSpecOverride {
  match: string
  mode?: 'exact' | 'prefix'
  capabilities?: string[]
  contextWindow?: number
  maxOutputTokens?: number
  thinkingLevels?: string[]
  note?: string
}

// =============================================================================
// 族级能力规则(只断言公开支持的能力)
// =============================================================================

interface FamilyRule {
  match: string
  mode: 'exact' | 'prefix'
  capabilities: string[]
  /** 有公开一手出处的上下文(仅 qoder 双区页明写的两条) */
  contextWindow?: number
  maxOutputTokens?: number
}

/** 思考档位常见三档(与 OpenAI reasoning 档位同形;不声明具体 token 预算) */
export const THINKING_LEVELS = ['low', 'medium', 'high'] as const

/**
 * 族级规则表(顺序即优先级;首条命中生效)。
 * 上下文数字只放**有出处**的:qoder2api-hub 公开页写明 DeepSeek-V4-Pro「96K」、
 * GLM-5.3-Flash「1M」;其余族不写数字(不在本仓凭印象补)。
 */
export const MODEL_FAMILY_RULES: readonly FamilyRule[] = [
  {
    match: 'deepseek-v4-pro',
    mode: 'exact',
    capabilities: ['tools', 'reasoning'],
    contextWindow: 96 * 1024,
  },
  {
    match: 'glm-5.3-flash',
    mode: 'exact',
    capabilities: ['tools'],
    contextWindow: 1024 * 1024,
  },
  { match: 'gpt-', mode: 'prefix', capabilities: ['tools', 'vision'] },
  { match: 'claude-', mode: 'prefix', capabilities: ['tools', 'vision'] },
  { match: 'gemini-', mode: 'prefix', capabilities: ['tools', 'vision', 'audio'] },
  { match: 'qwen', mode: 'prefix', capabilities: ['tools'] },
  { match: 'deepseek-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'glm-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'kimi-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'minimax-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'ernie-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'hunyuan-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'grok-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'llama-', mode: 'prefix', capabilities: ['tools'] },
  { match: 'mistral-', mode: 'prefix', capabilities: ['tools'] },
]

/** 各能力的名称推导(与族级规则取并集;名称里出现的才算) */
const CAPABILITY_NAME_HINTS: ReadonlyArray<{ capability: string; needles: string[] }> = [
  { capability: 'vision', needles: ['vision', '-vl', 'omni', 'multimodal'] },
  { capability: 'audio', needles: ['audio', 'realtime', 'speech'] },
  { capability: 'code', needles: ['code', 'coder'] },
  { capability: 'reasoning', needles: ['thinking', 'reasoner', '-r1', 'o1', 'o3'] },
]

/** 思考型模型名判别(与 CAPABILITY_NAME_HINTS 的 reasoning 同源词表,单独导出供测试锁) */
const THINKING_NAME_NEEDLES = ['thinking', 'reasoner', '-r1', 'o1-', 'o3-', ' o1', ' o3'] as const

// =============================================================================
// 判据
// =============================================================================

function hitByRule(modelId: string): FamilyRule | null {
  const id = modelId.toLowerCase()
  for (const rule of MODEL_FAMILY_RULES) {
    if (rule.mode === 'exact' ? id === rule.match : id.startsWith(rule.match)) return rule
  }
  return null
}

function hitOverride(
  modelId: string,
  overrides: readonly ModelSpecOverride[] | undefined,
): ModelSpecOverride | null {
  if (!overrides || overrides.length === 0) return null
  const id = modelId.toLowerCase()
  for (const o of overrides) {
    const mode = o.mode ?? 'exact'
    const m = o.match.toLowerCase()
    if (mode === 'exact' ? id === m : id.startsWith(m)) return o
  }
  return null
}

export function isThinkingModel(modelId: string): boolean {
  const id = modelId.toLowerCase()
  return THINKING_NAME_NEEDLES.some((n) => id.includes(n))
}

/**
 * 模型 → 规格(纯判据)。
 *
 * 判序:显式覆盖(env/运营) → 族级规则 → 仅名称推导(无族级命中也能判出 vision/code 等)。
 * `declaredBy` 只反映「是否命中表」,不进入对外响应。
 */
export function deriveModelSpec(
  modelId: string,
  overrides?: readonly ModelSpecOverride[],
): ModelSpec {
  const override = hitOverride(modelId, overrides)
  if (override) {
    // 覆盖只改它**声明**的字段:没写 capabilities ⇒ 继承族级规则(不因一条上下文覆盖
    // 把「支持 tools」抹掉);写了 ⇒ 显式替换族级,但仍与名称推导并集(名称是客观事实)。
    const familyForCaps = hitByRule(modelId)
    const baseCaps = override.capabilities ?? familyForCaps?.capabilities ?? []
    return {
      capabilities: dedupe([
        ...baseCaps,
        ...nameCapabilities(modelId),
        ...(isThinkingModel(modelId) ? ['reasoning'] : []),
      ]),
      contextWindow: override.contextWindow ?? null,
      maxOutputTokens: override.maxOutputTokens ?? null,
      thinking: override.thinkingLevels
        ? { supported: true, levels: [...override.thinkingLevels] }
        : isThinkingModel(modelId)
          ? { supported: true, levels: [...THINKING_LEVELS] }
          : { supported: false, levels: [] },
      declaredBy: 'override',
    }
  }

  const rule = hitByRule(modelId)
  const capabilities = dedupe([...(rule?.capabilities ?? []), ...nameCapabilities(modelId)])
  return {
    capabilities,
    contextWindow: rule?.contextWindow ?? null,
    maxOutputTokens: rule?.maxOutputTokens ?? null,
    thinking: isThinkingModel(modelId)
      ? { supported: true, levels: [...THINKING_LEVELS] }
      : { supported: false, levels: [] },
    declaredBy: rule ? 'rule' : capabilities.length > 0 ? 'rule' : 'none',
  }
}

function nameCapabilities(modelId: string): string[] {
  const id = modelId.toLowerCase()
  const out: string[] = []
  for (const { capability, needles } of CAPABILITY_NAME_HINTS) {
    if (needles.some((n) => id.includes(n))) out.push(capability)
  }
  return out
}

function dedupe(list: string[]): string[] {
  return [...new Set(list)]
}

/** 规格 → 对外响应片段(只在有值的键上出场;空能力数组不出场) */
export function modelSpecToWire(spec: ModelSpec): Record<string, unknown> {
  const wire: Record<string, unknown> = {}
  if (spec.capabilities.length > 0) wire['capabilities'] = spec.capabilities
  if (spec.contextWindow !== null) wire['context_window'] = spec.contextWindow
  if (spec.maxOutputTokens !== null) wire['max_output_tokens'] = spec.maxOutputTokens
  wire['thinking'] = spec.thinking
  return wire
}

// =============================================================================
// env 覆盖表解析
// =============================================================================

export interface ParsedSpecEnv {
  overrides: ModelSpecOverride[]
  rejected: Array<{ index: number; reason: string }>
}

/**
 * 解析 `IHUI_RELAY_MODEL_SPEC_JSON`(数组或 `{overrides:[...]}`)。
 * 非法条目整条丢弃并点名:一条写错的规格会让客户端按错误上下文切分请求。
 */
export function parseModelSpecEnv(raw: string | undefined | null): ParsedSpecEnv {
  const text = (raw ?? '').trim()
  if (!text) return { overrides: [], rejected: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (e) {
    return {
      overrides: [],
      rejected: [
        { index: -1, reason: `JSON 解析失败:${e instanceof Error ? e.message : String(e)}` },
      ],
    }
  }
  const list: unknown[] = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { overrides?: unknown }).overrides)
      ? (parsed as { overrides: unknown[] }).overrides
      : []
  if (list.length === 0) {
    return { overrides: [], rejected: [{ index: -1, reason: '缺少 overrides 数组或为空' }] }
  }
  const overrides: ModelSpecOverride[] = []
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
    const mode = rec['mode'] === 'prefix' ? 'prefix' : 'exact'
    const caps = Array.isArray(rec['capabilities'])
      ? rec['capabilities'].filter((c): c is string => typeof c === 'string')
      : undefined
    const ctx =
      typeof rec['contextWindow'] === 'number' && rec['contextWindow'] > 0
        ? Math.floor(rec['contextWindow'])
        : undefined
    const out =
      typeof rec['maxOutputTokens'] === 'number' && rec['maxOutputTokens'] > 0
        ? Math.floor(rec['maxOutputTokens'])
        : undefined
    const levels = Array.isArray(rec['thinkingLevels'])
      ? rec['thinkingLevels'].filter((l): l is string => typeof l === 'string')
      : undefined
    if (!caps && ctx === undefined && out === undefined && !levels) {
      rejected.push({
        index,
        reason: '没有任何有效字段(capabilities/contextWindow/maxOutputTokens/thinkingLevels)',
      })
      return
    }
    overrides.push({
      match,
      mode,
      capabilities: caps,
      contextWindow: ctx,
      maxOutputTokens: out,
      thinkingLevels: levels,
      note: typeof rec['note'] === 'string' ? rec['note'] : undefined,
    })
  })
  return { overrides, rejected }
}

// =============================================================================
// 测试出口
// =============================================================================

export const __test__ = {
  MODEL_FAMILY_RULES,
  CAPABILITY_NAME_HINTS,
  THINKING_NAME_NEEDLES,
  hitByRule,
  hitOverride,
  nameCapabilities,
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
