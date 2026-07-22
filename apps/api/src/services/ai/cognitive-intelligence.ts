/**
 * 认知智能服务。
 *
 * 模拟人类认知过程的辅助决策：
 * - 理解（Understand）：解析用户意图与上下文 — LLM 驱动,规则降级
 * - 推理（Reason）：基于已知信息做归纳/演绎 — LLM 驱动,规则降级
 * - 学习（Learn）：从反馈中调整模型权重（简化版）
 * - 记忆（Remember）：短时 + 长时记忆管理
 *
 * 定位：为其他 AI 服务提供"认知层"抽象,通过 callRealLlm 调用 ai-service LiteLLM 网关。
 */

import { callRealLlm, type LlmMessage } from '../crew-llm-adapter.js'

export interface CognitiveContext {
  sessionId: string
  userId?: string
  shortTermMemory: string[] // 最近 N 条交互
  longTermMemoryFacts: Map<string, string> // 持久化事实
  preferences: Map<string, number> // 偏好权重
}

// NOTE: contexts Map 仅用于短时(进程内)记忆,进程重启后丢失。
// 长期记忆持久化需 DB 支持(不在本任务范围)。
const contexts = new Map<string, CognitiveContext>()

const MAX_SHORT_TERM = 10

/** 获取或创建会话上下文。 */
export function getContext(sessionId: string): CognitiveContext {
  let ctx = contexts.get(sessionId)
  if (!ctx) {
    ctx = {
      sessionId,
      shortTermMemory: [],
      longTermMemoryFacts: new Map(),
      preferences: new Map(),
    }
    contexts.set(sessionId, ctx)
  }
  return ctx
}

/** 清理会话上下文。 */
export function clearContext(sessionId: string): void {
  contexts.delete(sessionId)
}

// ===== 理解层：意图解析 =====

export type Intent = 'question' | 'command' | 'statement' | 'emotion' | 'unknown'

export interface UnderstandingResult {
  intent: Intent
  entities: Array<{ type: string; value: string }>
  topics: string[]
  sentiment: 'positive' | 'neutral' | 'negative'
}

/** 从 LLM 输出中提取 JSON(容忍 ```json 包裹)。 */
function extractJson(content: string): unknown | null {
  try {
    const match = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    return JSON.parse((match?.[1] ?? content).trim())
  } catch {
    return null
  }
}

/** 规则版意图解析(LLM 降级用)。 */
function understandRuleBased(input: string, ctx: CognitiveContext | null): UnderstandingResult {
  const lower = input.toLowerCase()

  let intent: Intent = 'unknown'
  if (/^(是什么|什么是|为什么|怎么|如何|\?|？)/.test(input) || lower.includes('?'))
    intent = 'question'
  else if (/^(请|帮|执行|运行|创建|删除|make|do|run|create)/.test(input)) intent = 'command'
  else if (/[!！]$/.test(input) || /(开心|生气|失望|happy|sad|angry)/.test(lower))
    intent = 'emotion'
  else if (input.length > 5) intent = 'statement'

  const entities: Array<{ type: string; value: string }> = []
  const numberMatches = input.match(/\d+/g)
  if (numberMatches) entities.push(...numberMatches.map((n) => ({ type: 'number', value: n })))
  const timeMatches = input.match(/(\d{4}年|\d{1,2}月\d{1,2}日|今天|明天|昨天)/g)
  if (timeMatches) entities.push(...timeMatches.map((t) => ({ type: 'time', value: t })))

  const topics: string[] = []
  if (ctx) {
    for (const fact of ctx.longTermMemoryFacts.keys()) {
      if (input.includes(fact)) topics.push(fact)
    }
  }

  const positiveWords = ['好', '喜欢', '棒', 'good', 'great', 'nice', 'happy']
  const negativeWords = ['坏', '讨厌', '差', 'bad', 'terrible', 'sad', 'angry']
  const posHits = positiveWords.filter((w) => lower.includes(w)).length
  const negHits = negativeWords.filter((w) => lower.includes(w)).length
  const sentiment: UnderstandingResult['sentiment'] =
    posHits > negHits ? 'positive' : negHits > posHits ? 'negative' : 'neutral'

  return { intent, entities, topics, sentiment }
}

/** 解析用户输入的意图(LLM 驱动,规则降级)。 */
export async function understand(
  input: string,
  sessionId?: string,
): Promise<UnderstandingResult> {
  const ctx = sessionId ? getContext(sessionId) : null

  // 写入短时记忆
  if (ctx) {
    ctx.shortTermMemory.push(input)
    if (ctx.shortTermMemory.length > MAX_SHORT_TERM) ctx.shortTermMemory.shift()
  }

  try {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          '你是认知智能服务。分析用户输入,返回 JSON:{"intent":"question|command|statement|emotion|unknown","entities":[{"type":"string","value":"string"}],"topics":["string"],"sentiment":"positive|neutral|negative"}。只返回 JSON,不要解释。',
      },
      {
        role: 'user',
        content: ctx?.longTermMemoryFacts.size
          ? `${input}\n\n已知事实:${JSON.stringify(Object.fromEntries(ctx.longTermMemoryFacts))}`
          : input,
      },
    ]
    const result = await callRealLlm({ messages, temperature: 0.1, maxTokens: 500 })
    const parsed = extractJson(result.content) as Partial<UnderstandingResult> | null
    if (parsed?.intent && parsed.sentiment) {
      return {
        intent: parsed.intent,
        entities: parsed.entities ?? [],
        topics: parsed.topics ?? [],
        sentiment: parsed.sentiment,
      }
    }
  } catch {
    // LLM 不可用,降级到规则匹配
  }

  return understandRuleBased(input, ctx)
}

