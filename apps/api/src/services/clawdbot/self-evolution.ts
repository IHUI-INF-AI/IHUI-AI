/**
 * Clawdbot Self-Evolution - 自我进化引擎
 *
 * 行为学习、策略优化、技能自动生成。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getSkillManager, type SkillStep } from './skills.js'
import { getMemoryService } from './memory.js'
import { generateCompactId } from '../../utils/crypto-random.js'
import { callRealLlm, type LlmMessage } from '../crew-llm-adapter.js'
import { config } from '../../config/index.js'

export interface EvolutionTask {
  id: string
  type: 'skill_creation' | 'skill_improvement' | 'tool_creation' | 'learning' | 'optimization'
  description: string
  trigger: string
  status: 'pending' | 'analyzing' | 'generating' | 'testing' | 'installing' | 'completed' | 'failed'
  createdAt: number
  completedAt?: number
  result?: { success: boolean; skillName?: string; error?: string }
}

export interface SkillInstallation {
  name: string
  description: string
  version: string
  installedAt: number
  source: 'auto_generated' | 'community' | 'official' | 'custom'
}

export interface BehaviorPattern {
  id: string
  pattern: string
  frequency: number
  successRate: number
  lastSeen: number
  context?: Record<string, unknown>
}

export interface CapabilityGap {
  id: string
  description: string
  detectedAt: number
  severity: 'low' | 'medium' | 'high'
  resolved: boolean
}

/**
 * 将自进化生成的 skill 同步发布到技能市场(POST /api/skills/market)。
 * 形成"进化→市场→使用→反馈→再进化"闭环:进化产物可被市场搜索/安装/评分。
 * 失败不阻塞主流程,仅 logger.warn。
 */
