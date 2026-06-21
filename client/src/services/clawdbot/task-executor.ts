import { t } from '@/utils/i18n'

/**
 * Clawdbot Task Executor
 * 
 * AI 任务执行器，负责:
 * - 任务规划和分解
 * - 多步骤任务执行
 * - 任务状态跟踪
 * - 错误恢复和重试
 * - 任务依赖管理
 */

import { ref, reactive } from 'vue'
import { logger } from '@/utils/logger'
import { EventEmitter } from '@/utils/event-emitter'
import { getToolExecutor } from './tools'
import type { ToolExecutionResult } from './tools'
import { evaluateCondition } from '@/utils/safe-evaluator'

/**
 * 任务定义
 */
export interface Task {
  /** 任务 ID */
  id: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 任务类型 */
  type: 'single' | 'sequential' | 'parallel' | 'conditional'
  /** 任务状态 */
  status: TaskStatus
  /** 优先级 */
  priority: 'low' | 'normal' | 'high' | 'urgent'
  /** 创建时间 */
  createdAt: number
  /** 开始时间 */
  startedAt?: number
  /** 完成时间 */
  completedAt?: number
  /** 步骤列表 */
  steps: TaskStep[]
  /** 当前步骤索引 */
  currentStepIndex: number
  /** 上下文数据 */
  context: Record<string, unknown>
  /** 结果 */
  result?: TaskResult
  /** 重试次数 */
  retryCount: number
  /** 最大重试次数 */
  maxRetries: number
  /** 超时时间 (ms) */
  timeout?: number
  /** 父任务 ID */
  parentTaskId?: string
  /** 子任务 ID 列表 */
  childTaskIds?: string[]
  /** 依赖的任务 ID 列表 */
  dependsOn?: string[]
}

/**
 * 任务步骤
 */
export interface TaskStep {
  /** 步骤 ID */
  id: string
  /** 步骤名称 */
  name: string
  /** 步骤类型 */
  type: 'tool' | 'condition' | 'loop' | 'wait' | 'human_input' | 'ai_decision'
  /** 工具名称（当 type 为 tool 时） */
  toolName?: string
  /** 工具参数 */
  toolParams?: Record<string, unknown>
  /** 条件表达式（当 type 为 condition 时） */
  condition?: string
  /** 循环配置（当 type 为 loop 时） */
  loopConfig?: {
    maxIterations: number
    breakCondition?: string
  }
  /** 等待时间（当 type 为 wait 时） */
  waitTime?: number
  /** 步骤状态 */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  /** 步骤结果 */
  result?: ToolExecutionResult
  /** 开始时间 */
  startedAt?: number
  /** 完成时间 */
  completedAt?: number
}

/**
 * 任务状态
 */
export type TaskStatus = 
  | 'pending'      // 等待执行
  | 'planning'     // 规划中
  | 'running'      // 执行中
  | 'paused'       // 已暂停
  | 'waiting'      // 等待用户输入/依赖
  | 'completed'    // 已完成
  | 'failed'       // 失败
  | 'cancelled'    // 已取消

/**
 * 任务结果
 */
export interface TaskResult {
  /** 是否成功 */
  success: boolean
  /** 结果数据 */
  data?: any
  /** 错误信息 */
  error?: string
  /** 执行时间 */
  executionTime: number
  /** 步骤结果汇总 */
  stepResults: Array<{
    stepId: string
    stepName: string
    success: boolean
    output?: string
  }>
  /** 输出摘要 */
  summary?: string
}

/**
 * 任务计划
 */
export interface TaskPlan {
  /** 任务描述 */
  description: string
  /** 计划的步骤 */
  steps: Array<{
    name: string
    type: TaskStep['type']
    toolName?: string
    params?: Record<string, unknown>
    description: string
  }>
  /** 预计时间 */
  estimatedTime?: number
  /** 风险评估 */
  risks?: string[]
}

