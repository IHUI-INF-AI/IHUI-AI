// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * Coze `GET /v1/bots/:bot_id`（BotInfo）↔ `agents` 全量字段映射。
 *
 * 设计原则：
 * 1. 所有官方字段都进结构化列；任何当前类型没覆盖的新字段，原样进 `coze_config_raw`；
 * 2. `avatar` / `agent_model` / `cover` 不被远端覆盖：
 *    - avatar/cover 用本地长效素材，远端 icon_url 是签名短链，只存 `coze_icon_url`；
 *    - agent_model 是本项目可路由模型名，Coze model_id/name 存 coze_model_id/name；
 * 3. temperature/top_p/penalty 用 numeric(4,3) 存字符串，保留 0.8 这类精度；
 * 4. 官方存在 snake_case 与历史 PascalCase 两种 onboarding 返回，读取时两者都兼容。
 */

import { createHash } from 'node:crypto'
import { agents, type Agent } from '@ihui/database'
import type {
  CozeBotConfig,
  CozeBotModelInfo,
  CozeBotOnboardingInfo,
  CozeBotPromptInfo,
  CozeBotVariable,
  CozePublicCapabilities,
} from '@ihui/types'

/** 可直接交给 `updateAgentDetails` 的差量；允许空值用于清空远端已撤销的配置。 */
export type CozeAgentPatch = Partial<typeof agents.$inferInsert>

export type CozeConfigSource = 'get_bot_config' | 'get_online_info' | 'legacy_cache'

export interface CozeMappedConfig {
  patch: CozeAgentPatch
  variables: CozeBotVariable[]
  payload: Record<string, unknown>
  hash: string
  version: string | null
  updatedFields: string[]
}

const AGENT_VERSION_MAX_LEN = 32
const CONFIG_VERSION_MAX_LEN = 64
const PG_INTEGER_MAX = 2147483647

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed || (!trimmed.startsWith('{') && !trimmed.startsWith('['))) return value
  try {
    return JSON.parse(trimmed)
  } catch {
    return value
  }
}

function asArray(value: unknown): unknown[] {
  const parsed = parseMaybeJson(value)
  return Array.isArray(parsed) ? parsed : []
}

function textOf(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function intOf(value: unknown): number | undefined {
  const n = finiteNumber(value)
  return n !== undefined && Number.isInteger(n) && n >= 0 && n <= PG_INTEGER_MAX ? n : undefined
}

function decimal3(value: unknown, min: number, max: number): string | undefined {
  const n = finiteNumber(value)
  if (n === undefined || n < min || n > max) return undefined
  return n.toFixed(3)
}

function versionOf(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, CONFIG_VERSION_MAX_LEN) : null
}

/** Coze 图标/背景图是带 x-expires / x-signature 的临时签名 URL，每次请求都会变。
 *  配置哈希必须先剥掉这两个查询参数，否则每次同步都会误判成"配置变了"并写一条快照。 */
function stripVolatileSignature(value: string): string {
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    if (!url.searchParams.has('x-expires') && !url.searchParams.has('x-signature')) return value
    url.searchParams.delete('x-expires')
    url.searchParams.delete('x-signature')
    // 同一对象会在 lf6-/lf9- 等 CDN 节点间轮换，节点前缀也不属于配置本身。
    url.hostname = url.hostname.replace(/^lf\d+-/i, '')
    return url.toString()
  } catch {
    return value
  }
}

function stableStringify(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(stripVolatileSignature(value))
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const record = value as Record<string, unknown>
  const keys = Object.keys(record).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`).join(',')}}`
}

function promptInfoOf(payload: CozeBotConfig): CozeBotPromptInfo | undefined {
  const raw = parseMaybeJson(payload.prompt_info)
  if (typeof raw === 'string') return { prompt: raw }
  return asRecord(raw) as CozeBotPromptInfo | undefined
}

function modelInfoOf(payload: CozeBotConfig): CozeBotModelInfo | undefined {
  const raw = parseMaybeJson(payload.model_info)
  return asRecord(raw) as CozeBotModelInfo | undefined
}

function onboardingOf(payload: CozeBotConfig): CozeBotOnboardingInfo | undefined {
  const raw = parseMaybeJson(payload.onboarding_info)
  const record = asRecord(raw)
  if (!record) return undefined
  return {
    ...record,
    prologue: textOf(record.prologue) ?? textOf(record.Prologue),
    suggested_questions: (() => {
      const list = asArray(record.suggested_questions ?? record.SuggestedQuestions)
      return list.filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    })(),
  }
}

