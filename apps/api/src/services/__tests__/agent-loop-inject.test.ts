// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agentLoop 中途插话单测(2026-09-17 立,#44 阶段3)。
 * 白盒直测队列语义:构造 running/终态任务 → injectMessage 守卫 → drain 清空。
 * 不触发 run(不连 LLM);tasks/injections 私有成员经受控断言访问(测试豁免)。
 */
import { describe, it, expect, afterEach } from 'vitest'
import { agentLoop } from '../workspace-ai-service'
import type { AgentTask } from '../workspace-ai-service'

/** 白盒:构造指定状态的任务注入内存 Map,测后清理 */
function seedTask(taskId: string, status: 'running' | 'completed'): AgentTask {
  const task: AgentTask = {
    taskId,
    sessionId: 's',
    goal: 'g',
    status,
    startedAt: new Date().toISOString(),
    injections: [],
    iterations: 0,
    steps: [],
    result: '',
    error: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  ;(agentLoop as unknown as { tasks: Map<string, AgentTask> }).tasks.set(taskId, task)
  return task
}

afterEach(() => {
  const tasks = (agentLoop as unknown as { tasks: Map<string, AgentTask> }).tasks
  const injections = (agentLoop as unknown as { injections: Map<string, string[]> }).injections
  for (const [k, v] of tasks)
    if (v.sessionId === 's') {
      tasks.delete(k)
      injections.delete(k)
    }
})

describe('injectMessage(#44 阶段3 中途插话)', () => {
  it('不存在的 taskId → false', () => {
    expect(agentLoop.injectMessage('no-such-task', 'hello')).toBe(false)
  })

  it('终态(completed)任务 → false(拒绝插话)', () => {
    seedTask('done-task', 'completed')
    expect(agentLoop.injectMessage('done-task', 'hello')).toBe(false)
  })

  it('running 任务:接受注入;drain 一次性取走并清空', () => {
    seedTask('run-task', 'running')
    expect(agentLoop.injectMessage('run-task', '  第一条  ')).toBe(true)
    expect(agentLoop.injectMessage('run-task', '第二条')).toBe(true)
    const drain = agentLoop as unknown as { drainInjections: (id: string) => string[] }
    expect(drain.drainInjections('run-task')).toEqual(['第一条', '第二条'])
    // 二次 drain → 空(消费后不重复)
    expect(drain.drainInjections('run-task')).toEqual([])
  })

  it('空白内容 → false 且不产生空队列记录', () => {
    seedTask('blank-task', 'running')
    expect(agentLoop.injectMessage('blank-task', '   ')).toBe(false)
    const injections = (agentLoop as unknown as { injections: Map<string, string[]> }).injections
    expect(injections.get('blank-task')).toBeUndefined()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
