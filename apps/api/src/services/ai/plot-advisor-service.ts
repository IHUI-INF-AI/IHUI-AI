/**
 * 剧情顾问服务。
 *
 * 为长篇叙事内容（小说/剧本/漫画脚本）提供 AI 辅助：
 * - 角色一致性检查：跨章节角色设定冲突检测 — LLM 驱动,规则降级
 * - 情节节奏分析：基于"开场-发展-高潮-结尾"结构评分 — LLM 驱动,规则降级
 * - 伏笔追踪：记录已埋伏笔与回收情况（规则统计）
 * - 章节大纲生成：基于主线生成章节级 outline — LLM 驱动,规则降级
 *
 * 状态保存在内存（按 storyId），适合单实例或会话级使用。
 * 硬编码关系表(SYMMETRIC_PAIRS)作为 LLM prompt 的参考上下文,不删除。
 */

import { callRealLlm, type LlmMessage } from '../crew-llm-adapter.js'

export interface Character {
  id: string
  name: string
  traits: string[]
  relations: Array<{ targetId: string; relation: string }>
}

export interface PlotPoint {
  id: string
  chapter: number
  type: 'setup' | 'foreshadow' | 'conflict' | 'climax' | 'resolution'
  description: string
  resolvedForeshadowIds?: string[]
}

export interface StoryState {
  storyId: string
  title: string
  characters: Map<string, Character>
  plotPoints: PlotPoint[]
  unresolvedForeshadows: Set<string>
}

const stories = new Map<string, StoryState>()

/** 创建/初始化 story 状态。 */
export function createStory(storyId: string, title: string): StoryState {
  const state: StoryState = {
    storyId,
    title,
    characters: new Map(),
    plotPoints: [],
    unresolvedForeshadows: new Set(),
  }
  stories.set(storyId, state)
  return state
}

/** 获取 story 状态。 */
export function getStory(storyId: string): StoryState | null {
  return stories.get(storyId) ?? null
}

/** 添加角色。 */
export function addCharacter(storyId: string, character: Character): void {
  const story = getStory(storyId)
  if (!story) throw new Error(`故事 ${storyId} 不存在`)
  story.characters.set(character.id, character)
}

/** 添加情节节点。 */
export function addPlotPoint(storyId: string, point: PlotPoint): void {
  const story = getStory(storyId)
  if (!story) throw new Error(`故事 ${storyId} 不存在`)
  story.plotPoints.push(point)
  if (point.type === 'foreshadow') {
    story.unresolvedForeshadows.add(point.id)
  }
  if (point.resolvedForeshadowIds) {
    for (const fid of point.resolvedForeshadowIds) {
      story.unresolvedForeshadows.delete(fid)
    }
  }
}