function variablesOf(payload: CozeBotConfig): CozeBotVariable[] {
  return asArray(payload.variables)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((item) => ({
      ...item,
      enable: typeof item.enable === 'boolean' ? item.enable : undefined,
      channel: textOf(item.channel),
      keyword: textOf(item.keyword),
      description: textOf(item.description),
      default_value: textOf(item.default_value),
      prompt_enable: typeof item.prompt_enable === 'boolean' ? item.prompt_enable : undefined,
    }))
}

export function mapCozeBotConfig(
  payloadInput: CozeBotConfig | Record<string, unknown> | undefined,
  source: Exclude<CozeConfigSource, 'legacy_cache'>,
): CozeMappedConfig {
  const payload = (asRecord(payloadInput) ?? {}) as CozeBotConfig
  const patch: CozeAgentPatch = {}
  const promptInfo = promptInfoOf(payload)
  const modelInfo = modelInfoOf(payload)
  const onboarding = onboardingOf(payload)
  const variables = variablesOf(payload)
  const promptText = textOf(promptInfo?.prompt)
  const prefixPrompt = asRecord(promptInfo?.prefix_prompt_info)
  const version = versionOf(payload.version)

  if (textOf(payload.bot_id)) patch.botId = textOf(payload.bot_id)
  if (textOf(payload.name)) patch.botName = textOf(payload.name)!.slice(0, 200)
  if (textOf(payload.description)) patch.cozeDescription = textOf(payload.description)
  if (textOf(payload.icon_url)) patch.cozeIconUrl = textOf(payload.icon_url)
  if (version) {
    patch.cozeConfigVersion = version
    if (version.length <= AGENT_VERSION_MAX_LEN) patch.agentVersion = version
  }
  if (textOf(payload.owner_user_id)) patch.cozeOwnerUserId = textOf(payload.owner_user_id)
  if (textOf(payload.folder_id)) patch.cozeFolderId = textOf(payload.folder_id)
  const createTime = intOf(payload.create_time)
  if (createTime !== undefined) patch.cozeCreateTime = createTime
  const updateTime = intOf(payload.update_time)
  if (updateTime !== undefined) patch.cozeUpdateTime = updateTime

  if (promptInfo) {
    if (promptText) patch.agentPrompt = promptText
    if (textOf(promptInfo.prompt_mode)) patch.agentPromptMode = textOf(promptInfo.prompt_mode)
    if (prefixPrompt) patch.agentPrefixPrompt = prefixPrompt
  }

  if (onboarding) {
    patch.cozeOnboarding = onboarding as Record<string, unknown>
    if (onboarding.prologue) patch.cozePrologue = onboarding.prologue
    if (onboarding.suggested_questions?.length) {
      patch.suggestedQuestions = JSON.stringify(onboarding.suggested_questions)
    } else {
      patch.suggestedQuestions = null
    }
  }

  if (modelInfo) {
    if (textOf(modelInfo.model_id)) patch.cozeModelId = textOf(modelInfo.model_id)
    if (textOf(modelInfo.model_name)) patch.cozeModelName = textOf(modelInfo.model_name)
    const temperature = decimal3(modelInfo.temperature, 0, 2)
    if (temperature !== undefined) patch.agentTemperature = temperature
    const topP = decimal3(modelInfo.top_p, 0, 1)
    if (topP !== undefined) patch.cozeTopP = topP
    const topK = intOf(modelInfo.top_k)
    if (topK !== undefined) patch.cozeTopK = topK
    const maxTokens = intOf(modelInfo.max_tokens)
    if (maxTokens !== undefined && maxTokens > 0) patch.agentMaxTokens = maxTokens
    const contextRound = intOf(modelInfo.context_round)
    if (contextRound !== undefined) patch.cozeContextRound = contextRound
    if (textOf(modelInfo.response_format)) {
      patch.cozeResponseFormat = textOf(modelInfo.response_format)!.slice(0, 32)
    }
    const presence = decimal3(modelInfo.presence_penalty, -2, 2)
    if (presence !== undefined) patch.cozePresencePenalty = presence
    const frequency = decimal3(modelInfo.frequency_penalty, -2, 2)
    if (frequency !== undefined) patch.cozeFrequencyPenalty = frequency
    const params = asRecord(modelInfo.parameters)
    const modelExtra: Record<string, unknown> = { ...(params ?? {}) }
    if (textOf(modelInfo.cache_type)) modelExtra.cache_type = textOf(modelInfo.cache_type)
    if (textOf(modelInfo.api_mode)) modelExtra.api_mode = textOf(modelInfo.api_mode)
    if (Object.keys(modelExtra).length > 0) patch.cozeModelParameters = modelExtra
  }

  const botMode = intOf(payload.bot_mode)
  if (botMode !== undefined) patch.cozeBotMode = botMode
  if (textOf(payload.default_user_input_type)) {
    patch.cozeDefaultUserInputType = textOf(payload.default_user_input_type)!.slice(0, 20)
  }

  const plugins = asArray(payload.plugin_info_list)
  if (plugins.length > 0) patch.cozePlugins = plugins
  const workflows = asArray(payload.workflow_info_list)
  if (workflows.length > 0) patch.cozeWorkflows = workflows
  const knowledge = asRecord(payload.knowledge)?.knowledge_infos
  const knowledgeList = asArray(knowledge)
  if (knowledgeList.length > 0) patch.cozeKnowledge = knowledgeList
  const shortcuts = asArray(payload.shortcut_commands)
  if (shortcuts.length > 0) patch.cozeShortcutCommands = shortcuts
  const voices = asArray(payload.voice_info_list ?? payload.voice_data_list)
  if (voices.length > 0) patch.cozeVoices = voices
  const mediaConfig = asRecord(payload.media_config)
  if (mediaConfig) patch.cozeMediaConfig = mediaConfig
  const background = asRecord(payload.background_image_info)
  if (background) patch.cozeBackgroundImage = background
  const suggestReply = asRecord(payload.suggest_reply_info)
  if (suggestReply) patch.cozeSuggestReply = suggestReply

  // 远端空数组也要落库：它表达的是"Coze 侧确实没有配置"，不是"没拉到"。
  if (plugins.length === 0) patch.cozePlugins = []
  if (workflows.length === 0) patch.cozeWorkflows = []
  if (knowledgeList.length === 0) patch.cozeKnowledge = []
  if (shortcuts.length === 0) patch.cozeShortcutCommands = []
  if (voices.length === 0) patch.cozeVoices = []

  patch.agentVariables = JSON.stringify(variables)
  patch.cozeVariablesRaw = variables as unknown[]
  patch.cozeConfigRaw = payload
  patch.cozeConfigSource = source
  patch.cozeConfigStatus = source === 'get_bot_config' ? 'synced' : 'partial'
  patch.cozeConfigError = null
  patch.cozeConfigSyncedAt = new Date()
  const hash = createHash('sha256').update(stableStringify(payload)).digest('hex')
  patch.cozeConfigHash = hash

  return {
    patch,
    variables,
    payload,
    hash,
    version,
    updatedFields: Object.keys(patch),
  }
}

