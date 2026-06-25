import { logger } from '@/utils/logger'

export interface TourStep {
  id: string
  target: string
  title: string
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  showSkip?: boolean
  estimatedTime?: number
}

export interface Tour {
  id: string
  steps: TourStep[]
  config?: Record<string, unknown>
}

export interface DependencyConfig {
  tourId: string
  dependencies: StepDependency[]
  executionMode: 'sequential' | 'parallel' | 'conditional'
  retryPolicy: RetryPolicy
  timeout: number
  skipConditions: SkipCondition[]
}

export interface StepDependency {
  stepId: string
  dependsOn: string[]
  condition?: ExecutionCondition
  priority: number
  required: boolean
  fallbackStepId?: string
}

export interface ExecutionCondition {
  type: 'user_action' | 'time_elapsed' | 'data_match' | 'custom'
  field: string
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'exists' | 'not_exists'
  value: any
  contextPath?: string
}

export interface SkipCondition {
  stepId: string
  condition: ExecutionCondition
  reason: string
}

export interface RetryPolicy {
  maxRetries: number
  retryDelay: number
  backoffMultiplier: number
  retryOn: string[]
}

export interface ExecutionPlan {
  tourId: string
  steps: PlannedStep[]
  executionOrder: string[][]
  parallelGroups: string[][]
  estimatedTime: number
}

export interface PlannedStep {
  stepId: string
  order: number
  parallelGroup: number
  dependencies: string[]
  conditions: ExecutionCondition[]
  canSkip: boolean
  skipReason?: string
}

export interface ExecutionContext {
  tourId: string
  userId: string
  sessionId: string
  startTime: number
  completedSteps: string[]
  skippedSteps: string[]
  failedSteps: FailedStepInfo[]
  currentStep: string | null
  data: Record<string, unknown>
  metadata: Record<string, unknown>
}

export interface FailedStepInfo {
  stepId: string
  error: string
  timestamp: number
  retryCount: number
}

export interface ExecutionResult {
  success: boolean
  completedSteps: string[]
  skippedSteps: string[]
  failedSteps: FailedStepInfo[]
  executionTime: number
  data: Record<string, unknown>
}

export interface DependencyValidation {
  valid: boolean
  errors: DependencyError[]
  warnings: DependencyWarning[]
  circularDependencies: string[][]
}

export interface DependencyError {
  stepId: string
  message: string
  type: 'missing_dependency' | 'circular' | 'invalid_condition'
}

export interface DependencyWarning {
  stepId: string
  message: string
  type: 'optional_dependency' | 'redundant_condition'
}

const STORAGE_KEY = 'tour_dependency_configs'
const _CONTEXT_KEY = 'tour_execution_contexts'

class TourDependencyService {
  private configs: Map<string, DependencyConfig> = new Map()
  private contexts: Map<string, ExecutionContext> = new Map()
  private executionQueue: Map<string, string[]> = new Map()

  constructor() {
    this.loadFromStorage()
  }

