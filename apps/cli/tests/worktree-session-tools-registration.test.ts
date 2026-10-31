// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 会话级 worktree 工具(enter_worktree / exit_worktree)「挂上且叫得出名」回归。
 *
 * 钉两件事:
 *  1. **挂上**:两枚工具能从 *真实注册路径* `setupAgentTools()` 跑完后的运行时注册表取到
 *     (不是测试自己 registerTools 再自问自答 —— 摘掉 `commands/agent.ts` 里那行
 *     `registerTools(WORKTREE_TOOLS)` 本用例必红)。
 *  2. **钩子两档在册**:`worktreeCreate` / `worktreeRemove` 是 HooksConfig 的一等键,
 *     `deepMergeHooks` 对它们按既有语义拼接(多源 hooks.json 合并时不许静默丢掉新事件)。
 *
 * 为什么这册不 mock 子进程:它走的是真实装配链(settings/skills/AGENTS.md 注入),
 * 子进程钩子留给同族的 `worktree-session-tools.test.ts` 打桩断言次序。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

describe('会话级 worktree 工具注册 ↔ 运行时注册表 ↔ 钩子两档', () => {
  let workspacePath: string

  beforeAll(() => {
    workspacePath = mkdtempSync(join(tmpdir(), 'ihui-wt-reg-'))
  })

  afterAll(() => {
    rmSync(workspacePath, { recursive: true, force: true })
  })

  it('setupAgentTools 之后,WORKTREE_TOOLS 每一枚都能从运行时注册表取到(且是同一实例)', async () => {
    const { WORKTREE_TOOLS } = await import('../src/tools/worktree.js')
    // 枚数漂移(有人加/删工具)必须显式改本断言,不许静默
    expect(WORKTREE_TOOLS.map((t) => t.name)).toEqual(['enter_worktree', 'exit_worktree'])
    const { setupAgentTools } = await import('../src/commands/agent.js')
    await setupAgentTools({ workspacePath, silent: true })
    const { getTool } = await import('../src/tools/index.js')
    for (const tool of WORKTREE_TOOLS) {
      expect(getTool(tool.name), `worktree 工具 ${tool.name} 未挂进运行时注册表`).toBe(tool)
    }
  }, 60_000) // setupAgentTools 单跑实测数秒(全量注册工具族),并行全量下会越过 15s 默认预算

  it('worktreeCreate / worktreeRemove 是 HooksConfig 一等键,deepMergeHooks 按既有语义拼接', async () => {
    const { deepMergeHooks } = await import('../src/hooks/index.js')
    const a = { name: 'from-project', command: 'echo a' }
    const b = { name: 'from-user', command: 'echo b' }
    const merged = deepMergeHooks(
      { worktreeCreate: [a], worktreeRemove: [a] },
      { worktreeCreate: [b], worktreeRemove: [b] },
    )
    expect(merged.worktreeCreate?.map((e) => e.name)).toEqual(['from-project', 'from-user'])
    expect(merged.worktreeRemove?.map((e) => e.name)).toEqual(['from-project', 'from-user'])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
