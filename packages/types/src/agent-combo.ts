// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Agent 参数组合(Agent Combo)—— 2026-11-13 立
 *
 * 遵循统一工程规范
 * 一键套用到当前会话/全局默认。与既有单点的差异:
 *  - `personality-presets.ts` 只给 6 个固定人格,改一个参数就得重来;
 *  - `sampling-params-store` 只记录"当前值",没有名字、不能复用、跨设备丢失。
 * 组合把两者变成可命名、可跨端复用的配置单元。
 *
 * 单一真相源:
 *  - 落库仍走 `user_preferences`(group='agent_combo',key=组合 id),不新增迁移;
 *  - 校验器本文件唯一,客户端保存前、服务端写入前各跑一次(客户端可绕过,服务端必须重跑);
 *  - 参数键与 `apps/web/src/stores/sampling-params.ts` 的 `SamplingParams` 对齐 ——
 *    新增采样参数时这里必须同批加,否则组合会"存得下、套不上"。
 */

export const AGENT_COMBO_ID_RE = /^[a-z][a-z0-9-]{1,63}$/

export const AGENT_COMBO_LIMITS = {
  /** 单用户组合数上限 */
  maxCombos: 30,
  /** 组合名字符上限 */
  maxNameChars: 60,
  /** 描述字符上限 */
  maxDescriptionChars: 200,
  /** 人格提示词字符上限(与 sampling-params 的 systemPromptMax 同值) */
  maxPromptChars: 8_000,
  /** 人格预设 id 字符上限 */
  maxPresetIdChars: 40,
} as const

/** 组合承载的参数集合(全部可选:缺省 = 套用时不动该项) */
export interface AgentComboParams {
  temperature?: number
  topP?: number
  topK?: number
  maxTokens?: number
  systemPrompt?: string
  /** 来源预设 id(仅用于 UI 标识;套用时以 systemPrompt 为准) */
  personalityPresetId?: string
}

export interface AgentCombo {
  id: string
  name: string
  description?: string
  params: AgentComboParams
  createdAt: string
  updatedAt: string
}

export interface AgentComboDraft {
  id: string
  name: string
  description?: string
  params: AgentComboParams
}

export interface AgentComboListResponse {
  combos: AgentCombo[]
  authenticated: boolean
}

export interface AgentComboDetailResponse {
  combo: AgentCombo
}

export interface AgentComboDeleteResponse {
  id: string
  removed: true
}

export interface AgentComboIssue {
  path: string
  message: string
}

export type AgentComboValidationResult =
  { ok: true; value: AgentComboDraft } | { ok: false; errors: AgentComboIssue[] }