/** 角色一致性检查：跨章节冲突检测。 */
export interface ConsistencyIssue {
  type: 'trait_conflict' | 'relation_conflict' | 'unresolved_foreshadow'
  message: string
  severity: 'info' | 'warning' | 'critical'
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

const SYMMETRIC_PAIRS: Record<string, string> = {
  father: 'son',
  mother: 'son',
  son: 'father',
  daughter: 'mother',
  teacher: 'student',
  student: 'teacher',
  friend: 'friend',
  lover: 'lover',
  spouse: 'spouse',
  rival: 'rival',
}

function isRelationSymmetric(a: string, b: string): boolean {
  if (a === b) return true
  return SYMMETRIC_PAIRS[a] === b
}

/** 规则版一致性检查(LLM 降级用)。 */
function checkConsistencyRuleBased(story: StoryState): ConsistencyIssue[] {
  const issues: ConsistencyIssue[] = []

  for (const fid of story.unresolvedForeshadows) {
    const point = story.plotPoints.find((p) => p.id === fid)
    issues.push({
      type: 'unresolved_foreshadow',
      message: `伏笔 "${point?.description ?? fid}" 在第 ${point?.chapter ?? '?'} 章后未回收`,
      severity: 'warning',
    })
  }

  for (const char of story.characters.values()) {
    for (const rel of char.relations) {
      const target = story.characters.get(rel.targetId)
      if (!target) {
        issues.push({
          type: 'relation_conflict',
          message: `角色 ${char.name} 的关系目标 ${rel.targetId} 不存在`,
          severity: 'critical',
        })
        continue
      }
      const reverse = target.relations.find((r) => r.targetId === char.id)
      if (reverse && !isRelationSymmetric(rel.relation, reverse.relation)) {
        issues.push({
          type: 'relation_conflict',
          message: `角色 ${char.name} 与 ${target.name} 的关系不对称（${rel.relation} vs ${reverse.relation}）`,
          severity: 'warning',
        })
      }
    }
  }
  return issues
}

/** 角色一致性检查(LLM 驱动,规则降级)。 */
export async function checkConsistency(storyId: string): Promise<ConsistencyIssue[]> {
  const story = getStory(storyId)
  if (!story) return []

  try {
    const charactersCtx = Array.from(story.characters.values()).map((c) => ({
      name: c.name,
      traits: c.traits,
      relations: c.relations.map((r) => ({
        target: story.characters.get(r.targetId)?.name ?? r.targetId,
        relation: r.relation,
      })),
    }))
    const plotCtx = story.plotPoints.map((p) => ({
      chapter: p.chapter,
      type: p.type,
      description: p.description,
    }))
    const unresolved = Array.from(story.unresolvedForeshadows)
      .map((id) => story.plotPoints.find((p) => p.id === id)?.description ?? id)
    const relationRules = Object.entries(SYMMETRIC_PAIRS)
      .map(([k, v]) => `${k}↔${v}`)
      .join(', ')

    const messages: LlmMessage[] = [
      {
        role: 'system',
        content: `你是剧情一致性检查专家。基于角色设定、情节节点和未回收伏笔,检测冲突。参考关系对称规则:${relationRules}。返回 JSON 数组:[{"type":"trait_conflict|relation_conflict|unresolved_foreshadow","message":"string","severity":"info|warning|critical"}]。无问题时返回 []。只返回 JSON。`,
      },
      {
        role: 'user',
        content: JSON.stringify({ characters: charactersCtx, plotPoints: plotCtx, unresolvedForeshadows: unresolved }, null, 2),
      },
    ]
    const result = await callRealLlm({ messages, temperature: 0.1, maxTokens: 1000 })
    const parsed = extractJson(result.content) as ConsistencyIssue[] | null
    if (Array.isArray(parsed)) return parsed
  } catch {
    // LLM 不可用,降级到规则检查
  }

  return checkConsistencyRuleBased(story)
}

/** 情节节奏分析：基于四幕结构的覆盖率评分。 */
export interface PacingAnalysis {
  totalPoints: number
  byType: Record<PlotPoint['type'], number>
  score: number // 0~100
  suggestions: string[]
}

/** 规则版节奏分析(LLM 降级用)。 */
function analyzePacingRuleBased(story: StoryState): PacingAnalysis {
  const byType = { setup: 0, foreshadow: 0, conflict: 0, climax: 0, resolution: 0 } as Record<
    PlotPoint['type'],
    number
  >
  for (const p of story.plotPoints) byType[p.type]++
  const total = story.plotPoints.length

  const suggestions: string[] = []
  if (byType.setup === 0) suggestions.push('缺少开场设定（setup），读者难以进入')
  if (byType.climax === 0) suggestions.push('缺少高潮节点（climax），节奏平淡')
  if (byType.resolution === 0) suggestions.push('缺少结尾收束（resolution）')
  if (byType.foreshadow > total * 0.4) suggestions.push('伏笔过多，可能难以全部回收')

  const expected = total / 4
  const deviations = ['setup', 'conflict', 'climax', 'resolution'].map(
    (t) => Math.abs(byType[t as PlotPoint['type']] - expected) / Math.max(expected, 1),
  )
  const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length
  const score = Math.max(0, Math.round(100 - avgDeviation * 50))
  return { totalPoints: total, byType, score, suggestions }
}

/** 情节节奏分析(LLM 驱动,规则降级)。 */
export async function analyzePacing(storyId: string): Promise<PacingAnalysis> {
  const story = getStory(storyId)
  if (!story) {
    return {
      totalPoints: 0,
      byType: {} as Record<PlotPoint['type'], number>,
      score: 0,
      suggestions: ['故事不存在'],
    }
  }

  // 规则统计作为 LLM 的上下文输入
  const ruleBased = analyzePacingRuleBased(story)

  try {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          '你是情节节奏分析专家。基于情节节点分布和统计,评估节奏并给出改进建议。返回 JSON:{"score":0~100,"suggestions":["string"]}。只返回 JSON。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          totalPoints: ruleBased.totalPoints,
          byType: ruleBased.byType,
          plotPoints: story.plotPoints.map((p) => ({ chapter: p.chapter, type: p.type, description: p.description })),
        }),
      },
    ]
    const result = await callRealLlm({ messages, temperature: 0.2, maxTokens: 800 })
    const parsed = extractJson(result.content) as { score?: number; suggestions?: string[] } | null
    if (parsed && typeof parsed.score === 'number' && Array.isArray(parsed.suggestions)) {
      return {
        totalPoints: ruleBased.totalPoints,
        byType: ruleBased.byType,
        score: parsed.score,
        suggestions: parsed.suggestions,
      }
    }
  } catch {
    // LLM 不可用,降级到规则统计
  }

  return ruleBased
}