/**
 * 任务执行器
 */
export class TaskExecutor extends EventEmitter {
  private tasks = reactive<Map<string, Task>>(new Map())
  private runningTasks = ref<Set<string>>(new Set())
  private taskQueue = ref<string[]>([])
  
  // 配置
  private config = {
    maxConcurrentTasks: 5,
    defaultTimeout: 300000, // 5 分钟
    defaultMaxRetries: 3,
    autoRetryDelay: 1000,
  }

  constructor() {
    super()
  }

  /**
   * 创建任务
   */
  createTask(spec: {
    name: string
    description: string
    type?: Task['type']
    priority?: Task['priority']
    steps?: Omit<TaskStep, 'id' | 'status'>[]
    context?: Record<string, unknown>
    maxRetries?: number
    timeout?: number
    dependsOn?: string[]
  }): Task {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    
    const task: Task = {
      id: taskId,
      name: spec.name,
      description: spec.description,
      type: spec.type || 'sequential',
      status: 'pending',
      priority: spec.priority || 'normal',
      createdAt: Date.now(),
      steps: (spec.steps || []).map((step, index) => ({
        ...step,
        id: `step_${index}_${Math.random().toString(36).substring(2, 9)}`,
        status: 'pending' as const,
      })),
      currentStepIndex: 0,
      context: spec.context || {},
      retryCount: 0,
      maxRetries: spec.maxRetries ?? this.config.defaultMaxRetries,
      timeout: spec.timeout ?? this.config.defaultTimeout,
      dependsOn: spec.dependsOn,
    }
    
    this.tasks.set(taskId, task)
    this.emit('taskCreated', task)
    
    return task
  }

  /**
   * 从自然语言创建任务（AI 规划）
   */
  async createTaskFromNL(userRequest: string): Promise<Task> {
    logger.info('[TaskExecutor] Creating task from natural language:', userRequest)
    
    // 分析用户请求，生成任务计划
    const plan = await this.planTask(userRequest)
    
    // 创建任务
    const task = this.createTask({
      name: `任务: ${userRequest.substring(0, 50)}`,
      description: userRequest,
      type: 'sequential',
      steps: plan.steps.map(step => ({
        name: step.name,
        type: step.type,
        toolName: step.toolName,
        toolParams: step.params,
      })),
    })
    
    return task
  }

