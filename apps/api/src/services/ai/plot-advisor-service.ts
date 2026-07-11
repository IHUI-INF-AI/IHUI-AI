/**
 * 剧情顾问服务。
 *
 * 为长篇叙事内容（小说/剧本/漫画脚本）提供 AI 辅助：
 * - 角色一致性检查：跨章节角色设定冲突检测
 * - 情节节奏分析：基于"开场-发展-高潮-结尾"结构评分
 * - 伏笔追踪：记录已埋伏笔与回收情况
 * - 章节大纲生成：基于主线生成章节级 outline
 *
 * 状态保存在内存（按 storyId），适合单实例或会话级使用。
 * 如需持久化，可由调用方序列化到 DB。
 */

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

/** 角色一致性检查：跨章节冲突检测（简化版）。 */
export interface ConsistencyIssue {
  type: 'trait_conflict' | 'relation_conflict' | 'unresolved_foreshadow'
  message: string
  severity: 'info' | 'warning' | 'critical'
}

export function checkConsistency(storyId: string): ConsistencyIssue[] {
  const story = getStory(storyId)
  if (!story) return []
  const issues: ConsistencyIssue[] = []

  // 检查未回收的伏笔
  for (const fid of story.unresolvedForeshadows) {
    const point = story.plotPoints.find((p) => p.id === fid)
    issues.push({
      type: 'unresolved_foreshadow',
      message: `伏笔 "${point?.description ?? fid}" 在第 ${point?.chapter ?? '?'} 章后未回收`,
      severity: 'warning',
    })
  }

  // 检查角色关系对称性（A 是 B 的父亲，B 不能也是 A 的父亲）
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

/** 情节节奏分析：基于四幕结构的覆盖率评分。 */
export interface PacingAnalysis {
  totalPoints: number
  byType: Record<PlotPoint['type'], number>
  score: number // 0~100
  suggestions: string[]
}

export function analyzePacing(storyId: string): PacingAnalysis {
  const story = getStory(storyId)
  if (!story) {
    return {
      totalPoints: 0,
      byType: {} as Record<PlotPoint['type'], number>,
      score: 0,
      suggestions: ['故事不存在'],
    }
  }
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

  // 评分：四幕各占 25%权重
  const expected = total / 4
  const deviations = ['setup', 'conflict', 'climax', 'resolution'].map(
    (t) => Math.abs(byType[t as PlotPoint['type']] - expected) / Math.max(expected, 1),
  )
  const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length
  const score = Math.max(0, Math.round(100 - avgDeviation * 50))
  return { totalPoints: total, byType, score, suggestions }
}

/** 生成章节大纲建议。 */
export function suggestChapterOutline(storyId: string, chapterNumber: number): string[] {
  const story = getStory(storyId)
  if (!story) return []
  const analysis = analyzePacing(storyId)
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