/** 规则版章节大纲建议(LLM 降级用)。 */
function suggestChapterOutlineRuleBased(
  analysis: PacingAnalysis,
  chapterNumber: number,
): string[] {
  const suggestions: string[] = [`第 ${chapterNumber} 章建议聚焦：`]
  if (analysis.byType.setup < 2) suggestions.push('- 完成主要角色设定与场景铺垫')
  if (analysis.byType.conflict < analysis.totalPoints * 0.3) {
    suggestions.push('- 引入核心冲突，推动情节上升')
  }
  if (analysis.byType.foreshadow < 2) suggestions.push('- 埋设 1-2 个伏笔，为后续章节做铺垫')
  if (chapterNumber > 5 && analysis.byType.climax === 0) {
    suggestions.push('- 进入中段高潮，回收部分伏笔')
  }
  if (suggestions.length === 1) suggestions.push('- 继续推进主线，保持节奏')
  return suggestions
}

/** 生成章节大纲建议(LLM 驱动,规则降级)。 */
export async function suggestChapterOutline(
  storyId: string,
  chapterNumber: number,
): Promise<string[]> {
  const story = getStory(storyId)
  if (!story) return []
  const analysis = await analyzePacing(storyId)

  try {
    const messages: LlmMessage[] = [
      {
        role: 'system',
        content:
          '你是章节大纲顾问。基于故事状态和节奏分析,为指定章节生成大纲建议。返回 JSON 字符串数组:["建议1","建议2"]。只返回 JSON。',
      },
      {
        role: 'user',
        content: JSON.stringify({
          title: story.title,
          chapterNumber,
          pacingScore: analysis.score,
          byType: analysis.byType,
          characters: Array.from(story.characters.values()).map((c) => c.name),
          recentPlotPoints: story.plotPoints.slice(-5).map((p) => p.description),
        }),
      },
    ]
    const result = await callRealLlm({ messages, temperature: 0.3, maxTokens: 600 })
    const parsed = extractJson(result.content) as string[] | null
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch {
    // LLM 不可用,降级到规则建议
  }

  return suggestChapterOutlineRuleBased(analysis, chapterNumber)
}
