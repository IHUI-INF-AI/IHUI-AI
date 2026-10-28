// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect } from 'vitest'
import {
  extractShellCommands,
  isExecuteToolCall,
  isExploreToolCall,
  isShellToolCallAwaitingCommand,
  resolveToolCallFamily,
} from './explore-tool-call'

describe('extractShellCommands 多形态提取', () => {
  it('兼容 string / -lc 数组 / join 数组 / {cmd} 记录四种形态', () => {
    expect(extractShellCommands({ command: 'ls -la' })).toEqual(['ls -la'])
    expect(extractShellCommands(['bash', '-lc', 'rg foo'])).toEqual(['rg foo'])
    expect(extractShellCommands(['rg', 'foo', '--files'])).toEqual(['rg foo --files'])
    expect(
      extractShellCommands([{ cmd: 'cat a' }, { cmd: 'cat a' }, { cmd: 'pwd' }]),
    ).toEqual(['cat a', 'pwd'])
    expect(extractShellCommands({ script: 'cat a && pwd' })).toEqual(['cat a', 'pwd'])
    expect(extractShellCommands({ parsed_cmd: 'git status' })).toEqual(['git status'])
  })

  it('四键采集去重:同一段命令只出现一次', () => {
    expect(extractShellCommands({ command: 'cat a', cmd: 'cat a' })).toEqual(['cat a'])
  })

  it('空命令/空壳返回空数组(等待输入判据)', () => {
    expect(extractShellCommands({ command: '' })).toEqual([])
    expect(extractShellCommands({ command: '   ' })).toEqual([])
    expect(extractShellCommands({ command: 'bash -lc ""' })).toEqual([])
    expect(extractShellCommands(undefined)).toEqual([])
    expect(extractShellCommands({})).toEqual([])
  })

  it('shell 解包:剥 /bin/ 前缀、powershell 与成对引号', () => {
    expect(extractShellCommands({ command: '/bin/zsh -lc "ls -la"' })).toEqual(['ls -la'])
    expect(extractShellCommands({ command: 'bash -lc "cat a && pwd"' })).toEqual([
      'cat a',
      'pwd',
    ])
    expect(extractShellCommands({ command: "powershell -Command 'Get-Content a.txt'" })).toEqual([
      'Get-Content a.txt',
    ])
    expect(extractShellCommands({ command: 'pwsh.exe -c "gci | gc"' })).toEqual(['gci | gc'])
  })
})

describe('resolveToolCallFamily 词元归族', () => {
  it('按词元边界归族且大小写/分隔符不敏感', () => {
    expect(resolveToolCallFamily('execute')).toBe('shell')
    expect(resolveToolCallFamily('Bash')).toBe('shell')
    expect(resolveToolCallFamily('run_script')).toBe('shell')
    expect(resolveToolCallFamily('read_file')).toBe('file-read')
    expect(resolveToolCallFamily('edit_file')).toBe('file-write')
    expect(resolveToolCallFamily('grep_search')).toBe('search')
    expect(resolveToolCallFamily('explore')).toBe('explore')
    expect(resolveToolCallFamily('')).toBe('other')
  })

  it('普通名词不被词元前缀误判', () => {
    expect(resolveToolCallFamily('readme_wizard')).toBe('other')
    expect(resolveToolCallFamily('searchlight')).toBe('other')
  })
})

describe('isExploreToolCall 三分类决策序', () => {
  it('bash -lc "rg foo" = explore', () => {
    expect(isExploreToolCall({ kind: 'execute', input: { command: 'bash -lc "rg foo"' } })).toBe(
      true,
    )
  })

  it('重定向否决:rg foo > f 是 execute 而非 explore', () => {
    const call = { kind: 'execute', input: { command: 'bash -lc "rg foo > f"' } }
    expect(isExploreToolCall(call)).toBe(false)
    expect(isExecuteToolCall(call)).toBe(true)
  })

  it('for/while 包裹的只读探查也算 explore', () => {
    expect(
      isExploreToolCall({
        kind: 'execute',
        input: { command: 'for f in *.md; do cat "$f"; done' },
      }),
    ).toBe(true)
    expect(
      isExploreToolCall({
        kind: 'execute',
        input: { command: 'while read f; do head -50 "$f"; done < list.txt' },
      }),
    ).toBe(true)
  })

  it('sed -i 写命令否决探查', () => {
    const call = { kind: 'execute', input: { command: "sed -i 's/a/b/' file.txt" } }
    expect(isExploreToolCall(call)).toBe(false)
    expect(isExecuteToolCall(call)).toBe(true)
  })

  it('分段判据:cat && rm -rf 整体否决', () => {
    const call = { kind: 'execute', input: { command: 'cat a.txt && rm -rf build' } }
    expect(isExploreToolCall(call)).toBe(false)
    expect(isExecuteToolCall(call)).toBe(true)
  })

  it('git status = explore,git commit = execute', () => {
    const status = { kind: 'execute', input: { command: 'git status' } }
    const commit = { kind: 'execute', input: { command: 'git commit -m x' } }
    expect(isExploreToolCall(status)).toBe(true)
    expect(isExecuteToolCall(status)).toBe(false)
    expect(isExploreToolCall(commit)).toBe(false)
    expect(isExecuteToolCall(commit)).toBe(true)
  })

  it('PowerShell 只读别名命中白名单,remove-item 命中黑名单', () => {
    expect(isExploreToolCall({ kind: 'execute', input: { command: 'gci -Recurse' } })).toBe(true)
    expect(isExploreToolCall({ kind: 'execute', input: { command: 'Get-Content log.txt' } })).toBe(
      true,
    )
    expect(isExecuteToolCall({ kind: 'execute', input: { command: 'Remove-Item tmp.txt' } })).toBe(
      true,
    )
  })

  it('写文件族永远不是探查;读/搜索/探查族不看命令即探查', () => {
    expect(isExploreToolCall({ kind: 'write', input: { command: 'cat a' } })).toBe(false)
    expect(isExploreToolCall({ kind: 'read_file', input: { path: 'a.ts' } })).toBe(true)
    expect(isExploreToolCall({ kind: 'grep_search', input: {} })).toBe(true)
    expect(isExploreToolCall({ kind: 'explore', input: null })).toBe(true)
  })

  it('未知族既非探查也非执行', () => {
    const call = { kind: 'think', input: { command: 'rg foo' } }
    expect(isExploreToolCall(call)).toBe(false)
    expect(isExecuteToolCall(call)).toBe(false)
  })
})

describe('isShellToolCallAwaitingCommand / isExecuteToolCall', () => {
  it('空命令 shell = awaiting 且非 execute', () => {
    const call = { kind: 'execute', input: { command: '' } }
    expect(isShellToolCallAwaitingCommand(call)).toBe(true)
    expect(isExecuteToolCall(call)).toBe(false)
    expect(isExploreToolCall(call)).toBe(false)
  })

  it('有命令的 shell 调用不是 awaiting', () => {
    expect(
      isShellToolCallAwaitingCommand({ kind: 'bash', input: { command: 'ls' } }),
    ).toBe(false)
  })

  it('非 shell 族不判 execute 与 awaiting', () => {
    expect(isExecuteToolCall({ kind: 'read_file', input: {} })).toBe(false)
    expect(isShellToolCallAwaitingCommand({ kind: 'read_file', input: {} })).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