  /**
   * 规划任务
   */
  async planTask(description: string): Promise<TaskPlan> {
    // 分析任务描述，识别需要的步骤
    const steps: TaskPlan['steps'] = []
    const toolExecutor = getToolExecutor()
    const _availableTools = toolExecutor.getAllTools()
    
    // 简单的关键词匹配来规划步骤
    const lowerDesc = description.toLowerCase()
    
    // 检测浏览器相关任务
    if (lowerDesc.includes('打开') || lowerDesc.includes('访问') || lowerDesc.includes('网页') || lowerDesc.includes('browse')) {
      steps.push({
        name: '打开网页',
        type: 'tool',
        toolName: 'browser_navigate',
        params: { url: this.extractUrl(description) || 'https://www.google.com' },
        description: t('text.task_executor.导航到目标网页2'),
      })
    }
    
    // 检测点击操作
    if (lowerDesc.includes('点击') || lowerDesc.includes('click')) {
      steps.push({
        name: '点击元素',
        type: 'tool',
        toolName: 'browser_click',
        params: { selector: this.extractSelector(description) || 'button' },
        description: t('text.task_executor.点击页面元素3'),
      })
    }
    
    // 检测输入操作
    if (lowerDesc.includes('输入') || lowerDesc.includes('填写') || lowerDesc.includes('type')) {
      steps.push({
        name: '输入内容',
        type: 'tool',
        toolName: 'browser_type',
        params: { 
          selector: this.extractSelector(description) || 'input',
          text: this.extractText(description) || '',
        },
        description: t('text.task_executor.在输入框中输入内4'),
      })
    }
    
    // 检测文件操作
    if (lowerDesc.includes('读取') || lowerDesc.includes('文件') || lowerDesc.includes('read')) {
      steps.push({
        name: '读取文件',
        type: 'tool',
        toolName: 'read_file',
        params: { path: this.extractPath(description) || '' },
        description: t('text.task_executor.读取文件内容5'),
      })
    }
    
    // 检测命令执行
    if (lowerDesc.includes('执行') || lowerDesc.includes('运行') || lowerDesc.includes('命令') || lowerDesc.includes('execute')) {
      steps.push({
        name: '执行命令',
        type: 'tool',
        toolName: 'execute_command',
        params: { command: this.extractCommand(description) || '' },
        description: t('text.task_executor.执行Shell命6'),
      })
    }
    
    // 检测 API 调用
    if (lowerDesc.includes('api') || lowerDesc.includes('请求') || lowerDesc.includes('fetch')) {
      steps.push({
        name: '发送请求',
        type: 'tool',
        toolName: 'http_request',
        params: { 
          url: this.extractUrl(description) || '',
          method: 'GET',
        },
        description: t('text.task_executor.发送HTTP请求7'),
      })
    }
    
    // 如果没有识别到具体步骤，添加一个 AI 决策步骤
    if (steps.length === 0) {
      steps.push({
        name: 'AI 分析',
        type: 'ai_decision',
        description: t('text.task_executor.让AI分析并决定8'),
      })
    }
    
    return {
      description,
      steps,
      estimatedTime: steps.length * 5000, // 估计每步 5 秒
      risks: this.assessRisks(steps),
    }
  }

