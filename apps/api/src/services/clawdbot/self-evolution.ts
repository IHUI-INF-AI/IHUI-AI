/**
 * Clawdbot Self-Evolution - 自我进化引擎
 *
 * 行为学习、策略优化、技能自动生成。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getSkillManager } from './skills.js'
import { getMemoryService } from './memory.js'
import { generateCompactId } from '../../utils/crypto-random.js'

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

      // 简化实现：实际需要调用 AI 生成技能代码
      const skillName = `auto_skill_${task.id.slice(-6)}`
      task.status = 'installing'

      getSkillManager().install({
        name: skillName,
        description: gap.description,
        version: '0.1.0',
        category: 'auto_generated',
        steps: [],
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