async function publishEvolvedSkillToMarket(params: {
  name: string
  description: string
  version: string
  steps: SkillStep[]
}): Promise<void> {
  const baseUrl = `http://localhost:${config.PORT}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.AI_CALLBACK_SECRET) {
    headers['X-Internal-Secret'] = config.AI_CALLBACK_SECRET
  }
  try {
    const resp = await fetch(`${baseUrl}/api/skills/market`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: params.name,
        description: params.description,
        tags: ['auto_generated', 'evolution'],
        author: 'clawdbot-self-evolution',
        version: params.version,
        license: 'MIT',
        content: JSON.stringify(params.steps),
      }),
    })
    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      logger.warn(
        { status: resp.status, body: text, skillName: params.name },
        '[Evolution] 同步 skill 到市场失败:HTTP 非 2xx',
      )
    } else {
      logger.info({ skillName: params.name }, '[Evolution] skill 已同步到市场')
    }
  } catch (e) {
    logger.warn({ err: e, skillName: params.name }, '[Evolution] 同步 skill 到市场失败:网络错误')
  }
}

export class SelfEvolutionEngine extends EventEmitter {
  private evolutionTasks = new Map<string, EvolutionTask>()
  private patterns = new Map<string, BehaviorPattern>()
  private gaps = new Map<string, CapabilityGap>()
  private autoEvolve = false

  enableAutoEvolution(): void {
    this.autoEvolve = true
    logger.info('[Evolution] Auto-evolution enabled')
    this.emit('autoEvolveEnabled')
  }

  disableAutoEvolution(): void {
    this.autoEvolve = false
    logger.info('[Evolution] Auto-evolution disabled')
    this.emit('autoEvolveDisabled')
  }

  recordBehavior(pattern: string, success: boolean, context?: Record<string, unknown>): void {
    const key = pattern
    let existing = this.patterns.get(key)
    if (!existing) {
      existing = {
        // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成行为模式 ID
        id: generateCompactId('pat'),
        pattern,
        frequency: 0,
        successRate: 0,
        lastSeen: Date.now(),
        context,
      }
      this.patterns.set(key, existing)
    }
    existing.frequency++
    const successCount = existing.successRate * (existing.frequency - 1) + (success ? 1 : 0)
    existing.successRate = successCount / existing.frequency
    existing.lastSeen = Date.now()
    this.emit('behaviorRecorded', existing)

    if (this.autoEvolve && existing.frequency > 10 && existing.successRate < 0.5) {
      this.detectGap(`Low success rate for pattern: ${pattern}`, 'medium')
    }
  }

  detectGap(description: string, severity: CapabilityGap['severity']): CapabilityGap {
    const gap: CapabilityGap = {
      id: `gap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      description,
      detectedAt: Date.now(),
      severity,
      resolved: false,
    }
    this.gaps.set(gap.id, gap)
    logger.info({ gapId: gap.id, description, severity }, '[Evolution] Gap detected')
    this.emit('gapDetected', gap)
    return gap
  }

  async evolve(gapId?: string): Promise<EvolutionTask> {
    const gap = gapId
      ? this.gaps.get(gapId)
      : Array.from(this.gaps.values()).find((g) => !g.resolved)
    if (!gap) throw new Error('No gap to evolve')

    const task: EvolutionTask = {
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成进化任务 ID
      id: generateCompactId('evo'),
      type: 'skill_creation',
      description: gap.description,
      trigger: gapId ?? 'auto',
      status: 'analyzing',
      createdAt: Date.now(),
    }
    this.evolutionTasks.set(task.id, task)
    this.emit('taskStarted', task)

    try {
      task.status = 'generating'
      this.emit('taskProgress', task)

      const skillName = `auto_skill_${task.id.slice(-6)}`

      // 调 LLM 生成技能步骤(传入能力差距 + 现有技能上下文)
      let steps: SkillStep[] = []
      try {
        const existingSkills = getSkillManager().list().slice(0, 10).map((s) => ({
          name: s.name,
          description: s.description,
          stepCount: s.steps.length,
        }))
        const messages: LlmMessage[] = [
          {
            role: 'system',
            content:
              '你是技能代码生成器。根据能力差距描述,生成技能步骤数组。每步含:id(string),name(string),toolName(string,可选),toolParams(object,可选),condition(string,可选),outputKey(string,可选)。返回 JSON 数组:[{"id":"step1","name":"...","toolName":"...","toolParams":{}}]。只返回 JSON。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              gap: gap.description,
              severity: gap.severity,
              existingSkills,
            }),
          },
        ]
        const llmResult = await callRealLlm({ messages, temperature: 0.2, maxTokens: 800 })
        const parsed = JSON.parse(
          llmResult.content.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1] ?? llmResult.content,
        ) as SkillStep[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          steps = parsed.map((s, i) => ({
            id: s.id ?? `step_${i + 1}`,
            name: s.name ?? `Step ${i + 1}`,
            ...(s.toolName ? { toolName: s.toolName } : {}),
            ...(s.toolParams ? { toolParams: s.toolParams } : {}),
            ...(s.condition ? { condition: s.condition } : {}),
            ...(s.outputKey ? { outputKey: s.outputKey } : {}),
          }))
        }
      } catch (e) {
        logger.warn({ err: e }, '[Evolution] LLM 生成技能步骤失败,降级为空数组')
      }

      task.status = 'installing'

      getSkillManager().install({
        name: skillName,
        description: gap.description,
        version: '0.1.0',
        category: 'auto_generated',
        steps,
        enabled: true,
        source: 'auto_generated',
      })

      // 记录到长期记忆
      getMemoryService().store({
        type: 'long_term',
        content: `Evolved skill "${skillName}" for gap: ${gap.description}`,
        importance: 0.8,
        tags: ['evolution', 'skill', skillName],
      })

      // 同步到技能市场:让进化产物可被搜索/安装/评分(失败不阻塞)
      await publishEvolvedSkillToMarket({
        name: skillName,
        description: gap.description,
        version: '0.1.0',
        steps,
      })

      task.status = 'completed'
      task.completedAt = Date.now()
      task.result = { success: true, skillName }
      gap.resolved = true
      this.emit('taskCompleted', task)
      this.emit('skillInstalled', {
        name: skillName,
        description: gap.description,
        version: '0.1.0',
        installedAt: Date.now(),
        source: 'auto_generated',
      } satisfies SkillInstallation)
    } catch (err) {
      task.status = 'failed'
      task.completedAt = Date.now()
      task.result = { success: false, error: (err as Error).message }
      this.emit('taskFailed', task)
    }

    return task
  }

  getEvolutionTask(id: string): EvolutionTask | undefined {
    return this.evolutionTasks.get(id)
  }

  listEvolutionTasks(): EvolutionTask[] {
    return Array.from(this.evolutionTasks.values())
  }

  listPatterns(): BehaviorPattern[] {
    return Array.from(this.patterns.values()).sort((a, b) => b.frequency - a.frequency)
  }

  listGaps(includeResolved = false): CapabilityGap[] {
    return Array.from(this.gaps.values()).filter((g) => includeResolved || !g.resolved)
  }

  getStatus() {
    return {
      skillsCount: getSkillManager().getStats().total,
      gapsCount: this.gaps.size - Array.from(this.gaps.values()).filter((g) => g.resolved).length,
      autoEvolve: this.autoEvolve,
      patternsCount: this.patterns.size,
      evolutionTasks: this.evolutionTasks.size,
    }
  }
}

let instance: SelfEvolutionEngine | null = null

export function getSelfEvolutionEngine(): SelfEvolutionEngine {
  if (!instance) instance = new SelfEvolutionEngine()
  return instance
}
