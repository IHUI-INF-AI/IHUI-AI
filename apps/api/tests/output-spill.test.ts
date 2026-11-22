// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工具输出 spill 判据(2026-11-23,对齐 DSH dsh-spill):
 * 超限必须保留全文可取回、locator 必须是工作区相对路径、客户端文件名不得穿越、
 * 保存失败不得把成功命令变失败、过期与超额清理必须真的删。
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  budgetWithSpill,
  saveToolOutputSpill,
  sanitizeSpillName,
  sweepSpillFiles,
} from '../src/services/output-spill.js'

function makeWorkspace(): string {
  return mkdtempSync(join(tmpdir(), 'ihui-spill-'))
}

describe('output spill', () => {
  it('超限保留头尾预览,全文落盘且字节数精确', () => {
    const workspace = makeWorkspace()
    const full = `${'头'.repeat(300)}${'中'.repeat(20_000)}${'尾'.repeat(300)}`
    const result = budgetWithSpill(full, 2_000, {
      workspacePath: workspace,
      owner: 'user-1',
      source: { toolName: 'run_command', label: 'stdout' },
      suggestedName: 'stdout.txt',
    })

    expect(result.truncated).toBe(true)
    expect(result.spill).toBeTruthy()
    expect(result.spill?.bytes).toBe(Buffer.byteLength(full, 'utf8'))
    expect(result.spill?.locator.startsWith('.ihui-agent/tool-spill/user-1/')).toBe(true)
    expect(result.spill?.locator.includes('..')).toBe(false)
    expect(result.spill?.retrievalHint).toContain(result.spill!.locator)
    const saved = readFileSync(join(workspace, result.spill!.locator), 'utf8')
    expect(saved).toBe(full)
    const dir = join(workspace, '.ihui-agent', 'tool-spill', 'user-1')
    expect(readdirSync(dir).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('未超限不落盘,行为与纯预算器一致', () => {
    const workspace = makeWorkspace()
    const result = budgetWithSpill('short', 2_000, {
      workspacePath: workspace,
      source: { toolName: 'run_command' },
    })
    expect(result.truncated).toBe(false)
    expect(result.spill).toBeUndefined()
    expect(existsSync(join(workspace, '.ihui-agent', 'tool-spill'))).toBe(false)
  })

  it('客户端文件名只当提示:路径穿越被清成单段', () => {
    expect(sanitizeSpillName('../../evil.txt')).toBe('evil.txt')
    expect(sanitizeSpillName('..\\..\\evil.sh')).toBe('evil.sh')
    expect(sanitizeSpillName('')).toBe('output.txt')
    expect(sanitizeSpillName('a'.repeat(200))).toBe('output.txt')
  })

  it('保存失败只回 spillError,不抛给命令调用方', () => {
    const result = budgetWithSpill('x'.repeat(5_000), 100, {
      workspacePath: join(tmpdir(), `ihui-missing-${Date.now()}`),
      source: { toolName: 'run_command' },
    })
    expect(result.truncated).toBe(true)
    expect(result.spill).toBeUndefined()
    expect(result.spillError).toContain('工作区不存在')
  })

  it('过期与超额清理真的删除', () => {
    const root = join(makeWorkspace(), '.ihui-agent', 'tool-spill', 'default')
    saveToolOutputSpill({
      workspacePath: join(root, '..', '..', '..'),
      source: { toolName: 't' },
      content: 'old',
    })
    const oldFile = readdirSync(root).map((n) => join(root, n))[0]!
    utimesSync(oldFile, new Date(1), new Date(1))
    const swept = sweepSpillFiles(root, Date.now(), 60_000, 1)
    expect(swept.removed).toBeGreaterThanOrEqual(1)
    expect(existsSync(oldFile)).toBe(false)
  })

  it('超过上限先删最旧', () => {
    const root = join(makeWorkspace(), '.ihui-agent', 'tool-spill', 'default')
    mkdirSync(root, { recursive: true })
    writeFileSync(join(root, 'a.txt'), 'a')
    writeFileSync(join(root, 'b.txt'), 'b')
    writeFileSync(join(root, 'c.txt'), 'c')
    utimesSync(join(root, 'a.txt'), new Date(1), new Date(1))
    utimesSync(join(root, 'b.txt'), new Date(2), new Date(2))
    const swept = sweepSpillFiles(root, Date.now(), 86_400_000, 1)
    expect(swept.removed).toBe(2)
    expect(existsSync(join(root, 'c.txt'))).toBe(true)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