function arrayOfRecords(value: unknown): Record<string, unknown>[] {
  return asArray(value)
    .map((item) => asRecord(item))
    .filter((item): item is Record<string, unknown> => Boolean(item))
}

/** 对游客/非属主公开的安全能力面：不含提示词、模型参数、变量值。 */
export function toCozePublicCapabilities(agent: Partial<Agent>): CozePublicCapabilities | null {
  const plugins = arrayOfRecords(agent.cozePlugins).map((p) => ({
    name: textOf(p.name),
    description: textOf(p.description),
    iconUrl: textOf(p.icon_url),
    tools: arrayOfRecords(p.api_info_list)
      .map((a) => ({ name: textOf(a.name), description: textOf(a.description) }))
      .filter((a) => a.name),
  }))
  const workflows = arrayOfRecords(agent.cozeWorkflows).map((w) => ({
    name: textOf(w.name),
    description: textOf(w.description),
    iconUrl: textOf(w.icon_url),
  }))
  const knowledge = arrayOfRecords(agent.cozeKnowledge).map((k) => ({ name: textOf(k.name) }))
  const shortcuts = arrayOfRecords(agent.cozeShortcutCommands).map((s) => ({
    name: textOf(s.name),
    command: textOf(s.command),
    description: textOf(s.description),
    iconUrl: textOf(s.icon_url),
    queryTemplate: textOf(s.query_template),
  }))
  const onboarding = asRecord(agent.cozeOnboarding)
  const suggested = Array.isArray(onboarding?.suggested_questions)
    ? (onboarding.suggested_questions as unknown[]).filter(
        (q): q is string => typeof q === 'string' && q.trim() !== '',
      )
    : []
  const prologue = agent.cozePrologue ?? textOf(onboarding?.prologue) ?? null
  const media = asRecord(agent.cozeMediaConfig)
  const hasCapabilities =
    prologue !== null ||
    suggested.length > 0 ||
    plugins.length > 0 ||
    workflows.length > 0 ||
    knowledge.length > 0 ||
    shortcuts.length > 0 ||
    agent.cozeDefaultUserInputType != null ||
    agent.cozeBotMode != null
  if (!hasCapabilities) return null
  return {
    prologue,
    suggestedQuestions: suggested,
    plugins,
    workflows,
    knowledge,
    shortcutCommands: shortcuts,
    defaultUserInputType: agent.cozeDefaultUserInputType ?? null,
    botMode: agent.cozeBotMode ?? null,
    voiceCallClosed: typeof media?.is_voice_call_closed === 'boolean' ? media.is_voice_call_closed : null,
  }
}
