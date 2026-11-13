// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * F-200 夹具:Crew 所有 LLM 步骤全部失败时,session 终态不得记 completed、不得返回 success:true。
 *
 * 原缺陷:runSimplified 把「LLM 抛错后产出的失败文本」当 truthy output,照走
 * `updateTaskStatus(taskId,'completed',output)`;executeSession 再无条件
 * `updateSessionStatus(sessionId,'completed')` + `return { success: true }`。
 * 全失败 ⇒ 终态 completed + success:true,谎报成功。
 *
 * 修复口径:runSimplified 区分 taskOk(真实产出)与失败文本,失败记 failed;
 * executeSession 按 anyOk 判定 —— 全失败 ⇒ session failed + success:false。
 *
 * 本夹具:mock db 全空操作、callRealLlm 恒抛错;spy 私有 updateSessionStatus /
 * updateTaskStatus 捕获真实终态,钉住「全失败 ⇒ failed + success:false」。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/db/index.js', () => {
  const sessionRow = { id: 'sess-f200', user_id: 'user-a', status: 'pending', config: { modelId: 'fixture-model' } }
  const noop = () => ({ set: () => ({ where: () => Promise.resolve([]) }), where: () => ({ returning: async () => [{ id: 'x' }], limit: async () => [] }), from: () => ({ where: () => ({ limit: async () => [sessionRow] }) }), values: () => Promise.resolve([]), limit: async () => [sessionRow] })
  return {
    db: {
      insert: () => noop(),
      update: () => ({ set: () => ({ where: () => ({ returning: async () => [{ id: 'x' }] }) }) }),
      select: () => noop(),
    },
  }
})

vi.mock('../src/services/crew-llm-adapter.js', () => ({
  callRealLlm: vi.fn(async () => {
    throw new Error('fixture: LLM 上游不可用')
  }),
}))

vi.mock('../src/services/crew-agent-registry.js', () => ({
  agentRegistry: {
    listRoles: () => [],
    getRole: (name: string) => ({ role: name, goal: 'g', backstory: 'b' }),
  },
}))

import { crewOrchestrator } from '../src/services/crew-orchestrator.js'

// 私有方法运行时可访问,用 as any 取引用供 spyOn。
const orch = crewOrchestrator as unknown as {
  updateSessionStatus: (id: string, status: string, result?: string) => Promise<void>
  updateTaskStatus: (taskId: string, status: string, output?: string, error?: string) => Promise<void>
}

describe('F-200 Crew 全步骤失败不得谎报成功', () => {
  let sessionSpy: ReturnType<typeof vi.spyOn>
  let taskSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    sessionSpy = vi.spyOn(orch, 'updateSessionStatus').mockResolvedValue(undefined)
    taskSpy = vi.spyOn(orch, 'updateTaskStatus').mockResolvedValue(undefined)
  })

  it('所有 LLM 步骤失败 ⇒ session 终态 failed 且 success:false', async () => {
    const out = await crewOrchestrator.executeSession('sess-f200')

    expect(out.success).toBe(false)
    // 终态必须如实记 failed,不能 completed
    const sessionCalls = sessionSpy.mock.calls.map((c) => c[1])
    expect(sessionCalls.at(-1)).toBe('failed')
    expect(sessionCalls).not.toContain('completed')
    // 任务级也如实记 failed,不再被 truthy 失败文本洗成 completed
    const taskCalls = taskSpy.mock.calls.map((c) => c[1])
    expect(taskCalls).toContain('failed')
    // 任何任务都不允许终态 completed;起始态 running 允许
    for (const s of taskCalls) {
      expect(s).not.toBe('completed')
    }
  })
})
