/**
 * Clawdbot Task Executor - 任务执行器
 *
 * 任务调度、执行、结果收集。
 */
import { EventEmitter } from 'node:events'
import { logger } from './logger.js'
import { getToolExecutor, type ToolContext } from './tools.js'

export type TaskType = 'single' | 'sequential' | 'parallel' | 'conditional'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused'
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent'

export interface TaskStep {
  id: string
  name: string
  type: 'tool' | 'condition' | 'loop' | 'wait' | 'human_input' | 'ai_decision'
  toolName?: string
  toolParams?: Record<string, unknown>
  condition?: string
  outputKey?: string
  timeout?: number
}

export interface Task {
  id: string
  name: string
  description: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  createdAt: number
  startedAt?: number
  completedAt?: number
  steps: TaskStep[]
  currentStepIndex: number
  context: Record<string, unknown>
  result?: TaskResult
  retryCount: number
  maxRetries: number
  timeout?: number
  parentTaskId?: string
  childTaskIds?: string[]
  dependsOn?: string[]
}

export interface TaskResult {
  success: boolean
  outputs: Record<string, unknown>
  error?: string
  stepResults: Array<{ stepId: string; success: boolean; output?: unknown; error?: string }>
}

export class TaskExecutor extends EventEmitter {
  private tasks = new Map<string, Task>()
  private running = new Set<string>()
  private maxConcurrent = 5

  create(params: {
    name: string
    description: string
    type?: TaskType
    priority?: TaskPriority
    steps: TaskStep[]
    context?: Record<string, unknown>
    maxRetries?: number
    timeout?: number
    dependsOn?: string[]
    parentTaskId?: string
  }): Task {
    const task: Task = {
      id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: params.name,
      description: params.description,
      type: params.type ?? 'sequential',
      status: 'pending',
      priority: params.priority ?? 'normal',
      createdAt: Date.now(),
      steps: params.steps,
      currentStepIndex: 0,
      context: params.context ?? {},
      retryCount: 0,
      maxRetries: params.maxRetries ?? 3,
      timeout: params.timeout,
      dependsOn: params.dependsOn,
      parentTaskId: params.parentTaskId,
    }
    this.tasks.set(task.id, task)
    logger.info({ taskId: task.id, name: task.name }, '[Task] Created')
    this.emit('created', task)
    return task
  }

  async execute(taskId: string, context?: ToolContext): Promise<TaskResult> {
    const task = this.tasks.get(taskId)
    if (!task) throw new Error(`Task "${taskId}" not found`)
    if (task.status === 'running') throw new Error('Task already running')

    if (task.dependsOn?.length) {
      for (const depId of task.dependsOn) {
        const dep = this.tasks.get(depId)
        if (!dep || dep.status !== 'completed') {
          task.status = 'pending'
          logger.info({ taskId, depId }, '[Task] Waiting for dependency')
          return { success: false, outputs: {}, error: 'Waiting for dependencies', stepResults: [] }
        }
      }
    }

    if (this.running.size >= this.maxConcurrent) {
      task.status = 'pending'
      return { success: false, outputs: {}, error: 'Max concurrent tasks reached', stepResults: [] }
    }

    task.status = 'running'
    task.startedAt = Date.now()
    this.running.add(taskId)
    this.emit('started', task)

    const toolExecutor = getToolExecutor()
    const outputs: Record<string, unknown> = { ...task.context }
    const stepResults: TaskResult['stepResults'] = []

    for (let i = 0; i < task.steps.length; i++) {
      task.currentStepIndex = i
      const step = task.steps[i]
      if (!step) continue

      if (step.type === 'condition' && step.condition) {
        const matched = this.evaluateCondition(step.condition, outputs)
        stepResults.push({ stepId: step.id, success: true, output: matched })
        if (!matched) continue
      }

      if (step.type === 'wait') {
        await new Promise((resolve) => setTimeout(resolve, (step.toolParams?.ms as number) ?? 1000))
        stepResults.push({ stepId: step.id, success: true })
        continue
      }

      if (step.toolName) {
        const params = this.resolveParams(step.toolParams ?? {}, outputs)
        const result = await toolExecutor.execute(step.toolName, params, context)
        stepResults.push({ stepId: step.id, success: result.success, output: result.output, error: result.error })
        if (!result.success) {
          task.status = 'failed'
          task.completedAt = Date.now()
          task.result = { success: false, outputs, error: result.error, stepResults }
          this.running.delete(taskId)
          this.emit('failed', task)
          return task.result
        }
        if (step.outputKey) outputs[step.outputKey] = result.output
      }
    }

    task.status = 'completed'
    task.completedAt = Date.now()
    task.result = { success: true, outputs, stepResults }
    this.running.delete(taskId)
    logger.info({ taskId, duration: task.completedAt - (task.startedAt ?? 0) }, '[Task] Completed')
    this.emit('completed', task)
    return task.result
  }

  cancel(taskId: string): boolean {
    const task = this.tasks.get(taskId)
    if (!task) return false
    task.status = 'cancelled'
    task.completedAt = Date.now()
    this.running.delete(taskId)
    this.emit('cancelled', task)
    return true
  }

  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  list(filter?: { status?: TaskStatus; priority?: TaskPriority }): Task[] {
    let tasks = Array.from(this.tasks.values())
    if (filter?.status) tasks = tasks.filter((t) => t.status === filter.status)
    if (filter?.priority) tasks = tasks.filter((t) => t.priority === filter.priority)
    return tasks.sort((a, b) => b.createdAt - a.createdAt)
  }

  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    try {
      const fn = new Function('ctx', `with(ctx){return ${condition}}`)
      return !!fn(context)
    } catch {
      return false
    }
  }

  private resolveParams(params: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const path = value.slice(2, -1)
        resolved[key] = path.split('.').reduce<unknown>((obj: unknown, k: string) => (obj as Record<string, unknown>)?.[k], context)
      } else {
        resolved[key] = value
      }
    }
    return resolved
  }

  getStatus() {
    const tasks = Array.from(this.tasks.values())
    return {
      totalTasks: tasks.length,
      runningTasks: this.running.size,
      pendingTasks: tasks.filter((t) => t.status === 'pending').length,
      completedTasks: tasks.filter((t) => t.status === 'completed').length,
      failedTasks: tasks.filter((t) => t.status === 'failed').length,
    }
  }
}

let instance: TaskExecutor | null = null

export function getTaskExecutor(): TaskExecutor {
  if (!instance) instance = new TaskExecutor()
  return instance
}