  configureDependency(config: DependencyConfig): void {
    const validation = this.validateDependencies(config)
    if (!validation.valid) {
      throw new Error(`依赖配置无效: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    this.configs.set(config.tourId, config)
    this.saveToStorage()
  }

  getDependencyConfig(tourId: string): DependencyConfig | undefined {
    return this.configs.get(tourId)
  }

  validateDependencies(config: DependencyConfig): DependencyValidation {
    const errors: DependencyError[] = []
    const warnings: DependencyWarning[] = []
    const circularDependencies: string[][] = []

    const stepIds = new Set(config.dependencies.map(d => d.stepId))

    for (const dep of config.dependencies) {
      for (const parentId of dep.dependsOn) {
        if (!stepIds.has(parentId)) {
          errors.push({
            stepId: dep.stepId,
            message: `依赖的步骤 ${parentId} 不存在`,
            type: 'missing_dependency'
          })
        }
      }

      if (dep.dependsOn.includes(dep.stepId)) {
        errors.push({
          stepId: dep.stepId,
          message: '步骤不能依赖自身',
          type: 'circular'
        })
      }
    }

    const circular = this.detectCircularDependencies(config.dependencies)
    circularDependencies.push(...circular)
    if (circular.length > 0) {
      errors.push({
        stepId: '',
        message: '存在循环依赖',
        type: 'circular'
      })
    }

    for (const dep of config.dependencies) {
      if (!dep.required && dep.dependsOn.length > 0) {
        warnings.push({
          stepId: dep.stepId,
          message: '可选步骤有依赖关系，可能导致跳过执行',
          type: 'optional_dependency'
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      circularDependencies
    }
  }

  createExecutionPlan(tourId: string, tour: Tour): ExecutionPlan {
    const config = this.configs.get(tourId)
    const steps = tour.steps || []

    if (!config) {
      return this.createDefaultPlan(tourId, steps)
    }

    const plannedSteps: PlannedStep[] = []
    const _stepMap = new Map(steps.map(s => [s.id, s]))
    const dependencyMap = new Map(config.dependencies.map(d => [d.stepId, d]))

    for (const step of steps) {
      const dep = dependencyMap.get(step.id)
      plannedSteps.push({
        stepId: step.id,
        order: 0,
        parallelGroup: 0,
        dependencies: dep?.dependsOn || [],
        conditions: dep?.condition ? [dep.condition] : [],
        canSkip: !dep?.required,
        skipReason: dep?.required ? undefined : '可选步骤'
      })
    }

    const { order, parallelGroups } = this.calculateExecutionOrder(plannedSteps)
    
    for (let i = 0; i < plannedSteps.length; i++) {
      plannedSteps[i].order = order.indexOf(plannedSteps[i].stepId)
    }

    const estimatedTime = steps.reduce((sum, s) => sum + (s.estimatedTime || 30), 0)

    return {
      tourId,
      steps: plannedSteps,
      executionOrder: parallelGroups,
      parallelGroups,
      estimatedTime
    }
  }

  startExecution(tourId: string, userId: string): ExecutionContext {
    const sessionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    const context: ExecutionContext = {
      tourId,
      userId,
      sessionId,
      startTime: Date.now(),
      completedSteps: [],
      skippedSteps: [],
      failedSteps: [],
      currentStep: null,
      data: {},
      metadata: {}
    }

    this.contexts.set(sessionId, context)
    this.saveToStorage()
    return context
  }

  canExecuteStep(sessionId: string, stepId: string): boolean {
    const context = this.contexts.get(sessionId)
    if (!context) return false

    const config = this.configs.get(context.tourId)
    if (!config) return true

    const dep = config.dependencies.find(d => d.stepId === stepId)
    if (!dep) return true

    for (const parentId of dep.dependsOn) {
      if (!context.completedSteps.includes(parentId) && 
          !context.skippedSteps.includes(parentId)) {
        return false
      }
    }

    if (dep.condition && !this.evaluateCondition(dep.condition, context)) {
      return false
    }

    return true
  }

  shouldSkipStep(sessionId: string, stepId: string): { skip: boolean; reason?: string } {
    const context = this.contexts.get(sessionId)
    if (!context) return { skip: false }

    const config = this.configs.get(context.tourId)
    if (!config) return { skip: false }

    const skipCondition = config.skipConditions.find(s => s.stepId === stepId)
    if (skipCondition && this.evaluateCondition(skipCondition.condition, context)) {
      return { skip: true, reason: skipCondition.reason }
    }

    const dep = config.dependencies.find(d => d.stepId === stepId)
    if (dep && dep.dependsOn.some(d => context.skippedSteps.includes(d))) {
      return { skip: true, reason: '依赖步骤已跳过' }
    }

    return { skip: false }
  }

  completeStep(sessionId: string, stepId: string, data?: Record<string, unknown>): void {
    const context = this.contexts.get(sessionId)
    if (!context) return

    if (!context.completedSteps.includes(stepId)) {
      context.completedSteps.push(stepId)
    }

    if (data) {
      context.data = { ...context.data, ...data }
    }

    context.currentStep = this.getNextStep(sessionId)
    this.saveToStorage()
  }

  skipStep(sessionId: string, stepId: string, reason: string): void {
    const context = this.contexts.get(sessionId)
    if (!context) return

    if (!context.skippedSteps.includes(stepId)) {
      context.skippedSteps.push(stepId)
    }

    context.metadata[`skip_${stepId}`] = { reason, timestamp: Date.now() }
    context.currentStep = this.getNextStep(sessionId)
    this.saveToStorage()
  }

  failStep(sessionId: string, stepId: string, error: string): boolean {
    const context = this.contexts.get(sessionId)
    if (!context) return false

    const config = this.configs.get(context.tourId)
    const existingFailure = context.failedSteps.find(f => f.stepId === stepId)
    
    if (existingFailure) {
      existingFailure.retryCount++
      existingFailure.error = error
      existingFailure.timestamp = Date.now()
    } else {
      context.failedSteps.push({
        stepId,
        error,
        timestamp: Date.now(),
        retryCount: 0
      })
    }

    const maxRetries = config?.retryPolicy.maxRetries || 0
    if (existingFailure && existingFailure.retryCount < maxRetries) {
      return true
    }

    this.saveToStorage()
    return false
  }

  getNextStep(sessionId: string): string | null {
    const context = this.contexts.get(sessionId)
    if (!context) return null

    const config = this.configs.get(context.tourId)
    if (!config) return null

    const processedSteps = new Set([
      ...context.completedSteps,
      ...context.skippedSteps,
      ...context.failedSteps.map(f => f.stepId)
    ])

    const sortedDeps = [...config.dependencies].sort((a, b) => a.priority - b.priority)

    for (const dep of sortedDeps) {
      if (processedSteps.has(dep.stepId)) continue

      const depsMet = dep.dependsOn.every(d => 
        context.completedSteps.includes(d) || context.skippedSteps.includes(d)
      )

      if (depsMet) {
        return dep.stepId
      }
    }

    return null
  }

  getExecutionContext(sessionId: string): ExecutionContext | undefined {
    return this.contexts.get(sessionId)
  }

  getExecutionResult(sessionId: string): ExecutionResult | null {
    const context = this.contexts.get(sessionId)
    if (!context) return null

    const config = this.configs.get(context.tourId)
    const _totalSteps = config?.dependencies.length || 0

    return {
      success: context.failedSteps.length === 0,
      completedSteps: [...context.completedSteps],
      skippedSteps: [...context.skippedSteps],
      failedSteps: [...context.failedSteps],
      executionTime: Date.now() - context.startTime,
      data: { ...context.data }
    }
  }

  updateContextData(sessionId: string, data: Record<string, unknown>): void {
    const context = this.contexts.get(sessionId)
    if (!context) return

    context.data = { ...context.data, ...data }
    this.saveToStorage()
  }

  getStepDependencies(stepId: string, tourId: string): string[] {
    const config = this.configs.get(tourId)
    if (!config) return []

    const dep = config.dependencies.find(d => d.stepId === stepId)
    return dep?.dependsOn || []
  }

  getDependentSteps(stepId: string, tourId: string): string[] {
    const config = this.configs.get(tourId)
    if (!config) return []

    return config.dependencies
      .filter(d => d.dependsOn.includes(stepId))
      .map(d => d.stepId)
  }

  clearContext(sessionId: string): void {
    this.contexts.delete(sessionId)
    this.saveToStorage()
  }

  private detectCircularDependencies(dependencies: StepDependency[]): string[][] {
    const cycles: string[][] = []
    const visited = new Set<string>()
    const recursionStack = new Set<string>()
    const graph = new Map<string, string[]>()

    for (const dep of dependencies) {
      graph.set(dep.stepId, dep.dependsOn)
    }

    const dfs = (node: string, path: string[]): boolean => {
      visited.add(node)
      recursionStack.add(node)

      const neighbors = graph.get(node) || []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor, [...path, neighbor])) {
            return true
          }
        } else if (recursionStack.has(neighbor)) {
          const cycleStart = path.indexOf(neighbor)
          if (cycleStart !== -1) {
            cycles.push(path.slice(cycleStart))
          }
          return true
        }
      }

      recursionStack.delete(node)
      return false
    }

    for (const dep of dependencies) {
      if (!visited.has(dep.stepId)) {
        dfs(dep.stepId, [dep.stepId])
      }
    }

    return cycles
  }

  private calculateExecutionOrder(steps: PlannedStep[]): { order: string[]; parallelGroups: string[][] } {
    const order: string[] = []
    const parallelGroups: string[][] = []
    const processed = new Set<string>()
    const stepMap = new Map(steps.map(s => [s.stepId, s]))

    while (processed.size < steps.length) {
      const ready: string[] = []

      for (const step of steps) {
        if (processed.has(step.stepId)) continue

        const depsMet = step.dependencies.every(d => processed.has(d))
        if (depsMet) {
          ready.push(step.stepId)
        }
      }

      if (ready.length === 0) break

      ready.sort((a, b) => {
        const stepA = stepMap.get(a)!
        const stepB = stepMap.get(b)!
        return stepA.parallelGroup - stepB.parallelGroup || stepA.order - stepB.order
      })

      parallelGroups.push(ready)
      order.push(...ready)
      ready.forEach(s => processed.add(s))
    }

    return { order, parallelGroups }
  }

  private evaluateCondition(condition: ExecutionCondition, context: ExecutionContext): boolean {
    let value: any

    if (condition.contextPath) {
      value = this.getNestedValue(context.data, condition.contextPath)
    } else {
      value = context.data[condition.field]
    }

    switch (condition.operator) {
      case 'equals':
        return value === condition.value
      case 'contains':
        return String(value).includes(String(condition.value))
      case 'gt':
        return Number(value) > Number(condition.value)
      case 'lt':
        return Number(value) < Number(condition.value)
      case 'exists':
        return value !== undefined && value !== null
      case 'not_exists':
        return value === undefined || value === null
      default:
        return false
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
    }, obj as unknown)
  }

  private createDefaultPlan(tourId: string, steps: TourStep[]): ExecutionPlan {
    const plannedSteps: PlannedStep[] = steps.map((step, index) => ({
      stepId: step.id,
      order: index,
      parallelGroup: 0,
      dependencies: index > 0 ? [steps[index - 1].id] : [],
      conditions: [],
      canSkip: false
    }))

    return {
      tourId,
      steps: plannedSteps,
      executionOrder: steps.map(s => [s.id]),
      parallelGroups: steps.map(s => [s.id]),
      estimatedTime: steps.reduce((sum, s) => sum + (s.estimatedTime || 30), 0)
    }
  }

  private saveToStorage(): void {
    try {
      const data = {
        configs: Array.from(this.configs.entries()),
        contexts: Array.from(this.contexts.entries())
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch (e) {
      logger.error('Failed to save dependency config:', e)
    }
  }

  private loadFromStorage(): void {
    try {
      const data = localStorage.getItem(STORAGE_KEY)
      if (data) {
        const parsed = JSON.parse(data)
        this.configs = new Map(parsed.configs || [])
        this.contexts = new Map(parsed.contexts || [])
      }
    } catch (e) {
      logger.error('Failed to load dependency config:', e)
    }
  }
}

export const tourDependencyService = new TourDependencyService()