// ===== 推理层：归纳与演绎 =====

export interface ReasoningResult {
  conclusion: string
  confidence: number // 0~1
  premises: string[]
  type: 'induction' | 'deduction' | 'abduction'
}

function findCommonWords(strings: string[]): string[] {
  if (strings.length === 0) return []
  const split = strings.map((s) => new Set(s.split(/[\s,，。.、]+/).filter((w) => w.length > 1)))
  const first = split[0]!
  const common: string[] = []
  for (const word of first) {
    if (split.slice(1).every((s) => s.has(word))) common.push(word)
  }
  return common
}

/** 规则版推理(LLM 降级用)。 */
function reasonRuleBased(premises: string[], ctx: CognitiveContext | null): ReasoningResult {
  if (premises.length >= 2) {
    const commonWords = findCommonWords(premises)
    if (commonWords.length > 0) {
      return {
        conclusion: `归纳：所有前提都包含"${commonWords.join('、')}"，可能存在共同主题`,
        confidence: Math.min(0.5 + commonWords.length * 0.1, 0.9),
        premises,
        type: 'induction',
      }
    }
  }
  if (ctx && ctx.longTermMemoryFacts.size > 0) {
    for (const [fact, value] of ctx.longTermMemoryFacts) {
      for (const premise of premises) {
        if (premise.includes(fact)) {
          return {
            conclusion: `演绎：基于已知事实"${fact}=${value}"，前提可推断为真`,
            confidence: 0.8,
            premises,
            type: 'deduction',
          }
        }
      }
    }
  }
  return {
    conclusion: `溯因：基于 ${premises.length} 个前提，最可能的解释是它们属于同一上下文`,
    confidence: 0.3,
    premises,
    type: 'abduction',
  }
}

/** 基于上下文做推理(LLM 驱动,规则降级)。 */
export async function reason(premises: string[], sessionId?: string): Promise<ReasoningResult> {
  const ctx = sessionId ? getContext(sessionId) : null

  try {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          '你是推理引擎。基于给定前提做归纳/演绎/溯因推理,返回 JSON:{"conclusion":"string","confidence":0~1,"type":"induction|deduction|abduction"}。只返回 JSON。',
      },
      {
        role: 'user',
        content: `前提:\n${premises.map((p, i) => `${i + 1}. ${p}`).join('\n')}`,
      },
    ]
    const result = await callRealLlm({ messages, temperature: 0.2, maxTokens: 500 })
    const parsed = extractJson(result.content) as Partial<ReasoningResult> | null
    if (parsed?.conclusion && parsed.type) {
      return {
        conclusion: parsed.conclusion,
        confidence: parsed.confidence ?? 0.5,
        premises,
        type: parsed.type,
      }
    }
  } catch {
    // LLM 不可用,降级到规则推理
  }

  return reasonRuleBased(premises, ctx)
}

// ===== 学习层：偏好更新 =====

/** 根据用户反馈更新偏好权重。 */
export function learnPreference(sessionId: string, key: string, positive: boolean): void {
  const ctx = getContext(sessionId)
  const current = ctx.preferences.get(key) ?? 0
  const delta = positive ? 0.1 : -0.1
  ctx.preferences.set(key, Math.max(-1, Math.min(1, current + delta)))
}

/** 获取用户偏好排序。 */
export function getPreferences(
  sessionId: string,
  topK = 10,
): Array<{ key: string; weight: number }> {
  const ctx = getContext(sessionId)
  return Array.from(ctx.preferences.entries())
    .map(([key, weight]) => ({ key, weight }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, topK)
}

// ===== 记忆层：长时记忆管理 =====

/** 写入一条长时记忆事实。 */
export function rememberFact(sessionId: string, key: string, value: string): void {
  const ctx = getContext(sessionId)
  ctx.longTermMemoryFacts.set(key, value)
}

/** 查询长时记忆。 */
export function recallFact(sessionId: string, key: string): string | undefined {
  const ctx = getContext(sessionId)
  return ctx.longTermMemoryFacts.get(key)
}

/** 列出所有长时记忆。 */
export function listFacts(sessionId: string): Array<{ key: string; value: string }> {
  const ctx = getContext(sessionId)
  return Array.from(ctx.longTermMemoryFacts.entries()).map(([key, value]) => ({ key, value }))
}
