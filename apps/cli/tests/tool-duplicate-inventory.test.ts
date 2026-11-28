// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 内建重名台账 —— 钉住"哪些名字在两族里各有一份实现，且两份必须逐字节同签名"。
 *
 * 立因:2026-11-28 实测 `git.ts` 与 `git-advanced.ts` 有 **15 枚同名工具**
 * (`git_merge` / `git_branch_*` / `git_stash_*` / `git_conflict_*` / `git_tag_*` / `git_remote_*`)。
 * 两者都是 builtin 归属，`registerTools` 的同归属覆盖规则**允许后到者静默顶掉先到者** ——
 * 当前 15 对签名一致，所以行为无差；但这是"两份拷贝各改各的"的经典腐烂点：
 * 改了一边没改另一边，模型看到的 schema 和实际执行的行为就会分叉。
 *
 * 判据:清单必须**恰好**是这 15 个，且每一对签名(描述/危险级/参数/必填)完全一致。
 * 新增重名或两份实现分叉都会红 —— 前者要求显式决策，后者是真 bug。
 *
 * 口径边界:只查**内建族之间**的重名；MCP 跨归属冲突由 tool-name-collision.test.ts 管。
 */
import { describe, expect, it } from 'vitest'

import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { CODEGRAPH_TOOLS } from '../src/tools/codegraph.js'
import { LSP_TOOLS } from '../src/tools/lsp.js'
import { DEBUG_TOOLS } from '../src/tools/debug.js'
import { BROWSER_TOOLS } from '../src/tools/browser.js'
import { BROWSER_PAGE_TOOLS } from '../src/tools/browser-page.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import { RELAY_TOOLS } from '../src/tools/relay.js'
import { API_BRIDGE_TOOLS } from '../src/tools/api-bridge.js'
import { AI_BRIDGE_TOOLS } from '../src/tools/ai-bridge.js'
import type { Tool } from '../src/tools/index.js'

/** 已知重名清单(2026-11-28 实测)。新增一项必须同时说清为什么允许两份实现并存。 */
const KNOWN_DUPLICATES = [
  'git_branch_create',
  'git_branch_delete',
  'git_branch_list',
  'git_branch_switch',
  'git_conflict_resolve',
  'git_conflict_status',
  'git_merge',
  'git_rebase',
  'git_remote_add',
  'git_remote_list',
  'git_stash_list',
  'git_stash_pop',
  'git_stash_push',
  'git_tag_create',
  'git_tag_list',
]

const FAMILIES: Array<[string, Tool[]]> = [
  ['builtin', BUILTIN_TOOLS as Tool[]],
  ['git', GIT_TOOLS as Tool[]],
  ['git-advanced', GIT_ADVANCED_TOOLS as Tool[]],
  ['codegraph', CODEGRAPH_TOOLS as Tool[]],
  ['lsp', LSP_TOOLS as Tool[]],
  ['debug', DEBUG_TOOLS as Tool[]],
  ['browser', BROWSER_TOOLS as Tool[]],
  ['browser-page', BROWSER_PAGE_TOOLS as Tool[]],
  ['hr', HR_TOOLS as Tool[]],
  ['relay', RELAY_TOOLS as Tool[]],
  ['api-bridge', API_BRIDGE_TOOLS as Tool[]],
  ['ai-bridge', AI_BRIDGE_TOOLS as Tool[]],
]

/** 签名:描述 + 危险级 + 参数表 + 必填项。两份实现若分叉，这里必然不同。 */
function signature(tool: Tool): string {
  return JSON.stringify({
    description: tool.description,
    dangerLevel: tool.dangerLevel ?? null,
    parameters: tool.parameters,
    required: tool.required ?? [],
  })
}

function collectDuplicates(): Array<{ name: string; a: Tool; b: Tool; families: string[] }> {
  const byName = new Map<string, Array<{ family: string; tool: Tool }>>()
  for (const [family, tools] of FAMILIES) {
    for (const tool of tools) {
      const entries = byName.get(tool.name) ?? []
      entries.push({ family, tool })
      byName.set(tool.name, entries)
    }
  }
  return [...byName.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([name, entries]) => ({
      name,
      a: entries[0]!.tool,
      b: entries[1]!.tool,
      families: entries.map((entry) => entry.family),
    }))
}

describe('内建重名台账', () => {
  it('重名清单恰好是已知 15 枚(新增必须显式决策)', () => {
    const dups = collectDuplicates().map((entry) => entry.name).sort()
    expect(dups).toEqual([...KNOWN_DUPLICATES].sort())
  })

  it('每一对重名实现签名一致(改一边没改另一边就红)', () => {
    const divergent = collectDuplicates()
      .filter((entry) => signature(entry.a) !== signature(entry.b))
      .map((entry) => `${entry.name}(${entry.families.join(' vs ')})`)
    expect(divergent).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
