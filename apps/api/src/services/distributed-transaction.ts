/**
 * 分布式事务（Saga 模式）。
 * 迁移自旧架构的分布式事务模式。
 *
 * 每个步骤包含 execute（正向操作）和 compensate（回滚操作）。
 * 如果某步 execute 失败，自动逆序执行已完成步骤的 compensate。
 */

import { logger } from '../utils/logger.js'

export interface SagaStep<T = unknown> {
  name: string
  execute: () => Promise<T>
  compensate: (result: T) => Promise<void>
}

export interface SagaResult {
  success: boolean
  completedSteps: string[]
  compensatedSteps: string[]
  error?: string
}

export async function executeSaga(steps: SagaStep[]): Promise<SagaResult> {
  const completedSteps: Array<{
    name: string
    result: unknown
    compensate: (result: unknown) => Promise<void>
  }> = []
  const compensatedSteps: string[] = []

  for (const step of steps) {
    try {
      const result = await step.execute()
      completedSteps.push({
        name: step.name,
        result,
        compensate: step.compensate as (result: unknown) => Promise<void>,
      })
    } catch (err) {
      // 某步失败，逆序执行已完成步骤各自的 compensate
      for (let i = completedSteps.length - 1; i >= 0; i--) {
        const completed = completedSteps[i]!
        try {
          await completed.compensate(completed.result)
          compensatedSteps.push(completed.name)
        } catch (compensateErr) {
          // compensate 失败也记录，但不中断回滚流程
          logger.error(`[saga] compensate failed for step "${completed.name}"`, {
            error: compensateErr,
          })
        }
      }

      return {
        success: false,
        completedSteps: completedSteps.map((s) => s.name),
        compensatedSteps,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  }

  return {
    success: true,
    completedSteps: completedSteps.map((s) => s.name),
    compensatedSteps: [],
  }
}
