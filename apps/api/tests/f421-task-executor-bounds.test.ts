// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-421:TaskExecutor 的取消/超时/等待上限/任务表上限。
 * - cancel 后不再跑后续步骤,状态也不能被覆写成 completed;
 * - task.timeout 真正生效,wait 被夹到剩余时限;
 * - wait ms 有硬上限;
 * - tasks Map 超过 1000 条时淘汰最老任务。
 */
import { describe, it, expect, vi } from 'vitest'

vi.hoisted(() => {
  process.env.LOG_LEVEL = 'silent'
})

import { TaskExecutor, type TaskStep } from '../src/services/clawdbot/task-executor.js'

function waitStep(ms: number): TaskStep {
  return { id: `w-${ms}`, name: 'wait', type: 'wait', toolParams: { ms } }
}

describe('F-421 TaskExecutor 边界', () => {
  it('取消后立即停止,状态保持 cancelled', async () => {
    const ex = new TaskExecutor()
    const task = ex.create({
      name: 'cancel-me',
      description: '',
      steps: [waitStep(300), waitStep(0)],
    })
    const running = ex.execute(task.id)
    await new Promise((r) => setTimeout(r, 20))
    expect(ex.cancel(task.id)).toBe(true)

    const result = await running
    expect(task.status).toBe('cancelled')
    expect(result.success).toBe(false)
    expect(result.error).toBe('任务已取消')
    // 第二步没有执行
    expect(result.stepResults).toHaveLength(1)
  })

  it('task.timeout 生效,wait 被夹到剩余时限', async () => {
    const ex = new TaskExecutor()
    const task = ex.create({
      name: 'timeout',
      description: '',
      timeout: 30,
      steps: [waitStep(2_147_483_647)],
    })
    const startedAt = Date.now()
    const result = await ex.execute(task.id)
    const elapsed = Date.now() - startedAt

    expect(result.success).toBe(false)
    expect(result.error).toBe('任务执行超时')
    expect(task.status).toBe('failed')
    expect(elapsed).toBeLessThan(1000)
  })

  it('任务表超过上限时淘汰最老任务', () => {
    const ex = new TaskExecutor()
    for (let i = 0; i < 1001; i++) {
      ex.create({ name: `t${i}`, description: '', steps: [] })
    }
    expect(ex.getStatus().totalTasks).toBeLessThanOrEqual(1000)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
