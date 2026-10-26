// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agentLoop 演示路径「不代为执行工具」单测(2026-10-26 立,守门 115 未覆盖站点收口)。
 *
 * 改动前:`workspace-ai-service.ts` 的 run 循环第 1 轮把 `params.tools[0]` 以**空对象**
 * 直接送到注册工具上(`tool.execute` 空参形态),既绕过工具入参校验,又会落到
 * write_file / run_command / atomic_checkpoint 这类有真实副作用的工具。
 *
 * 成对四条,缺一条就钉不住"摘的是模拟腿、不是工具能力":
 *   ① 演示路径:探针工具被登记进轨迹,但 execute **一次都没被调用**(零副作用)。
 *   ② 正向对照:同一个工具直接调用仍然照常执行 ⇒ 本轮没有把工具面削掉。
 *   ③ 具名内置工具 write_file:演示路径不得触碰 fsBridge.write(落盘腿)。
 *   ④ 未注册的工具名:不产生任何 tool_* 轨迹(与改动前同形,不新增分支)。
 *
 * 隔离:全程 mock `aiServiceSystemFetch`,零网络、零 DB(不连 PG 8810 / Redis 8811)、零磁盘。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

const llmFetch = vi.hoisted(() => ({
  fetch: vi.fn(async (_path: string, _init: unknown) => ({
    ok: false,
    status: 503,
    json: async () => ({}),
  })),
}))

vi.mock('../src/utils/ai-service-fetch.js', () => ({
  aiServiceSystemFetch: llmFetch.fetch,
}))

import { agentLoop, fsBridge, type AgentTask } from '../src/services/workspace-ai-service.js'

/** 演示路径未执行声明的关键字(轨迹必须自陈"没执行",不得写成已执行) */
const NOT_EXECUTED = '未执行'

const createdTaskIds: string[] = []

function takeTask(task: AgentTask): AgentTask {
  createdTaskIds.push(task.taskId)
  return task
}

afterEach(() => {
  const tasks = (agentLoop as unknown as { tasks: Map<string, AgentTask> }).tasks
  for (const id of createdTaskIds) tasks.delete(id)
  createdTaskIds.length = 0
  vi.restoreAllMocks()
  llmFetch.fetch.mockClear()
})

describe('agentLoop.run 演示路径 · 只登记不执行', () => {
  it('① tools=[探针] → 轨迹留 tool_call/tool_result 成对两行,但 execute 零调用', async () => {
    const seen: unknown[] = []
    agentLoop.registerTool({
      name: 'probe_demo_leg',
      description: '测试探针:被调用即记一次入参',
      execute: async (args) => {
        seen.push(args)
        return 'SIDE_EFFECT_HAPPENED'
      },
    })

    const task = takeTask(await agentLoop.run({ goal: 'g-demo', tools: ['probe_demo_leg'] }))

    // 探针从未被执行 ⇒ 副作用集合恒空(执行过一次就会留下一条)
    expect(seen).toEqual([])
    expect(JSON.stringify(task.steps)).not.toContain('SIDE_EFFECT_HAPPENED')

    const call = task.steps.find((s) => s.type === 'tool_call')
    const result = task.steps.find((s) => s.type === 'tool_result')
    expect(call?.tool).toBe('probe_demo_leg')
    expect(result?.tool).toBe('probe_demo_leg')
    expect(call?.content).toContain(NOT_EXECUTED)
    expect(result?.content).toContain(NOT_EXECUTED)
    expect(task.status).toBe('completed')
    // LLM 思考腿仍在(摘的是模拟执行腿,不是整条循环)
    expect(llmFetch.fetch).toHaveBeenCalledTimes(1)
  })

  it('② 正向对照:同一工具被直接调用时确实执行,入参原样送达', async () => {
    const seen: Record<string, unknown>[] = []
    agentLoop.registerTool({
      name: 'probe_direct',
      description: '测试探针:直接调用路径',
      execute: async (args) => {
        seen.push(args)
        return 'ok'
      },
    })

    const tool = agentLoop.listTools().find((t) => t.name === 'probe_direct')
    expect(tool).toBeDefined()
    const out = await tool!.execute({ path: 'a.txt' })

    expect(out).toBe('ok')
    expect(seen).toEqual([{ path: 'a.txt' }])
  })

  it('③ tools=[write_file] → 演示路径不触碰 fsBridge.write(空参落盘腿)', async () => {
    const writeSpy = vi.spyOn(fsBridge, 'write')

    const task = takeTask(await agentLoop.run({ goal: 'g-write', tools: ['write_file'] }))

    expect(writeSpy).not.toHaveBeenCalled()
    const result = task.steps.find((s) => s.type === 'tool_result')
    expect(result?.tool).toBe('write_file')
    expect(result?.content).toContain(NOT_EXECUTED)
    // 改动前空参落盘会把任务打成 failed;现在必须是正常完成
    expect(task.status).toBe('completed')
    expect(task.error).toBeNull()
  })

  it('④ 反向对照:未注册的工具名不产生任何 tool_* 轨迹', async () => {
    const task = takeTask(await agentLoop.run({ goal: 'g-unknown', tools: ['no_such_tool'] }))

    expect(task.steps.filter((s) => s.type === 'tool_call' || s.type === 'tool_result')).toEqual([])
    expect(task.status).toBe('completed')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
