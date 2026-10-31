// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具族「活过 setupAgentTools」回归(2026-10-31,守门 131 的运行时盲区)。
 *
 * 守门 `scripts/check-tool-family-registered.mjs` 判的是**静态注册点存在**(import + 落在
 * registerTools 参数位)。它看不见另一个失效方向:`tools/index.ts` 顶层的模块副作用注册
 * (`registerLspTools()` / `registerMemoryTools()`)**先于** `setupAgentTools()` 执行,而后者
 * 首行 `clearTools()` 会把它们整族抹掉 ⇒ 静态门全绿、运行时工具表里一枚都没有。
 *
 * 本用例从**真实注册路径**取快照(不自己 registerTools 再自问自答),逐族断言每一枚工具
 * 都在 `setupAgentTools()` 之后的运行时表里。摘掉 `commands/agent.ts` 里任一族的
 * `registerTools(...)` 本用例必红(已做变异对照)。
 *
 * 枚举到 0 不算通过:每个族的枚数必须 > 0(判据失明不是绿)。
 *
 * 排除项只有一个,且必须带理由:
 *   - CLIPBOARD_TOOLS:feature flag 默认关(settings.clipboard.enabled),setup 里条件注册。
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// 必须先触发 index.js 完整加载:lsp.ts ↔ index.ts 是循环依赖,先直接 import lsp 会在
// vitest SSR 下撞 TDZ(与 lsp.test.ts / debug.test.ts 头注同一理由)。
import '../src/tools/index.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { GITHUB_PR_TOOLS } from '../src/tools/github-pr.js'
import { FETCH_TOOLS } from '../src/tools/fetch-url.js'
import { WEB_SEARCH_TOOLS } from '../src/tools/web-search.js'
import { TEST_TOOLS } from '../src/tools/run-tests.js'
import { DIAGNOSTIC_TOOLS } from '../src/tools/diagnostics.js'
import { DEBUG_TOOLS } from '../src/tools/debug.js'
import { CODEGRAPH_TOOLS } from '../src/tools/codegraph.js'
import { SKILL_TOOLS } from '../src/tools/skill-tool.js'
import { LSP_TOOLS } from '../src/tools/lsp.js'
import { MEMORY_TOOLS } from '../src/tools/memory.js'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import { WORKTREE_TOOLS } from '../src/tools/worktree.js'
import { CLIPBOARD_TOOLS } from '../src/tools/clipboard.js'

type NamedTool = { name?: string }

/** 已注册族:要求 setupAgentTools 之后每一枚都在运行时表里。 */
const REQUIRED_FAMILIES: Array<[string, NamedTool[]]> = [
  ['BUILTIN_TOOLS', BUILTIN_TOOLS as NamedTool[]],
  ['GIT_TOOLS', GIT_TOOLS as NamedTool[]],
  ['GIT_ADVANCED_TOOLS', GIT_ADVANCED_TOOLS as NamedTool[]],
  ['GITHUB_PR_TOOLS', GITHUB_PR_TOOLS as NamedTool[]],
  ['FETCH_TOOLS', FETCH_TOOLS as NamedTool[]],
  ['WEB_SEARCH_TOOLS', WEB_SEARCH_TOOLS as NamedTool[]],
  ['TEST_TOOLS', TEST_TOOLS as NamedTool[]],
  ['DIAGNOSTIC_TOOLS', DIAGNOSTIC_TOOLS as NamedTool[]],
  ['DEBUG_TOOLS', DEBUG_TOOLS as NamedTool[]],
  ['CODEGRAPH_TOOLS', CODEGRAPH_TOOLS as NamedTool[]],
  ['SKILL_TOOLS', SKILL_TOOLS as NamedTool[]],
  ['LSP_TOOLS', LSP_TOOLS as NamedTool[]],
  ['MEMORY_TOOLS', MEMORY_TOOLS as NamedTool[]],
  ['BROWSER_TOOLS', BROWSER_TOOLS as NamedTool[]],
  ['BROWSER_PAGE_TOOLS', BROWSER_PAGE_TOOLS as NamedTool[]],
  ['WORKTREE_TOOLS', WORKTREE_TOOLS as NamedTool[]],
]

describe('工具族活过 setupAgentTools(运行时注册表)', () => {
  let workspacePath: string

  beforeAll(() => {
    workspacePath = mkdtempSync(join(tmpdir(), 'ihui-toolfam-reg-'))
  })

  afterAll(() => {
    rmSync(workspacePath, { recursive: true, force: true })
  })

  it('每一族每一枚工具都能从 setupAgentTools 之后的运行时注册表取到(且是同一实例)', async () => {
    const { setupAgentTools } = await import('../src/commands/agent.js')
    await setupAgentTools({ workspacePath, silent: true })
    const { getTool } = await import('../src/tools/index.js')

    const missing: string[] = []
    let total = 0
    for (const [family, tools] of REQUIRED_FAMILIES) {
      expect(tools.length, `${family} 枚举到 0 枚 = 判据失明`).toBeGreaterThan(0)
      for (const tool of tools) {
        expect(tool.name, `${family} 里有工具缺 name`).toBeTruthy()
        total += 1
        const live = getTool(tool.name as string)
        if (!live) missing.push(`${family}.${tool.name}`)
        else if (live !== (tool as unknown)) missing.push(`${family}.${tool.name}(实例不一致)`)
      }
    }
    expect(total, '逐族总枚数必须 > 0').toBeGreaterThan(0)
    expect(missing, `这些工具在 setupAgentTools 之后从运行时表消失:${missing.join(', ')}`).toEqual([])
  }, 60_000)

  it('条件族(剪贴板)在默认设置下不出现 —— 防止 flag 语义被静默改成常开', async () => {
    const { getTool } = await import('../src/tools/index.js')
    const tools = CLIPBOARD_TOOLS as NamedTool[]
    expect(tools.length).toBeGreaterThan(0)
    for (const tool of tools) {
      expect(getTool(tool.name as string), `CLIPBOARD 默认关,${tool.name} 不该被注册`).toBeUndefined()
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
