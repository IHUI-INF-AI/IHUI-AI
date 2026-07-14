import type { ChatRequest, UnifiedAIOrchestrator } from './unified-ai-orchestrator.js'
import { logger } from '../utils/logger.js'

export interface WorkflowStep {
  id: string
  name: string
  prompt: string
  model?: string
  dependsOn?: string[]
  condition?: (results: Record<string, string>) => boolean
}

export interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
}

export interface WorkflowResult {
  stepId: string
  output: string
  success: boolean
  error?: string
}

export class WorkflowError extends Error {
  constructor(
    message: string,
    readonly workflowId?: string,
    readonly stepId?: string,
  ) {
    super(message)
    this.name = 'WorkflowError'
  }
}

export class AIWorkflowOrchestrator {
  constructor(private readonly orchestrator: UnifiedAIOrchestrator) {}

  async execute(
    workflow: Workflow,
    context: Record<string, string> = {},
  ): Promise<WorkflowResult[]> {
    this.validateDeps(workflow)
    const results = new Map<string, WorkflowResult>()
    const outputs: Record<string, string> = { ...context }
    const pending = new Set(workflow.steps.map((s) => s.id))
    const failed = new Set<string>()

    while (pending.size > 0) {
      const ready = this.findReady(workflow, pending, results, failed)
      if (ready.length === 0) {
        for (const id of pending) {
          results.set(id, { stepId: id, output: '', success: false, error: '依赖步骤失败或未执行' })
        }
        break
      }
      await Promise.all(ready.map((step) => this.runStep(step, outputs, results)))
      for (const step of ready) {
        pending.delete(step.id)
        const r = results.get(step.id)
        if (r && !r.success) failed.add(step.id)
      }
    }
    return workflow.steps.map((s) => results.get(s.id)!).filter(Boolean)
  }

  private async runStep(
    step: WorkflowStep,
    outputs: Record<string, string>,
    results: Map<string, WorkflowResult>,
  ): Promise<void> {
    if (step.condition && !step.condition(outputs)) {
      results.set(step.id, {
        stepId: step.id,
        output: '',
        success: true,
        error: '条件不满足,已跳过',
      })
      return
    }
    const prompt = this.injectContext(step.prompt, outputs)
    try {
      const req: ChatRequest = {
        messages: [{ role: 'user', content: prompt }],
        ...(step.model && { model: step.model }),
      }
      const resp = await this.orchestrator.chat(req)
      outputs[step.id] = resp.content
      results.set(step.id, { stepId: step.id, output: resp.content, success: true })
    } catch (err) {
      const msg = (err as Error).message
      logger.error('工作流步骤失败', { stepId: step.id, error: msg })
      results.set(step.id, { stepId: step.id, output: '', success: false, error: msg })
    }
  }

  private findReady(
    workflow: Workflow,
    pending: Set<string>,
    results: Map<string, WorkflowResult>,
    failed: Set<string>,
  ): WorkflowStep[] {
    const ready: WorkflowStep[] = []
    for (const step of workflow.steps) {
      if (!pending.has(step.id)) continue
      const deps = step.dependsOn ?? []
      if (deps.length === 0) {
        ready.push(step)
        continue
      }
      if (deps.some((d) => failed.has(d))) continue
      if (deps.every((d) => results.has(d))) ready.push(step)
    }
    return ready
  }

  private injectContext(prompt: string, outputs: Record<string, string>): string {
    return prompt.replace(/\{\{(\w+)\}\}/g, (_, key: string) => outputs[key] ?? '')
  }

  private validateDeps(workflow: Workflow): void {
    const ids = new Set(workflow.steps.map((s) => s.id))
    for (const step of workflow.steps) {
      for (const dep of step.dependsOn ?? []) {
        if (dep === step.id)
          throw new WorkflowError(`步骤 ${step.id} 不能依赖自身`, workflow.id, step.id)
        if (!ids.has(dep))
          throw new WorkflowError(`步骤 ${step.id} 依赖不存在的步骤: ${dep}`, workflow.id, step.id)
      }
    }
    this.detectCycle(workflow)
  }

  private detectCycle(workflow: Workflow): void {
    const adj = new Map<string, string[]>()
    for (const s of workflow.steps) adj.set(s.id, s.dependsOn ?? [])
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const dfs = (id: string): void => {
      if (visiting.has(id))
        throw new WorkflowError(`检测到循环依赖,涉及步骤: ${id}`, workflow.id, id)
      if (visited.has(id)) return
      visiting.add(id)
      for (const dep of adj.get(id) ?? []) dfs(dep)
      visiting.delete(id)
      visited.add(id)
    }
    for (const s of workflow.steps) dfs(s.id)
  }
}
