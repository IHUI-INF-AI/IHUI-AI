// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * G-977965 装车回归:工具调用分类判据单一来源。
 *
 * 钉住两件行为:
 *  1) 分类不再由端内四张硬编码 Set 的 `Set.has` 全等比较决定 —— 词元归一生效
 *     (`run_shell` 归 shell、`search_codebase` 归 search),这是换判据的可见面;
 *  2) shell 族按 args 入参级细分成 探查/待命令/执行 三档,
 *     `rg foo` 与 `rm -rf` 不再同色 —— 这是本票要消灭的主症状。
 *
 * 反向对照(变异验证):把 resolveToolCallFamily 换回硬编码 Set,或把
 * isExploreToolCall 短路成恒 false,本组必须翻红。
 */
import { describe, it, expect } from 'vitest'
import {
  resolveToolCallFamily,
  extractShellCommands,
  isShellToolCallAwaitingCommand,
  isExploreToolCall,
  isExecuteToolCall,
} from '@/lib/explore-tool-call'
import type { AgentToolCall } from '@/hooks/use-agent-progress'

/** 与 tool-calls-section.tsx 同形的入参级细分(逐字照抄判定序,变了就该红) */
function shellRefinement(tool: AgentToolCall): 'awaiting' | 'explore' | 'execute' | null {
  const shape = { kind: tool.toolName, input: tool.args }
  if (resolveToolCallFamily(tool.toolName) !== 'shell') return null
  if (isShellToolCallAwaitingCommand(shape)) return 'awaiting'
  if (isExploreToolCall(shape)) return 'explore'
  if (isExecuteToolCall(shape)) return 'execute'
  return null
}

function tool(toolName: string, args: Record<string, unknown>): AgentToolCall {
  return {
    id: 't1',
    toolName,
    args,
    status: 'success',
    startedAt: '2026-10-03T00:00:00Z',
  }
}

describe('工具分类判据:词元归一生效(端内硬编码 Set 换不回来)', () => {
  it('shell 族按词元边界归族,不靠全等名单', () => {
    // 这三个都不在旧 EXEC_TOOLS(['run_command','execute','bash','shell'])里
    expect(resolveToolCallFamily('run_shell')).toBe('shell')
    expect(resolveToolCallFamily('powershell')).toBe('shell')
    expect(resolveToolCallFamily('execute_command')).toBe('shell')
  })

  it('旧名单上的名字结论不变(装车不回归)', () => {
    expect(resolveToolCallFamily('read_file')).toBe('file-read')
    expect(resolveToolCallFamily('edit_file')).toBe('file-write')
    expect(resolveToolCallFamily('grep')).toBe('search')
    expect(resolveToolCallFamily('run_command')).toBe('shell')
  })

  it('大小写与连字符差异不参与判定', () => {
    expect(resolveToolCallFamily('RUN-COMMAND')).toBe('shell')
    expect(resolveToolCallFamily('  Bash ')).toBe('shell')
  })

  it('普通名字不得因含子串被误判(词边界,不是 includes)', () => {
    // 逐字核实过:这两个名字都不含任何在册动词词元(读/写/搜/执行),必须落 other。
    // 反面样本要挑"看起来像但不在册"的:`readme_wizard` 含 read 子串、`brew`-类不含。
    expect(resolveToolCallFamily('readme_wizard')).toBe('other')
    expect(resolveToolCallFamily('threadpool_run')).toBe('other')
    expect(resolveToolCallFamily('filesystem_inspect')).toBe('other')
  })

  it('写/搜族认任意词位,读与执行族刻意只认词首', () => {
    // 这是实现的**不对称设计**,不是疏漏,断言要钉住它:
    //   · 写族正则 `(?:^|_)(?:edit|write|…)(?:_|$)` —— 任意词位都认,
    //     因为"在别的东西上写一下"始终是写(workflow_create / patch_apply 都是写)。
    //   · 读族正则 `^(?:read|view|open|…)` —— 只认词首,因为 `preview_read` 这类名字
    //     多数是"先预览再落盘",按读处理会漏掉真正的写;宁落 other 也不误判成安全读。
    //   · 执行族同理只认词首(`post_run_hook` 不是执行工具)。
    expect(resolveToolCallFamily('thread_create')).toBe('file-write')
    expect(resolveToolCallFamily('patch_apply')).toBe('file-write')
    expect(resolveToolCallFamily('fs_read')).toBe('other')
    expect(resolveToolCallFamily('post_run_hook')).toBe('other')
  })

  it('未知词元一律 other,由调用方兜底', () => {
    expect(resolveToolCallFamily('some_unknown_thing')).toBe('other')
    expect(resolveToolCallFamily('')).toBe('other')
    expect(resolveToolCallFamily(null)).toBe('other')
  })
})

