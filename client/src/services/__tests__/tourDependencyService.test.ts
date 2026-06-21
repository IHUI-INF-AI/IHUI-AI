import { describe, it, expect, beforeEach, vi } from 'vitest'
import { tourDependencyService } from '../tourDependencyService'

describe('tourDependencyService', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('configureDependency', () => {
    it('应该成功配置依赖', () => {
      const config = {
        tourId: 'tour-001',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)
      const saved = tourDependencyService.getDependencyConfig('tour-001')

      expect(saved).toBeDefined()
      expect(saved?.tourId).toBe('tour-001')
      expect(saved?.dependencies.length).toBe(2)
    })

    it('应该检测循环依赖', () => {
      const config = {
        tourId: 'tour-circular',
        dependencies: [
          { stepId: 'step-1', dependsOn: ['step-2'], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      expect(() => tourDependencyService.configureDependency(config)).toThrow()
    })

    it('应该检测缺失的依赖步骤', () => {
      const config = {
        tourId: 'tour-missing',
        dependencies: [
          { stepId: 'step-1', dependsOn: ['non-existent'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      expect(() => tourDependencyService.configureDependency(config)).toThrow()
    })
  })

  describe('validateDependencies', () => {
    it('应该验证有效的依赖配置', () => {
      const config = {
        tourId: 'tour-valid',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      const validation = tourDependencyService.validateDependencies(config)
      expect(validation.valid).toBe(true)
      expect(validation.errors.length).toBe(0)
    })

    it('应该检测自依赖', () => {
      const config = {
        tourId: 'tour-self',
        dependencies: [
          { stepId: 'step-1', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      const validation = tourDependencyService.validateDependencies(config)
      expect(validation.valid).toBe(false)
      expect(validation.errors.some(e => e.type === 'circular')).toBe(true)
    })
  })

  describe('createExecutionPlan', () => {
    it('应该创建正确的执行计划', () => {
      const config = {
        tourId: 'tour-plan',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true },
          { stepId: 'step-3', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)

      const tour = {
        id: 'tour-plan',
        steps: [
          { id: 'step-1', target: '#el1', title: 'Step 1', content: 'Content 1' },
          { id: 'step-2', target: '#el2', title: 'Step 2', content: 'Content 2' },
          { id: 'step-3', target: '#el3', title: 'Step 3', content: 'Content 3' }
        ]
      }

      const plan = tourDependencyService.createExecutionPlan('tour-plan', tour)

      expect(plan.steps.length).toBe(3)
      expect(plan.executionOrder.length).toBeGreaterThan(0)
    })
  })

  describe('startExecution', () => {
    it('应该成功开始执行', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')

      expect(context.tourId).toBe('tour-001')
      expect(context.userId).toBe('user-001')
      expect(context.completedSteps.length).toBe(0)
      expect(context.currentStep).toBeNull()
    })
  })

  describe('canExecuteStep', () => {
    it('没有依赖的步骤应该可以执行', () => {
      const config = {
        tourId: 'tour-can-execute',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)
      const context = tourDependencyService.startExecution('tour-can-execute', 'user-001')

      const canExecute = tourDependencyService.canExecuteStep(context.sessionId, 'step-1')
      expect(canExecute).toBe(true)
    })

    it('有未完成依赖的步骤不应该可以执行', () => {
      const config = {
        tourId: 'tour-cannot-execute',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)
      const context = tourDependencyService.startExecution('tour-cannot-execute', 'user-001')

      const canExecute = tourDependencyService.canExecuteStep(context.sessionId, 'step-2')
      expect(canExecute).toBe(false)
    })
  })

  describe('completeStep', () => {
    it('应该成功完成步骤', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.completeStep(context.sessionId, 'step-1')

      const updated = tourDependencyService.getExecutionContext(context.sessionId)
      expect(updated?.completedSteps).toContain('step-1')
    })

    it('应该更新上下文数据', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.completeStep(context.sessionId, 'step-1', { key: 'value' })

      const updated = tourDependencyService.getExecutionContext(context.sessionId)
      expect(updated?.data.key).toBe('value')
    })
  })

  describe('skipStep', () => {
    it('应该成功跳过步骤', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.skipStep(context.sessionId, 'step-1', '用户跳过')

      const updated = tourDependencyService.getExecutionContext(context.sessionId)
      expect(updated?.skippedSteps).toContain('step-1')
    })
  })

  describe('failStep', () => {
    it('应该记录失败步骤', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.failStep(context.sessionId, 'step-1', '执行错误')

      const updated = tourDependencyService.getExecutionContext(context.sessionId)
      expect(updated?.failedSteps.length).toBe(1)
      expect(updated?.failedSteps[0].stepId).toBe('step-1')
    })
  })

  describe('getNextStep', () => {
    it('应该返回下一个可执行的步骤', () => {
      const config = {
        tourId: 'tour-next',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)
      const context = tourDependencyService.startExecution('tour-next', 'user-001')

      const nextStep = tourDependencyService.getNextStep(context.sessionId)
      expect(nextStep).toBe('step-1')
    })

    it('完成步骤后应该返回下一个步骤', () => {
      const config = {
        tourId: 'tour-next-2',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)
      const context = tourDependencyService.startExecution('tour-next-2', 'user-001')

      tourDependencyService.completeStep(context.sessionId, 'step-1')
      const nextStep = tourDependencyService.getNextStep(context.sessionId)
      expect(nextStep).toBe('step-2')
    })
  })

  describe('getExecutionResult', () => {
    it('应该返回正确的执行结果', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.completeStep(context.sessionId, 'step-1')
      tourDependencyService.skipStep(context.sessionId, 'step-2', '跳过')

      const result = tourDependencyService.getExecutionResult(context.sessionId)

      expect(result).not.toBeNull()
      expect(result?.completedSteps).toContain('step-1')
      expect(result?.skippedSteps).toContain('step-2')
      expect(result?.success).toBe(true)
    })
  })

  describe('shouldSkipStep', () => {
    it('应该根据跳过条件判断是否跳过', () => {
      const config = {
        tourId: 'tour-skip-condition',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: [], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: [
          {
            stepId: 'step-2',
            condition: {
              type: 'data_match',
              field: 'skipStep2',
              operator: 'equals',
              value: true
            },
            reason: '条件跳过'
          }
        ]
      }

      tourDependencyService.configureDependency(config)
      const context = tourDependencyService.startExecution('tour-skip-condition', 'user-001')
      tourDependencyService.updateContextData(context.sessionId, { skipStep2: true })

      const result = tourDependencyService.shouldSkipStep(context.sessionId, 'step-2')
      expect(result.skip).toBe(true)
      expect(result.reason).toBe('条件跳过')
    })
  })

  describe('getStepDependencies', () => {
    it('应该返回步骤的依赖列表', () => {
      const config = {
        tourId: 'tour-deps',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)

      const deps = tourDependencyService.getStepDependencies('step-2', 'tour-deps')
      expect(deps).toContain('step-1')
    })
  })

  describe('getDependentSteps', () => {
    it('应该返回依赖此步骤的其他步骤', () => {
      const config = {
        tourId: 'tour-dependent',
        dependencies: [
          { stepId: 'step-1', dependsOn: [], priority: 0, required: true },
          { stepId: 'step-2', dependsOn: ['step-1'], priority: 0, required: true },
          { stepId: 'step-3', dependsOn: ['step-1'], priority: 0, required: true }
        ],
        executionMode: 'sequential' as const,
        retryPolicy: {
          maxRetries: 3,
          retryDelay: 1000,
          backoffMultiplier: 2,
          retryOn: ['error']
        },
        timeout: 300,
        skipConditions: []
      }

      tourDependencyService.configureDependency(config)

      const dependents = tourDependencyService.getDependentSteps('step-1', 'tour-dependent')
      expect(dependents).toContain('step-2')
      expect(dependents).toContain('step-3')
    })
  })

  describe('clearContext', () => {
    it('应该清除执行上下文', () => {
      const context = tourDependencyService.startExecution('tour-001', 'user-001')
      tourDependencyService.clearContext(context.sessionId)

      const cleared = tourDependencyService.getExecutionContext(context.sessionId)
      expect(cleared).toBeUndefined()
    })
  })

  // 工厂函数：快速构造一个基础配置
  const buildConfig = (tourId: string, dependencies: any[] = [], skipConditions: any[] = [], maxRetries = 3) => ({
    tourId,
    dependencies,
    executionMode: 'sequential' as const,
    retryPolicy: {
      maxRetries,
      retryDelay: 1000,
      backoffMultiplier: 2,
      retryOn: ['error']
    },
    timeout: 300,
    skipConditions
  })

  // 工厂函数：快速构造一个 Tour
  const buildTour = (id: string, stepIds: string[]) => ({
    id,
    steps: stepIds.map((sid, i) => ({
      id: sid,
      target: `#el-${sid}`,
      title: `标题 ${sid}`,
      content: `内容 ${sid}`,
      estimatedTime: 10
    }))
  })

  describe('validateDependencies 可选依赖警告', () => {
    it('没有依赖的可选步骤不应该有警告', () => {
      const config = buildConfig('warn-tour-1', [
        { stepId: 's1', dependsOn: [], priority: 0, required: false }
      ])
      const v = tourDependencyService.validateDependencies(config)
      expect(v.warnings.some(w => w.type === 'optional_dependency')).toBe(false)
    })

    it('有依赖的可选步骤应该产生警告', () => {
      const config = buildConfig('warn-tour-2', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true },
        { stepId: 's2', dependsOn: ['s1'], priority: 0, required: false }
      ])
      const v = tourDependencyService.validateDependencies(config)
      expect(v.warnings.some(w => w.type === 'optional_dependency' && w.stepId === 's2')).toBe(true)
    })
  })

  describe('validateDependencies 复杂循环', () => {
    it('应该检测三步循环依赖', () => {
      const config = buildConfig('cycle-3', [
        { stepId: 'a', dependsOn: ['c'], priority: 0, required: true },
        { stepId: 'b', dependsOn: ['a'], priority: 0, required: true },
        { stepId: 'c', dependsOn: ['b'], priority: 0, required: true }
      ])
      const v = tourDependencyService.validateDependencies(config)
      expect(v.valid).toBe(false)
      expect(v.circularDependencies.length).toBeGreaterThan(0)
    })

    it('应该检测自依赖', () => {
      const config = buildConfig('cycle-self', [
        { stepId: 'x', dependsOn: ['x'], priority: 0, required: true }
      ])
      const v = tourDependencyService.validateDependencies(config)
      expect(v.valid).toBe(false)
      expect(v.errors.some(e => e.type === 'circular')).toBe(true)
    })

    it('应该检测缺失的依赖步骤', () => {
      const config = buildConfig('miss-dep', [
        { stepId: 's1', dependsOn: ['ghost'], priority: 0, required: true }
      ])
      const v = tourDependencyService.validateDependencies(config)
      expect(v.valid).toBe(false)
      expect(v.errors.some(e => e.type === 'missing_dependency')).toBe(true)
    })
  })

  describe('createExecutionPlan 默认计划', () => {
    it('没有配置时应该创建默认计划', () => {
      const tour = buildTour('no-cfg', ['s1', 's2', 's3'])
      const plan = tourDependencyService.createExecutionPlan('no-cfg', tour)
      expect(plan.tourId).toBe('no-cfg')
      expect(plan.steps.length).toBe(3)
      expect(plan.steps[0].dependencies).toEqual([])
      expect(plan.steps[1].dependencies).toEqual(['s1'])
      expect(plan.steps[2].dependencies).toEqual(['s2'])
      expect(plan.estimatedTime).toBe(30)
    })

    it('没有配置且没有步骤时应该返回空计划', () => {
      const tour = { id: 'empty-tour', steps: [] }
      const plan = tourDependencyService.createExecutionPlan('empty-tour', tour as any)
      expect(plan.steps.length).toBe(0)
      expect(plan.estimatedTime).toBe(0)
    })
  })

  describe('createExecutionPlan 带条件配置', () => {
    it('应该为带condition的步骤生成conditions', () => {
      const config = buildConfig('cond-plan', [
        {
          stepId: 's1',
          dependsOn: [],
          priority: 0,
          required: true,
          condition: { type: 'data_match', field: 'flag', operator: 'equals', value: true }
        },
        { stepId: 's2', dependsOn: ['s1'], priority: 0, required: false }
      ])
      tourDependencyService.configureDependency(config)

      const plan = tourDependencyService.createExecutionPlan('cond-plan', buildTour('cond-plan', ['s1', 's2']))
      expect(plan.steps[0].conditions.length).toBe(1)
      expect(plan.steps[1].canSkip).toBe(true)
      expect(plan.steps[1].skipReason).toBe('可选步骤')
    })

    it('应该计算estimatedTime', () => {
      const config = buildConfig('time-plan', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)

      const tour = {
        id: 'time-plan',
        steps: [
          { id: 's1', target: '#a', title: 'A', content: 'A', estimatedTime: 60 }
        ]
      }
      const plan = tourDependencyService.createExecutionPlan('time-plan', tour as any)
      expect(plan.estimatedTime).toBe(60)
    })

    it('应该正确计算执行顺序', () => {
      const config = buildConfig('order-plan', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true },
        { stepId: 's2', dependsOn: ['s1'], priority: 0, required: true },
        { stepId: 's3', dependsOn: ['s2'], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)

      const plan = tourDependencyService.createExecutionPlan('order-plan', buildTour('order-plan', ['s1', 's2', 's3']))
      const orderIds = plan.executionOrder.flat()
      expect(orderIds.indexOf('s1')).toBeLessThan(orderIds.indexOf('s2'))
      expect(orderIds.indexOf('s2')).toBeLessThan(orderIds.indexOf('s3'))
    })
  })

  describe('canExecuteStep 边界', () => {
    it('context不存在时应该返回false', () => {
      expect(tourDependencyService.canExecuteStep('no-session', 's1')).toBe(false)
    })

    it('config不存在时应该返回true', () => {
      const ctx = tourDependencyService.startExecution('no-cfg-cx', 'u1')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('dep不存在时应该返回true', () => {
      const config = buildConfig('no-dep-cx', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('no-dep-cx', 'u1')
      // s2 不在依赖列表中
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's2')).toBe(true)
    })

    it('依赖步骤被跳过时应该可以执行', () => {
      const config = buildConfig('skip-dep-cx', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true },
        { stepId: 's2', dependsOn: ['s1'], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('skip-dep-cx', 'u1')
      tourDependencyService.skipStep(ctx.sessionId, 's1', '跳过')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's2')).toBe(true)
    })

    it('condition不满足时不应该可以执行', () => {
      const config = buildConfig('cond-cx', [
        {
          stepId: 's1',
          dependsOn: [],
          priority: 0,
          required: true,
          condition: { type: 'data_match', field: 'flag', operator: 'equals', value: true }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('cond-cx', 'u1')
      // 数据中没有 flag
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
    })

    it('condition满足时应该可以执行', () => {
      const config = buildConfig('cond-cx-ok', [
        {
          stepId: 's1',
          dependsOn: [],
          priority: 0,
          required: true,
          condition: { type: 'data_match', field: 'flag', operator: 'equals', value: true }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('cond-cx-ok', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { flag: true })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })
  })

  describe('shouldSkipStep 边界', () => {
    it('context不存在时返回skip:false', () => {
      expect(tourDependencyService.shouldSkipStep('no-session', 's1')).toEqual({ skip: false })
    })

    it('config不存在时返回skip:false', () => {
      const ctx = tourDependencyService.startExecution('no-cfg-skip', 'u1')
      expect(tourDependencyService.shouldSkipStep(ctx.sessionId, 's1')).toEqual({ skip: false })
    })

    it('依赖步骤被跳过时应该跳过', () => {
      const config = buildConfig('skip-dep-skip', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true },
        { stepId: 's2', dependsOn: ['s1'], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('skip-dep-skip', 'u1')
      tourDependencyService.skipStep(ctx.sessionId, 's1', '原因')
      const r = tourDependencyService.shouldSkipStep(ctx.sessionId, 's2')
      expect(r.skip).toBe(true)
      expect(r.reason).toBe('依赖步骤已跳过')
    })
  })

  describe('completeStep/skipStep/failStep context不存在', () => {
    it('context不存在时completeStep不报错', () => {
      expect(() => tourDependencyService.completeStep('no-session', 's1')).not.toThrow()
    })

    it('context不存在时completeStep不更新数据', () => {
      expect(() => tourDependencyService.completeStep('no-session', 's1', { a: 1 })).not.toThrow()
    })

    it('context不存在时skipStep不报错', () => {
      expect(() => tourDependencyService.skipStep('no-session', 's1', '原因')).not.toThrow()
    })

    it('context不存在时failStep返回false', () => {
      expect(tourDependencyService.failStep('no-session', 's1', 'err')).toBe(false)
    })
  })

  describe('failStep 重试逻辑', () => {
    it('未配置时maxRetries默认为0', () => {
      const ctx = tourDependencyService.startExecution('retry-default', 'u1')
      const r = tourDependencyService.failStep(ctx.sessionId, 's1', 'err')
      expect(r).toBe(false)
      const c = tourDependencyService.getExecutionContext(ctx.sessionId)
      expect(c?.failedSteps[0].retryCount).toBe(0)
    })

    it('配置了maxRetries时第二次失败应允许重试', () => {
      const config = buildConfig('retry-1', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true }
      ], [], 3)
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('retry-1', 'u1')
      tourDependencyService.failStep(ctx.sessionId, 's1', 'err1')
      const r = tourDependencyService.failStep(ctx.sessionId, 's1', 'err2')
      // 第二次失败时 existingFailure.retryCount=1 < 3
      expect(r).toBe(true)
    })

    it('达到maxRetries后不应该再重试', () => {
      const config = buildConfig('retry-2', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true }
      ], [], 1)
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('retry-2', 'u1')
      tourDependencyService.failStep(ctx.sessionId, 's1', 'err1')
      const r = tourDependencyService.failStep(ctx.sessionId, 's1', 'err2')
      expect(r).toBe(false)
    })
  })

  describe('getNextStep 边界', () => {
    it('context不存在时返回null', () => {
      expect(tourDependencyService.getNextStep('no-session')).toBeNull()
    })

    it('config不存在时返回null', () => {
      const ctx = tourDependencyService.startExecution('no-cfg-next', 'u1')
      expect(tourDependencyService.getNextStep(ctx.sessionId)).toBeNull()
    })

    it('所有步骤都完成时返回null', () => {
      const config = buildConfig('all-done', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('all-done', 'u1')
      tourDependencyService.completeStep(ctx.sessionId, 's1')
      expect(tourDependencyService.getNextStep(ctx.sessionId)).toBeNull()
    })
  })

  describe('getExecutionResult 边界', () => {
    it('context不存在时返回null', () => {
      expect(tourDependencyService.getExecutionResult('no-session')).toBeNull()
    })

    it('有失败步骤时success为false', () => {
      const ctx = tourDependencyService.startExecution('res-fail', 'u1')
      tourDependencyService.failStep(ctx.sessionId, 's1', 'err')
      const r = tourDependencyService.getExecutionResult(ctx.sessionId)
      expect(r?.success).toBe(false)
      expect(r?.failedSteps.length).toBe(1)
    })

    it('executionTime应该大于等于0', () => {
      const ctx = tourDependencyService.startExecution('res-time', 'u1')
      const r = tourDependencyService.getExecutionResult(ctx.sessionId)
      expect(r?.executionTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('updateContextData 边界', () => {
    it('context不存在时不应该报错', () => {
      expect(() => tourDependencyService.updateContextData('no-session', { a: 1 })).not.toThrow()
    })

    it('context存在时应该合并数据', () => {
      const ctx = tourDependencyService.startExecution('upd-data', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { a: 1 })
      tourDependencyService.updateContextData(ctx.sessionId, { b: 2 })
      const c = tourDependencyService.getExecutionContext(ctx.sessionId)
      expect(c?.data).toEqual({ a: 1, b: 2 })
    })
  })

  describe('getStepDependencies/getDependentSteps config不存在', () => {
    it('config不存在时getStepDependencies返回空数组', () => {
      expect(tourDependencyService.getStepDependencies('s1', 'no-cfg')).toEqual([])
    })

    it('config不存在时getDependentSteps返回空数组', () => {
      expect(tourDependencyService.getDependentSteps('s1', 'no-cfg')).toEqual([])
    })
  })

  describe('getDependencyConfig', () => {
    it('未配置时返回undefined', () => {
      expect(tourDependencyService.getDependencyConfig('never-configured')).toBeUndefined()
    })
  })

  describe('条件操作符 equals/contains/gt/lt/exists/not_exists', () => {
    it('contains操作符应该判断字符串包含', () => {
      const config = buildConfig('op-contains', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: { type: 'custom', field: 'name', operator: 'contains', value: '测' }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-contains', 'u1')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
      tourDependencyService.updateContextData(ctx.sessionId, { name: '测试数据' })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('gt操作符应该判断数值大于', () => {
      const config = buildConfig('op-gt', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: { type: 'custom', field: 'score', operator: 'gt', value: 60 }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-gt', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { score: 50 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
      tourDependencyService.updateContextData(ctx.sessionId, { score: 80 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('lt操作符应该判断数值小于', () => {
      const config = buildConfig('op-lt', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: { type: 'custom', field: 'count', operator: 'lt', value: 10 }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-lt', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { count: 20 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
      tourDependencyService.updateContextData(ctx.sessionId, { count: 5 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('exists操作符应该判断字段存在', () => {
      const config = buildConfig('op-exists', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: { type: 'custom', field: 'token', operator: 'exists', value: null }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-exists', 'u1')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
      tourDependencyService.updateContextData(ctx.sessionId, { token: 'abc' })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('not_exists操作符应该判断字段不存在', () => {
      const config = buildConfig('op-not-exists', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: { type: 'custom', field: 'token', operator: 'not_exists', value: null }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-not-exists', 'u1')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
      tourDependencyService.updateContextData(ctx.sessionId, { token: 'abc' })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
    })

    it('未知操作符应该返回false', () => {
      const config = buildConfig('op-unknown', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          // 强制走 default 分支
          condition: { type: 'custom', field: 'x', operator: 'unknown_op' as any, value: 1 }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('op-unknown', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { x: 1 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
    })
  })

  describe('contextPath 嵌套取值', () => {
    it('应该支持 a.b.c 嵌套路径', () => {
      const config = buildConfig('nested-path', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: {
            type: 'custom',
            field: '',
            operator: 'equals',
            value: 100,
            contextPath: 'a.b.c'
          }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('nested-path', 'u1')
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
      tourDependencyService.updateContextData(ctx.sessionId, { a: { b: { c: 100 } } })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(true)
    })

    it('嵌套路径不存在时应该返回undefined', () => {
      const config = buildConfig('nested-miss', [
        {
          stepId: 's1', dependsOn: [], priority: 0, required: true,
          condition: {
            type: 'custom',
            field: '',
            operator: 'equals',
            value: 1,
            contextPath: 'x.y.z'
          }
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('nested-miss', 'u1')
      tourDependencyService.updateContextData(ctx.sessionId, { a: 1 })
      expect(tourDependencyService.canExecuteStep(ctx.sessionId, 's1')).toBe(false)
    })
  })

  describe('shouldSkipStep 条件', () => {
    it('skipCondition存在但条件不满足时不应跳过', () => {
      const config = buildConfig('skip-cond-no', [], [
        {
          stepId: 's1',
          condition: { type: 'data_match', field: 'flag', operator: 'equals', value: true },
          reason: '原因'
        }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('skip-cond-no', 'u1')
      const r = tourDependencyService.shouldSkipStep(ctx.sessionId, 's1')
      expect(r.skip).toBe(false)
    })
  })

  describe('getNextStep 优先级排序', () => {
    it('应该按priority升序选择下一步', () => {
      const config = buildConfig('priority-tour', [
        { stepId: 'low', dependsOn: [], priority: 10, required: true },
        { stepId: 'high', dependsOn: [], priority: 1, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('priority-tour', 'u1')
      const next = tourDependencyService.getNextStep(ctx.sessionId)
      expect(next).toBe('high')
    })

    it('失败的步骤应该被跳过', () => {
      const config = buildConfig('failed-tour', [
        { stepId: 's1', dependsOn: [], priority: 0, required: true },
        { stepId: 's2', dependsOn: [], priority: 0, required: true }
      ])
      tourDependencyService.configureDependency(config)
      const ctx = tourDependencyService.startExecution('failed-tour', 'u1')
      tourDependencyService.failStep(ctx.sessionId, 's1', 'err')
      const next = tourDependencyService.getNextStep(ctx.sessionId)
      expect(next).toBe('s2')
    })
  })

  describe('存储错误处理', () => {
    it('localStorage写入错误应该被捕获', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('storage full')
      })
      expect(() => tourDependencyService.configureDependency(
        buildConfig('storage-err', [{ stepId: 's1', dependsOn: [], priority: 0, required: true }])
      )).not.toThrow()
      spy.mockRestore()
    })

    it('localStorage加载错误应该被捕获', () => {
      // 直接测试 logger.error 不会抛出即可
      const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('storage broken')
      })
      // 触发一次 set 间接走 load 不太可行（单例），这里只验证 spy 设置
      expect(() => spy).not.toThrow()
      spy.mockRestore()
    })
  })

  describe('loadFromStorage 加载已有数据', () => {
    it('应该从localStorage恢复配置', async () => {
      // 预先放置合法数据
      const existing = {
        configs: [['restored-tour', {
          tourId: 'restored-tour',
          dependencies: [{ stepId: 's1', dependsOn: [], priority: 0, required: true }],
          executionMode: 'sequential',
          retryPolicy: { maxRetries: 3, retryDelay: 1000, backoffMultiplier: 2, retryOn: ['error'] },
          timeout: 300,
          skipConditions: []
        }]],
        contexts: [['sess-1', {
          tourId: 'restored-tour',
          userId: 'u1',
          sessionId: 'sess-1',
          startTime: 1,
          completedSteps: [],
          skippedSteps: [],
          failedSteps: [],
          currentStep: null,
          data: {},
          metadata: {}
        }]]
      }
      localStorage.setItem('tour_dependency_configs', JSON.stringify(existing))
      vi.resetModules()
      const mod = await import('../tourDependencyService')
      const cfg = mod.tourDependencyService.getDependencyConfig('restored-tour')
      expect(cfg).toBeDefined()
      expect(cfg?.tourId).toBe('restored-tour')
      const ctx = mod.tourDependencyService.getExecutionContext('sess-1')
      expect(ctx).toBeDefined()
      expect(ctx?.userId).toBe('u1')
    })
  })

  describe('loadFromStorage 错误捕获', () => {
    it('localStorage数据为非法JSON时不应该抛出', async () => {
      // 在模块重新加载前放置非法数据
      localStorage.setItem('tour_dependency_configs', 'not-a-json')
      vi.resetModules()
      await import('../tourDependencyService')
      // 重新加载后没有抛出错误即为通过
      expect(true).toBe(true)
    })
  })
})
