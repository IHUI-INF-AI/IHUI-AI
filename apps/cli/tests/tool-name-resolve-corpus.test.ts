// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

import { describe, expect, it } from 'vitest'
import { resolveToolName, suggestToolNames } from '../src/tools/tool-name-resolve.js'

/**
 * 名字形态语料:真实历史里工具名的写法并不只有注册名一种。
 * 每个真实工具 × 14 种形态,全部必须落到同一枚注册名上才算"只消格式差异"。
 * 基线(2026-11-28 改前)72/168,改后 168/168。
 */
const NAMES = [
  'git_merge',
  'git_stash_push',
  'git_branch_create',
  'read_file',
  'write_file',
  'edit_file',
  'run_command',
  'browser_navigate',
  'browser_screenshot',
  'hr_leave_create',
  'relay_pool_sweep',
  'api_endpoint_list',
]

function camel(name: string): string {
  return name
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

const FORMS: ReadonlyArray<readonly [string, (name: string) => string]> = [
  ['camel', (n) => camel(n)],
  ['kebab', (n) => n.replace(/_/g, '-')],
  ['space', (n) => n.replace(/_/g, ' ')],
  ['upper', (n) => n.toUpperCase()],
  ['dot', (n) => n.replace(/_/g, '.')],
  ['trailing-space', (n) => `${n} `],
  ['functions-prefix', (n) => `functions.${n}`],
  ['tools-prefix', (n) => `tools.${n}`],
  ['mcp-prefix', (n) => `mcp__${n}`],
  ['mcp-server-prefix', (n) => `mcp__ihui__${n}`],
  ['cli-prefix', (n) => `cli.${n}`],
  ['tool-suffix', (n) => `${n}_tool`],
  ['functions-camel', (n) => `functions.${camel(n)}`],
  ['mcp-camel', (n) => `mcp__${camel(n)}`],
]

describe('工具名解析语料(格式差异全覆盖)', () => {
  it(`${NAMES.length} 枚工具 × ${FORMS.length} 种形态全部解析回注册名`, () => {
    const misses: string[] = []
    for (const name of NAMES) {
      for (const [label, make] of FORMS) {
        const input = make(name)
        if (resolveToolName(input, NAMES) !== name) misses.push(`${label}:${input}`)
      }
    }
    expect(misses).toEqual([])
  })

  it('语义近名不认(格式层不许越界成语义猜测)', () => {
    for (const wrong of ['Bash', 'Shell', 'Execute', 'Terminal', 'Read', 'Write']) {
      expect(resolveToolName(wrong, NAMES)).toBeUndefined()
    }
  })

  it('带包装的错名仍给得出建议(建议不等于执行)', () => {
    const out = suggestToolNames('functions.git_merg', NAMES)
    expect(out).toContain('git_merge')
    const mcpOut = suggestToolNames('mcp__ihui__git_stash', NAMES)
    expect(mcpOut).toContain('git_stash_push')
  })

  it('精确名永远优先;同档撞车判歧义,先窄后宽不误抢', () => {
    // 精确命中直接放行。
    expect(resolveToolName('foo_tool', ['foo', 'foo_tool'])).toBe('foo_tool')
    // 命名空间 + 后缀叠在一起:先剥命名空间得到 `foo_tool`,不该被后缀剥离带到 `foo`。
    expect(resolveToolName('functions.foo_tool', ['foo', 'foo_tool'])).toBe('foo_tool')
    // 同一档里两枚注册名归一后同键 ⇒ 歧义,不替模型选。
    expect(resolveToolName('foo-bar', ['foo_bar', 'foobar'])).toBeUndefined()
    expect(resolveToolName('functions.bar', ['bar', 'bar_baz'])).toBe('bar')
  })
})