describe('shell 族入参级细分:只读探查不得被染成有副作用执行', () => {
  it('rg 纯探查 ⇒ explore', () => {
    expect(shellRefinement(tool('run_command', { command: 'rg foo' }))).toBe('explore')
  })

  it('带重定向 ⇒ execute(同一个 shell 工具,因入参而改判)', () => {
    expect(shellRefinement(tool('run_command', { command: 'rg foo > out.txt' }))).toBe('execute')
  })

  it('删除类 ⇒ execute', () => {
    expect(shellRefinement(tool('run_command', { command: 'rm -rf build' }))).toBe('execute')
  })

  it('循环包裹的只读批处理仍算 explore(逐个提取后全判)', () => {
    const t = tool('run_command', { command: 'for f in *.md; do cat "$f"; done' })
    expect(shellRefinement(t)).toBe('explore')
  })

  it('已发壳但没补命令 ⇒ awaiting,不是 execute', () => {
    expect(shellRefinement(tool('run_command', {}))).toBe('awaiting')
    expect(shellRefinement(tool('run_command', { command: '' }))).toBe('awaiting')
  })

  it('git status / git diff 属只读探查', () => {
    expect(shellRefinement(tool('bash', { command: 'git status' }))).toBe('explore')
    expect(shellRefinement(tool('bash', { command: 'git diff HEAD' }))).toBe('explore')
  })

  it('非 shell 族不参与细分(细分结果恒 null)', () => {
    expect(shellRefinement(tool('read_file', { path: 'a.ts' }))).toBeNull()
    expect(shellRefinement(tool('edit_file', { path: 'a.ts' }))).toBeNull()
  })
})

describe('命令提取:多种入参形态都要拿到命令', () => {
  it('字符串形态', () => {
    expect(extractShellCommands({ command: 'rg foo' })).toEqual(['rg foo'])
  })

  it('数组形态:整体 join 成一条(分段在下游按运算符再切)', () => {
    // 实现契约是 join 而非逐条 push:`['rg','foo']` 表示一条 argv,
    // 逐条 push 会把 "rg" 与 "foo" 判成两条独立命令而丢掉它们的关系。
    expect(extractShellCommands({ command: ['rg', 'foo'] })).toEqual(['rg foo'])
  })

  it('`bash -lc <cmd>` 形态专门解包,不把壳名掺进命令', () => {
    expect(extractShellCommands({ command: ['bash', '-lc', 'rg foo'] })).toEqual(['rg foo'])
  })

  it('cmd / script / shell_command 等别名键同样提取得到', () => {
    expect(extractShellCommands({ cmd: 'rg foo' })).toEqual(['rg foo'])
    expect(extractShellCommands({ script: 'rg foo' })).toEqual(['rg foo'])
  })

  it('提取不到命令 ⇒ 空数组(由 awaiting 档接手,不得静默判成 execute)', () => {
    expect(extractShellCommands({})).toEqual([])
    expect(extractShellCommands(null)).toEqual([])
    expect(extractShellCommands({ command: '   ' })).toEqual([])
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
