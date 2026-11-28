// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

/**
 * 错拼建议 —— 未知工具时,模型要能在同一轮拿到"改哪个才对"的落点。
 *
 * 立因:名字拼错一个字符(`lsp_goto_efinition`、`memoryxrecall`)时,旧的
 * 整词/子串/词前缀三档全 0 分,`closest matches` 为空,模型只能盲试。
 * 补编辑距离两档后,130 枚注册名 × 三种错拼(删字符/换位/替换)= 388 例,
 * 建议 top3 含正确名的比例从 **73/388(18.8%)** 到 **388/388(100%)**。
 *
 * 边界:建议≠执行。错拼名经 `resolveToolName` 一律 undefined(距离档只进建议器),
 * 不会把模型没点名的工具拿去跑。
 */
import { describe, expect, it } from 'vitest'

import { normalizeToolName, resolveToolName, suggestToolNames } from '../src/tools/tool-name-resolve.js'

const NAMES = [
  'git_merge',
  'git_stash_push',
  'git_conflict_resolve',
  'read_file',
  'write_file',
  'run_command',
  'browser_screenshot',
  'browser_page_click',
  'hr_employee_list',
  'relay_pool_sweep',
  'api_list_endpoints',
  'lsp_goto_definition',
  'memory_recall',
  'terminal_open',
]

function typoForms(name: string): Array<[string, string]> {
  const out: Array<[string, string]> = []
  const mid = Math.floor(name.length / 2)
  const forms: Array<[string, string]> = [
    ['delete', name.slice(0, mid) + name.slice(mid + 1)],
    ['transpose', name.slice(0, mid - 1) + name[mid]! + name[mid - 1]! + name.slice(mid + 1)],
    ['substitute', name.slice(0, mid) + (name[mid] === 'x' ? 'z' : 'x') + name.slice(mid + 1)],
  ]
  // 换位遇到相邻同字符时会得到原名,那不是错拼,跳过。
  for (const [kind, typo] of forms) if (typo !== name && typo.length > 0) out.push([kind, typo])
  return out
}

describe('工具名错拼建议', () => {
  it(`错拼 top3 必须含正确名(${NAMES.length} 枚 × 3 种错拼)`, () => {
    const misses: string[] = []
    for (const name of NAMES) {
      for (const [kind, typo] of typoForms(name)) {
        const got = suggestToolNames(typo, NAMES, 3)
        if (!got.includes(name)) misses.push(`${kind}:${typo} -> [${got.join(',')}]`)
      }
    }
    expect(misses).toEqual([])
  })

  it('错拼不执行:建议档只进建议器,不进解析器', () => {
    for (const name of ['lsp_goto_definition', 'memory_recall', 'git_merge']) {
      for (const [, typo] of typoForms(name)) {
        const got = resolveToolName(typo, NAMES)
        // 换位恰好换的是分隔符与字母时,归一化后与原名同键 —— 那属于格式等价,解析回原名是对的;
        // 只有归一化后真不同的错拼才必须拒绝执行。
        if (normalizeToolName(typo) === normalizeToolName(name)) expect(got).toBe(name)
        else expect(got).toBeUndefined()
      }
    }
  })

  it('原有关键行为不被错拼档抢走:语义近名仍只给建议、正确拼写仍精确解析', () => {
    expect(resolveToolName('read', NAMES)).toBeUndefined()
    expect(suggestToolNames('read', NAMES, 3)).toContain('read_file')
    expect(resolveToolName('git-merge', NAMES)).toBe('git_merge')
  })
})
