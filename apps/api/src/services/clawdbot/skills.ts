// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * Clawdbot Skills - 技能系统
 *
 * 技能注册、调用、组合。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getToolExecutor, type ToolContext } from './tools.js'
import { evaluateSafeCondition } from './safe-condition.js'
import { startStopwatch } from '../../utils/elapsed-ms.js'

export interface SkillDefinition {
  name: string
  description: string
  version: string
  category: string
  steps: SkillStep[]
  enabled: boolean
  source: 'auto_generated' | 'community' | 'official' | 'custom'
  installedAt: number
}

export interface SkillStep {
  id: string
  name: string
  toolName?: string
  toolParams?: Record<string, unknown>
  condition?: string
  outputKey?: string
}

export interface SkillExecutionResult {
  skillName: string
  success: boolean
  outputs: Record<string, unknown>
  stepResults: Array<{ stepId: string; success: boolean; output?: unknown; error?: string }>
  duration: number
  /** 格②(2026-09-26):false = duration 未通过时钟交叉校验,只可观测不可当结论消费 */
  latencyTrusted?: boolean
}

export class SkillManager extends EventEmitter {
  private skills = new Map<string, SkillDefinition>()

  install(skill: Omit<SkillDefinition, 'installedAt'>): void {
    const def: SkillDefinition = { ...skill, installedAt: Date.now() }
    this.skills.set(skill.name, def)
    logger.info({ skill: skill.name, version: skill.version }, '[Skills] Installed')
    this.emit('installed', def)
  }

  uninstall(name: string): boolean {
    const removed = this.skills.delete(name)
    if (removed) this.emit('uninstalled', name)
    return removed
  }

  get(name: string): SkillDefinition | undefined {
    return this.skills.get(name)
  }

  list(): SkillDefinition[] {
    return Array.from(this.skills.values())
  }

  listByCategory(category: string): SkillDefinition[] {
    return this.list().filter((s) => s.category === category)
  }

  async execute(
    name: string,
    initialParams: Record<string, unknown>,
    context?: ToolContext,
  ): Promise<SkillExecutionResult> {
    const skill = this.skills.get(name)
    if (!skill) throw new Error(`Skill "${name}" not found`)
    if (!skill.enabled) throw new Error(`Skill "${name}" is disabled`)

    const sw = startStopwatch()
    const outputs: Record<string, unknown> = { ...initialParams }
    const stepResults: SkillExecutionResult['stepResults'] = []
    const toolExecutor = getToolExecutor()

    for (const step of skill.steps) {
      if (step.condition && !this.evaluateCondition(step.condition, outputs)) {
        stepResults.push({ stepId: step.id, success: true, output: 'skipped' })
        continue
      }
      if (step.toolName) {
        const params = this.resolveParams(step.toolParams ?? {}, outputs)
        const result = await toolExecutor.execute(step.toolName, params, context)
        stepResults.push({
          stepId: step.id,
          success: result.success,
          output: result.output,
          error: result.error,
        })
        if (!result.success) {
          const sample = sw.stop()
          return {
            skillName: name,
            success: false,
            outputs,
            stepResults,
            duration: sample.elapsedMs ?? sample.perfMs,
            latencyTrusted: sample.trustworthy,
          }
        }
        if (step.outputKey) outputs[step.outputKey] = result.output
      }
    }

    // 一次 stop 同时喂日志与返回值(旧写法 Date.now()-start 各算一遍是两把尺子)
    const sample = sw.stop()
    logger.info(
      {
        skill: name,
        duration: sample.elapsedMs ?? sample.perfMs,
        latencyTrusted: sample.trustworthy,
      },
      '[Skills] Executed',
    )
    return {
      skillName: name,
      success: true,
      outputs,
      stepResults,
      duration: sample.elapsedMs ?? sample.perfMs,
      latencyTrusted: sample.trustworthy,
    }
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    // 2026-07-21 安全审计加固:用 safe-condition 替代 new Function 防止 RCE
    return evaluateSafeCondition(condition, context)
  }

  private resolveParams(
    params: Record<string, unknown>,
    context: Record<string, unknown>,
  ): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const path = value.slice(2, -1)
        resolved[key] = path
          .split('.')
          .reduce<unknown>(
            (obj: unknown, k: string) => (obj as Record<string, unknown>)?.[k],
            context,
          )
      } else {
        resolved[key] = value
      }
    }
    return resolved
  }

  getStats() {
    return {
      total: this.skills.size,
      enabled: this.list().filter((s) => s.enabled).length,
      categories: Array.from(new Set(this.list().map((s) => s.category))),
    }
  }
}

let instance: SkillManager | null = null

export function getSkillManager(): SkillManager {
  if (!instance) instance = new SkillManager()
  return instance
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
