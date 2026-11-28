// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​‌‌​​​‌​​‌‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * code-mode 边界:白名单写的是真实工具名,no-shell 的排除表按族生效,检索不能越界。
 *
 * 立因:2026-11-28 实测两个洞。
 *   · read-only / review 的白名单写的是族名 `lsp`,而注册表里没有叫 `lsp` 的工具
 *     (真实名 lsp_goto_definition 等)⇒ 精确匹配下整族被挡,和 description 的承诺相反;
 *   · no-shell 的排除表写的是 `terminal` / `git` / `git_advanced`,真实名却带后缀
 *     ⇒ 终端族与 git 族整族漏禁,no-shell 面 42,851B,只比全量少 527B。
 *
 * 这里用**真实工具名**钉住边界,并钉 tool_search 的检索源必须随模式收窄:
 * 只读档不能通过检索拿到 write_file / git_merge 的 schema。
 */
import { describe, expect, it } from 'vitest'

import '../src/tools/index.js'
import { listTools, registerTools } from '../src/tools/index.js'
import { applyCodeMode, isToolAllowed, CODE_MODES } from '../src/tools/code-mode.js'
import { createToolSearchTool } from '../src/tools/tool-search.js'
import { BUILTIN_TOOLS } from '../src/tools/builtins.js'
import { GIT_TOOLS } from '../src/tools/git.js'
import { GIT_ADVANCED_TOOLS } from '../src/tools/git-advanced.js'
import { LSP_TOOLS } from '../src/tools/lsp.js'
import { CODEGRAPH_TOOLS } from '../src/tools/codegraph.js'
import {
  terminal_close,
  terminal_exec_sandboxed,
  terminal_open,
  terminal_read,
  terminal_resize,
  terminal_send,
} from '../src/tools/terminal.js'
import { DEBUG_TOOLS } from '../src/tools/debug.js'
import { HR_TOOLS } from '../src/tools/hr.js'
import { createFileEditTools } from '../src/tools/file-edit.js'

const CTX = {
  workspacePath: process.cwd(),
  sessionId: 'code-mode-boundary',
  turnId: 'turn-1',
  permissions: { mode: 'default' },
} as never

const TERMINAL_FAMILY = [
  terminal_open,
  terminal_send,
  terminal_read,
  terminal_resize,
  terminal_close,
  terminal_exec_sandboxed,
]

const FAMILIES = [
  BUILTIN_TOOLS,
  GIT_TOOLS,
  GIT_ADVANCED_TOOLS,
  LSP_TOOLS,
  CODEGRAPH_TOOLS,
  TERMINAL_FAMILY,
  DEBUG_TOOLS,
  HR_TOOLS,
  createFileEditTools(CTX),
]

describe('白名单必须写真实工具名', () => {
  it('read-only 放行只读 LSP 成员,挡掉会改文件的 lsp_rename_symbol', () => {
    expect(isToolAllowed(CODE_MODES['read-only'], 'lsp_goto_definition')).toBe(true)
    expect(isToolAllowed(CODE_MODES['read-only'], 'lsp_hover')).toBe(true)
    expect(isToolAllowed(CODE_MODES['read-only'], 'lsp_rename_symbol')).toBe(false)
    expect(isToolAllowed(CODE_MODES['review'], 'lsp_workspace_symbol')).toBe(true)
  })

  it('read-only 可以用 tool_search(否则 codegraph 这类被延迟的成员永远拿不到 schema)', () => {
    expect(isToolAllowed(CODE_MODES['read-only'], 'tool_search')).toBe(true)
    expect(isToolAllowed(CODE_MODES['review'], 'tool_search')).toBe(true)
  })

  it('旧名不再冒充能力:fetch_url 在,web_fetch / skill / view_file 不在', () => {
    expect(isToolAllowed(CODE_MODES['read-only'], 'fetch_url')).toBe(true)
    expect(isToolAllowed(CODE_MODES['read-only'], 'web_fetch')).toBe(false)
    expect(isToolAllowed(CODE_MODES['read-only'], 'Skill')).toBe(false)
    expect(isToolAllowed(CODE_MODES['read-only'], 'skill')).toBe(false)
    expect(isToolAllowed(CODE_MODES['read-only'], 'view_file')).toBe(false)
    expect(isToolAllowed(CODE_MODES['read-only'], 'Skill')).toBe(false)
  })
})

describe('no-shell 按族禁执行', () => {
  const spec = CODE_MODES['no-shell']

  it('终端族 / git 族 / 代码执行 / 调试启动 全挡', () => {
    for (const name of [
      'terminal_open',
      'terminal_send',
      'terminal_exec_sandboxed',
      'git_merge',
      'git_status',
      'run_command',
      'run_tests',
      'run_code',
      'debug_launch',
      'debug_attach',
      'debug_eval',
    ]) {
      expect(isToolAllowed(spec, name), name).toBe(false)
    }
  })

  it('派生子代理也挡(general 默认 all,会带出 run_command)', () => {
    expect(isToolAllowed(spec, 'dispatch_subagent')).toBe(false)
    expect(isToolAllowed(spec, 'spawn_parallel')).toBe(false)
  })

  it('写文件与只读能力照旧放行', () => {
    expect(isToolAllowed(spec, 'write_file')).toBe(true)
    expect(isToolAllowed(spec, 'read_file')).toBe(true)
    expect(isToolAllowed(spec, 'browser_navigate')).toBe(true)
  })
})

describe('tool_search 检索源随模式收窄', () => {
  registerTools(FAMILIES.flat())
  // 每条查询用独立实例:revealed 会把命中工具转成"已在前缀",共用实例会污染下一条断言。
  const ask = (mode: string, args: Record<string, unknown>) =>
    createToolSearchTool({
      revealed: new Set<string>(),
      tools: () => applyCodeMode(listTools(), mode).allowed,
    }).execute(args, CTX)

  it('read-only:能揭示被延迟的 codegraph / lsp,吐不出 write_file / git_merge', async () => {
    const graph = await ask('read-only', { queries: ['代码图谱'] })
    expect(graph.output).toContain('### codegraph')
    const lsp = await ask('read-only', { queries: ['跳转定义'] })
    expect(lsp.output).toContain('### lsp_goto_definition')
    const write = await ask('read-only', { tool_names: ['write_file'] })
    expect(write.output).not.toContain('write_file')
    const merge = await ask('read-only', { queries: ['合并分支'] })
    expect(merge.output).not.toContain('### git_merge')
  })

  it('no-shell:终端 / git 不可揭示,延迟的 HR 工具可揭示', async () => {
    const term = await ask('no-shell', { queries: ['打开终端'] })
    expect(term.output).not.toContain('terminal_open')
    const merge = await ask('no-shell', { queries: ['合并分支'] })
    expect(merge.output).not.toContain('git_merge')
    const hr = await ask('no-shell', { queries: ['员工列表'] })
    expect(hr.output).toContain('### hr_employee_list')
  })

  it('对照:full 模式下同一条查询能拿到 git_merge(证明上两条不是查询无效)', async () => {
    const merge = await ask('full', { queries: ['合并分支'] })
    // 危险/变更类工具按策略常驻前缀,不一定是延迟工具;此时检索结果只列名字,
    // 不能把"没返回 schema"误读成"没检索到"。
    expect(merge.output).toContain('git_merge')
  })
})
