// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。

// 深化P(2026-11-17):工具参数一句话摘要测试。
// 钉住:命令压一行、路径取尾段、搜索词直显、超长截断、无参数返回 null、多行命令压单行。

import { describe, expect, it } from 'vitest'
import { toolArgsSummary } from '../tool-args-summary'

describe('toolArgsSummary 深化P:工具参数一句话摘要', () => {
  it('命令族:提取 command 并压成一行', () => {
    expect(toolArgsSummary('run_command', { command: 'git status && npm test' })).toBe(
      'git status && npm test',
    )
  })

  it('命令族:多行命令压成单行', () => {
    expect(toolArgsSummary('run_command', { command: 'echo a\necho b\n\necho c' })).toBe(
      'echo a echo b echo c',
    )
  })

  it('命令族:超长命令截断到 80 字符 + 省略号', () => {
    const long = 'x'.repeat(100)
    const out = toolArgsSummary('run_command', { command: long })
    expect(out).not.toBeNull()
    expect((out as string).length).toBe(81) // 80 + '…'
    expect((out as string).endsWith('…')).toBe(true)
  })

  it('文件族:路径取尾段(只显示文件名)', () => {
    expect(toolArgsSummary('read_file', { file_path: '/a/b/c/app.ts' })).toBe('app.ts')
    expect(toolArgsSummary('write_file', { path: 'G:\\IHUI-AI\\README.md' })).toBe('README.md')
  })

  it('搜索族:显示搜索词', () => {
    expect(toolArgsSummary('search_files', { pattern: 'useLiveElapsed' })).toBe('useLiveElapsed')
    expect(toolArgsSummary('web_search', { query: 'react 19 新特性' })).toBe('react 19 新特性')
  })

  it('搜索词超长截断到 40 + 省略号', () => {
    const long = 'y'.repeat(60)
    const out = toolArgsSummary('search_files', { pattern: long })
    expect(out).not.toBeNull()
    expect((out as string).length).toBe(41) // 40 + '…'
  })

  it('无 args ⇒ null', () => {
    expect(toolArgsSummary('read_file', undefined)).toBeNull()
  })

  it('args 为空对象 ⇒ null(无参数可提取)', () => {
    expect(toolArgsSummary('think', {})).toBeNull()
  })

  it('未知工具且无可提取参数 ⇒ null(不造残标)', () => {
    expect(toolArgsSummary('some_unknown_tool', { foo: 'bar' })).toBeNull()
  })
})