  /**
   * 提取 URL
   */
  private extractUrl(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/[^\s]+/)
    return urlMatch ? urlMatch[0] : null
  }

  /**
   * 提取选择器
   */
  private extractSelector(text: string): string | null {
    const selectorMatch = text.match(/[.#][a-zA-Z0-9_-]+/)
    return selectorMatch ? selectorMatch[0] : null
  }

  /**
   * 提取文本
   */
  private extractText(text: string): string {
    const quotedMatch = text.match(/["']([^"']+)["']/)
    return quotedMatch ? quotedMatch[1] : ''
  }

  /**
   * 提取路径
   */
  private extractPath(text: string): string | null {
    const pathMatch = text.match(/[/\\]?[\w./\\-]+\.\w+/)
    return pathMatch ? pathMatch[0] : null
  }

  /**
   * 提取命令
   */
  private extractCommand(text: string): string {
    const commandMatch = text.match(/`([^`]+)`/)
    return commandMatch ? commandMatch[1] : ''
  }

  /**
   * 评估风险
   */
  private assessRisks(steps: TaskPlan['steps']): string[] {
    const risks: string[] = []
    
    for (const step of steps) {
      if (step.toolName === 'execute_command') {
        risks.push('Shell 命令执行可能有安全风险')
      }
      if (step.toolName === 'write_file') {
        risks.push('文件写入操作可能覆盖重要数据')
      }
    }
    
    return risks
  }

  /**
   * 执行任务
   */
  async executeTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`)
    }
    
    // 检查依赖
    if (task.dependsOn && task.dependsOn.length > 0) {
      const unfinishedDeps = task.dependsOn.filter(depId => {
        const dep = this.tasks.get(depId)
        return !dep || dep.status !== 'completed'
      })
      
      if (unfinishedDeps.length > 0) {
        task.status = 'waiting'
        this.emit('taskWaiting', { task, waitingFor: unfinishedDeps })
        throw new Error(`等待依赖任务完成: ${unfinishedDeps.join(', ')}`)
      }
    }
    
    // 检查并发限制
    if (this.runningTasks.value.size >= this.config.maxConcurrentTasks) {
      this.taskQueue.value.push(taskId)
      task.status = 'pending'
      this.emit('taskQueued', task)
      throw new Error(t('error.task_executor.任务已加入队列等'))
    }
    
    // 开始执行
    task.status = 'running'
    task.startedAt = Date.now()
    this.runningTasks.value.add(taskId)
    this.emit('taskStarted', task)
    
    const startTime = Date.now()
    
    try {
      // 设置超时
      const timeoutPromise = task.timeout ? 
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('任务超时')), task.timeout)
        ) : null
      
      // 执行任务
      const executePromise = this.executeTaskSteps(task)
      
      if (timeoutPromise) {
        await Promise.race([executePromise, timeoutPromise])
      } else {
        await executePromise
      }
      
      // 任务完成
      task.status = 'completed'
      task.completedAt = Date.now()
      
      const result: TaskResult = {
        success: true,
        data: task.context,
        executionTime: Date.now() - startTime,
        stepResults: task.steps.map(step => ({
          stepId: step.id,
          stepName: step.name,
          success: step.status === 'completed',
          output: step.result?.output,
        })),
        summary: `任务完成，执行了 ${task.steps.length} 个步骤`,
      }
      
      task.result = result
      this.emit('taskCompleted', task)
      
      return result
      
    } catch (error) {
      // 任务失败
      const errorMessage = (error as Error).message
      
      // 检查是否需要重试
      if (task.retryCount < task.maxRetries) {
        task.retryCount++
        task.status = 'pending'
        logger.warn(`[TaskExecutor] Task failed, retry`)
        
        await new Promise(resolve => setTimeout(resolve, this.config.autoRetryDelay))
        return this.executeTask(taskId)
      }
      
      task.status = 'failed'
      task.completedAt = Date.now()
      
      const result: TaskResult = {
        success: false,
        error: errorMessage,
        executionTime: Date.now() - startTime,
        stepResults: task.steps.map(step => ({
          stepId: step.id,
          stepName: step.name,
          success: step.status === 'completed',
          output: step.result?.output,
        })),
      }
      
      task.result = result
      this.emit('taskFailed', task)
      
      return result
      
    } finally {
      this.runningTasks.value.delete(taskId)
      
      // 处理队列中的下一个任务
      if (this.taskQueue.value.length > 0) {
        const nextTaskId = this.taskQueue.value.shift()
        if (nextTaskId) {
          this.executeTask(nextTaskId).catch(e => 
            logger.error('[TaskExecutor] Queue task execution failed:', e)
          )
        }
      }
    }
  }

  /**
   * 执行任务步骤
   */
  private async executeTaskSteps(task: Task): Promise<void> {
    const toolExecutor = getToolExecutor()
    
    for (let i = task.currentStepIndex; i < task.steps.length; i++) {
      task.currentStepIndex = i
      const step = task.steps[i]
      
      step.status = 'running'
      step.startedAt = Date.now()
      this.emit('stepStarted', { task, step })
      
      try {
        switch (step.type) {
          case 'tool':
            if (step.toolName) {
              // 替换参数中的变量
              const params = this.resolveParams(step.toolParams || {}, task.context)
              step.result = await toolExecutor.executeTool(step.toolName, params, {
                userId: task.context.userId as string,
                conversationId: task.context.conversationId as string,
              })
              
              // 将结果存入上下文
              task.context[`step_${i}_result`] = step.result.data
            }
            break
            
          case 'wait':
            await new Promise(resolve => setTimeout(resolve, step.waitTime || 1000))
            step.result = { success: true, executionTime: step.waitTime || 1000 }
            break
            
          case 'condition': {
            const conditionResult = this.evaluateCondition(step.condition || 'true', task.context)
            if (!conditionResult) {
              step.status = 'skipped'
              continue
            }
            step.result = { success: true, executionTime: 0 }
            break
          }
            
          case 'loop':
            // 循环逻辑
            step.result = { success: true, executionTime: 0 }
            break
            
          case 'human_input':
            // 等待人工输入
            task.status = 'waiting'
            this.emit('humanInputRequired', { task, step })
            throw new Error(t('error.task_executor.等待人工输入1'))
            
          case 'ai_decision':
            // AI 决策步骤
            step.result = { 
              success: true, 
              executionTime: 0,
              output: 'AI 分析完成',
            }
            break
        }
        
        step.status = 'completed'
        step.completedAt = Date.now()
        this.emit('stepCompleted', { task, step })
        
      } catch (error) {
        step.status = 'failed'
        step.completedAt = Date.now()
        step.result = {
          success: false,
          error: (error as Error).message,
          executionTime: Date.now() - (step.startedAt || Date.now()),
        }
        
        this.emit('stepFailed', { task, step, error })
        throw error
      }
    }
  }

  /**
   * 解析参数（替换变量）
   */
  private resolveParams(params: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {}
    
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'string' && value.startsWith('$')) {
        // 变量引用
        const varName = value.substring(1)
        resolved[key] = context[varName] ?? value
      } else {
        resolved[key] = value
      }
    }
    
    return resolved
  }

  /**
   * 评估条件
   * 使用安全的表达式评估器替代 new Function
   */
  private evaluateCondition(condition: string, context: Record<string, unknown>): boolean {
    return evaluateCondition(condition, context)
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task && task.status === 'running') {
      task.status = 'paused'
      this.emit('taskPaused', task)
    }
  }

  /**
   * 恢复任务
   */
  async resumeTask(taskId: string): Promise<TaskResult> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`)
    }
    
    if (task.status !== 'paused' && task.status !== 'waiting') {
      throw new Error(`任务 ${taskId} 不能恢复`)
    }
    
    return this.executeTask(taskId)
  }

  /**
   * 取消任务
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task && (task.status === 'pending' || task.status === 'running' || task.status === 'paused')) {
      task.status = 'cancelled'
      task.completedAt = Date.now()
      this.runningTasks.value.delete(taskId)
      this.emit('taskCancelled', task)
    }
  }

  /**
   * 提供人工输入
   */
  async provideHumanInput(taskId: string, stepId: string, input: any): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务 ${taskId} 不存在`)
    }
    
    const step = task.steps.find(s => s.id === stepId)
    if (!step || step.type !== 'human_input') {
      throw new Error(`步骤 ${stepId} 不是人工输入步骤`)
    }
    
    // 存储输入到上下文
    task.context[`human_input_${stepId}`] = input
    step.status = 'completed'
    step.completedAt = Date.now()
    
    // 继续执行任务
    await this.executeTask(taskId)
  }

  /**
   * 获取任务
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取运行中的任务
   */
  getRunningTasks(): Task[] {
    return Array.from(this.runningTasks.value)
      .map(id => this.tasks.get(id))
      .filter((t): t is Task => !!t)
  }

  /**
   * 删除任务
   */
  deleteTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (task) {
      if (task.status === 'running') {
        this.cancelTask(taskId)
      }
      this.tasks.delete(taskId)
      this.emit('taskDeleted', task)
    }
  }

  /**
   * 获取状态
   */
  getStatus(): {
    totalTasks: number
    runningTasks: number
    queuedTasks: number
    completedTasks: number
    failedTasks: number
  } {
    const tasks = Array.from(this.tasks.values())
    
    return {
      totalTasks: tasks.length,
      runningTasks: this.runningTasks.value.size,
      queuedTasks: this.taskQueue.value.length,
      completedTasks: tasks.filter(t => t.status === 'completed').length,
      failedTasks: tasks.filter(t => t.status === 'failed').length,
    }
  }
}

// 单例实例
let taskExecutorInstance: TaskExecutor | null = null

/**
 * 获取任务执行器实例
 */
export function getTaskExecutor(): TaskExecutor {
  if (!taskExecutorInstance) {
    taskExecutorInstance = new TaskExecutor()
  }
  return taskExecutorInstance
}