const PARAM_KEYS = new Set([
  'temperature',
  'topP',
  'topK',
  'maxTokens',
  'systemPrompt',
  'personalityPresetId',
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 数值范围取自 sampling-params.ts 的 SAMPLING_PARAM_RANGES,越界直接拒绝而不是静默夹断 */
const RANGES: Record<
  'temperature' | 'topP' | 'topK' | 'maxTokens',
  { min: number; max: number; int?: true }
> = {
  temperature: { min: 0, max: 2 },
  topP: { min: 0, max: 1 },
  topK: { min: 0, max: 200, int: true },
  maxTokens: { min: 1, max: 200_000, int: true },
}

/**
 * 校验一份组合定义。
 * @param raw 请求体或本地草稿
 * @param options.expectedId 路由参数 id(给出时要求 body.id 与之一致)
 */
export function validateAgentCombo(
  raw: unknown,
  options: { expectedId?: string } = {},
): AgentComboValidationResult {
  const errors: AgentComboIssue[] = []
  const push = (path: string, message: string): void => {
    errors.push({ path, message })
  }
  if (!isRecord(raw)) {
    return { ok: false, errors: [{ path: '', message: '组合必须是对象' }] }
  }

  const id = typeof raw['id'] === 'string' ? raw['id'].trim() : ''
  if (!AGENT_COMBO_ID_RE.test(id)) {
    push('id', 'id 必须小写字母开头,只含小写字母/数字/连字符,长度 2-64')
  }
  if (options.expectedId !== undefined && id !== options.expectedId) {
    push('id', `id 与路由不一致(期望 ${options.expectedId})`)
  }

  const name = typeof raw['name'] === 'string' ? raw['name'].trim() : ''
  if (name.length === 0 || name.length > AGENT_COMBO_LIMITS.maxNameChars) {
    push('name', `name 必填且不超过 ${AGENT_COMBO_LIMITS.maxNameChars} 字符`)
  }

  const descriptionRaw = raw['description']
  let description: string | undefined
  if (descriptionRaw !== undefined) {
    if (typeof descriptionRaw !== 'string') {
      push('description', 'description 必须是字符串')
    } else if (descriptionRaw.length > AGENT_COMBO_LIMITS.maxDescriptionChars) {
      push('description', `description 不超过 ${AGENT_COMBO_LIMITS.maxDescriptionChars} 字符`)
    } else if (descriptionRaw.trim()) {
      description = descriptionRaw.trim()
    }
  }

  const paramsRaw = raw['params']
  const params: AgentComboParams = {}
  if (paramsRaw !== undefined) {
    if (!isRecord(paramsRaw)) {
      push('params', 'params 必须是对象')
    } else {
      for (const [key, value] of Object.entries(paramsRaw)) {
        if (!PARAM_KEYS.has(key)) {
          push(`params.${key}`, `未知参数 "${key}"`)
          continue
        }
        if (value === undefined || value === null) continue
        if (key in RANGES) {
          const range = RANGES[key as keyof typeof RANGES]
          if (typeof value !== 'number' || !Number.isFinite(value)) {
            push(`params.${key}`, `${key} 必须是有限数字`)
            continue
          }
          if (range.int && !Number.isInteger(value)) {
            push(`params.${key}`, `${key} 必须是整数`)
            continue
          }
          if (value < range.min || value > range.max) {
            push(`params.${key}`, `${key} 必须在 ${range.min}-${range.max} 之间`)
            continue
          }
          if (key === 'temperature') params.temperature = value
          else if (key === 'topP') params.topP = value
          else if (key === 'topK') params.topK = value
          else params.maxTokens = value
          continue
        }
        if (key === 'systemPrompt') {
          if (typeof value !== 'string') {
            push('params.systemPrompt', 'systemPrompt 必须是字符串')
            continue
          }
          if (value.length > AGENT_COMBO_LIMITS.maxPromptChars) {
            push(
              'params.systemPrompt',
              `systemPrompt 不超过 ${AGENT_COMBO_LIMITS.maxPromptChars} 字符`,
            )
            continue
          }
          if (value.trim()) params.systemPrompt = value
          continue
        }
        if (key === 'personalityPresetId') {
          if (typeof value !== 'string' || value.length > AGENT_COMBO_LIMITS.maxPresetIdChars) {
            push('params.personalityPresetId', 'personalityPresetId 必须是短字符串')
            continue
          }
          if (value.trim()) params.personalityPresetId = value.trim()
        }
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return {
    ok: true,
    value: description === undefined ? { id, name, params } : { id, name, description, params },
  }
}

/** 反序列化落库记录;结构不合法一律返回 null(坏数据不进 UI,也不阻塞其他组合)。 */
export function parseAgentComboRecord(value: unknown): AgentCombo | null {
  let parsed: unknown = value
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value)
    } catch {
      return null
    }
  }
  if (!isRecord(parsed)) return null
  const validation = validateAgentCombo(parsed)
  if (!validation.ok) return null
  const createdAt = typeof parsed['createdAt'] === 'string' ? parsed['createdAt'] : ''
  const updatedAt = typeof parsed['updatedAt'] === 'string' ? parsed['updatedAt'] : ''
  return {
    ...validation.value,
    createdAt,
    updatedAt,
  }
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
