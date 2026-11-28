// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 检索相关性下限 —— 只砍噪声,不砍召回。
 *
 * 立因:top_k=5 会被"列表/list"这类泛词匹配的无关工具填满;它们一旦被揭示,
 * 就占住常驻前缀(还要吃揭示预算)。实测 49 条 golden 查询里,期望工具得分 /
 * 最高分最低 0.65、中位 1.00,所以 0.5 的下限砍不到真正对口的工具。
 */
import { describe, expect, it } from 'vitest'

import '../src/tools/index.js'
import { listTools, registerTools } from '../src/tools/index.js'
import { searchTools } from '../src/tools/tool-search.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import { RELAY_TOOLS } from '../src/tools/relay.js'
import { API_BRIDGE_TOOLS } from '../src/tools/api-bridge.js'
import { AI_BRIDGE_TOOLS } from '../src/tools/ai-bridge.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { createFileEditTools } from '../src/tools/file-edit.js'

const CTX = {
  workspacePath: process.cwd(),
  sessionId: 'tool-search-floor',
  turnId: 'turn-1',
  permissions: { mode: 'default' },
} as never

const FAMILIES = [
  BUILTIN_TOOLS,
  HR_TOOLS,
  RELAY_TOOLS,
  API_BRIDGE_TOOLS,
  AI_BRIDGE_TOOLS,
  GIT_TOOLS,
  GIT_ADVANCED_TOOLS,
  createFileEditTools(CTX),
]

function registry() {
  registerTools(FAMILIES.flat() as never)
  return listTools()
}

describe('检索相关性下限', () => {
  it('泛词噪声不再填满 top5(员工列表只剩对口的 HR 工具)', () => {
    const hits = searchTools(registry(), ['员工列表'], [], 5)
    const names = hits.map((hit) => hit.tool.name)
    expect(names[0]).toBe('hr_employee_list')
    // 改前这里会被 api_list_endpoints / git_branch_list 等 *_list 泛词命中填满。
    expect(names).not.toContain('api_list_endpoints')
    expect(names).not.toContain('git_branch_list')
  })

  it('返回的每一条都不低于最高分的 50%(下限是硬判据,不是装饰)', () => {
    for (const query of ['合并分支', '接口列表', '请假申请', '超时时间设置']) {
      const hits = searchTools(registry(), [query], [], 5)
      const top = hits[0]?.score ?? 0
      for (const hit of hits) expect(hit.score).toBeGreaterThanOrEqual(top * 0.5)
    }
  })

  it('名字点名命中不受下限约束(模型要的那枚必须在)', () => {
    const hits = searchTools(registry(), ['merge branch'], ['git_status'], 5)
    expect(hits.map((hit) => hit.tool.name)).toContain('git_status')
  })

  it('前缀族查询也照旧(名字来源走同一豁免)', () => {
    const hits = searchTools(registry(), [], ['git_branch'], 10)
    expect(hits.map((hit) => hit.tool.name)).toContain('git_branch_list')
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
