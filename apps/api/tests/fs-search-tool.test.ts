// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `grep` / `glob` 工具单测（2026-11-20）。
 *
 * 钉住六件事：
 * ① 两个工具真的注册进了 AgentLoop（此前只有 HTTP 端点，模型无检索能力）；
 * ② 命中条数与单文件条数都有上限，回包自述 total/truncated 与续查指引；
 * ③ 二进制文件（含 NUL）跳过，不当文本扫；
 * ④ 忽略目录（node_modules 等）不扫；
 * ⑤ 三种 outputMode 回包形状各自正确；
 * ⑥ ReDoS 两道闸（超长 pattern / 嵌套量词）在工具层同样生效。
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { agentLoop } from '../src/services/workspace-ai-service.js'

const ROOTS_ENV = 'IHUI_WORKSPACE_ROOTS'
let root = ''
let prevRoots: string | undefined

function tool(name: string): { execute: (args: Record<string, unknown>) => Promise<unknown> } {
  const found = agentLoop.listTools().find((t) => t.name === name)
  if (!found) throw new Error(`工具未注册: ${name}`)
  return found
}

async function callJson(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return JSON.parse(String(await tool(name).execute(args))) as Record<string, unknown>
}

function write(rel: string, content: string): void {
  const full = join(root, rel)
  mkdirSync(join(full, '..'), { recursive: true })
  writeFileSync(full, content, 'utf-8')
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-search-'))
  prevRoots = process.env[ROOTS_ENV]
  process.env[ROOTS_ENV] = root
})

afterAll(() => {
  if (prevRoots === undefined) delete process.env[ROOTS_ENV]
  else process.env[ROOTS_ENV] = prevRoots
  rmSync(root, { recursive: true, force: true })
})

describe('grep / glob 工具', () => {
  it('S1 默认注册且 content 模式按 limit 截断并带指引', async () => {
    write('s1/a.txt', 'needle one\n')
    write('s1/b.txt', 'needle two\n')
    write('s1/c.txt', 'needle three\n')
    const out = await callJson('grep', {
      path: 's1',
      workspacePath: root,
      pattern: 'needle',
      limit: 2,
    })
    expect(out['ok']).toBe(true)
    expect(out['total']).toBe(3)
    expect(out['truncated']).toBe(true)
    expect(out['matches'] as unknown[]).toHaveLength(2)
    expect(String(out['hint'])).toContain('limit')
  })

  it('S2 单文件命中上限 20，超出标 truncated', async () => {
    write('s2/big.txt', Array.from({ length: 30 }, (_, i) => `hit ${i}`).join('\n'))
    const out = await callJson('grep', {
      path: 's2',
      workspacePath: root,
      pattern: 'hit',
      limit: 100,
    })
    expect(out['total']).toBe(20)
    expect(out['truncated']).toBe(true)
  })

  it('S3 二进制文件（含 NUL）跳过', async () => {
    write('s3/bin.dat', '\u0000\u0001needle-in-binary\u0000')
    write('s3/ok.txt', 'needle-in-text\n')
    const out = await callJson('grep', {
      path: 's3',
      workspacePath: root,
      pattern: 'needle',
      outputMode: 'files_with_matches',
    })
    expect(out['files']).toEqual(['ok.txt'])
  })

  it('S4 files_with_matches 与 count 各自回包正确', async () => {
    write('s4/a.txt', 'x\nx\n')
    write('s4/b.txt', 'x\n')
    const files = await callJson('grep', {
      path: 's4',
      workspacePath: root,
      pattern: 'x',
      outputMode: 'files_with_matches',
    })
    expect(files['total']).toBe(2)
    const counts = await callJson('grep', {
      path: 's4',
      workspacePath: root,
      pattern: 'x',
      outputMode: 'count',
    })
    expect(counts['counts']).toEqual({ 'a.txt': 2, 'b.txt': 1 })
  })

  it('S5 glob 支持 ** 递归并回 {ok,total,truncated}', async () => {
    write('s5/deep/nested/c.ts', '')
    write('s5/x.ts', '')
    write('s5/y.md', '')
    const out = await callJson('glob', {
      path: 's5',
      workspacePath: root,
      pattern: '**/*.ts',
    })
    expect(out['ok']).toBe(true)
    expect(out['total']).toBe(2)
    expect(out['truncated']).toBe(false)
    expect(out['files']).toEqual(['deep/nested/c.ts', 'x.ts'])
  })

  it('S6 glob 也按 limit 截断', async () => {
    write('s6/1.ts', '')
    write('s6/2.ts', '')
    const out = await callJson('glob', {
      path: 's6',
      workspacePath: root,
      pattern: '*.ts',
      limit: 1,
    })
    expect(out['total']).toBe(2)
    expect(out['truncated']).toBe(true)
    expect(out['files'] as unknown[]).toHaveLength(1)
  })

  it('S7 忽略目录（node_modules）不扫', async () => {
    write('s7/node_modules/pkg/index.ts', 'needle\n')
    write('s7/src/main.ts', 'needle\n')
    const grepOut = await callJson('grep', {
      path: 's7',
      workspacePath: root,
      pattern: 'needle',
    })
    expect((grepOut['matches'] as Array<{ file: string }>).map((m) => m.file)).toEqual([
      'src/main.ts',
    ])
    const globOut = await callJson('glob', {
      path: 's7',
      workspacePath: root,
      pattern: '**/*.ts',
    })
    expect(globOut['files']).toEqual(['src/main.ts'])
  })

  it('S8 无命中时 total=0 且不给 hint', async () => {
    write('s8/a.txt', 'nothing here\n')
    const out = await callJson('grep', {
      path: 's8',
      workspacePath: root,
      pattern: 'absent-token',
    })
    expect(out['total']).toBe(0)
    expect(out['truncated']).toBe(false)
    expect(out['hint']).toBeUndefined()
  })

  it('S9 caseSensitive 真生效（默认不敏感）', async () => {
    write('s9/a.txt', 'ABC\n')
    const insensitive = await callJson('grep', {
      path: 's9',
      workspacePath: root,
      pattern: 'abc',
    })
    expect(insensitive['total']).toBe(1)
    const sensitive = await callJson('grep', {
      path: 's9',
      workspacePath: root,
      pattern: 'abc',
      caseSensitive: true,
    })
    expect(sensitive['total']).toBe(0)
  })

  it('S10 glob 过滤只作用在文件名（与桥原语同语义）', async () => {
    write('s10/a.ts', 'needle\n')
    write('s10/b.md', 'needle\n')
    const out = await callJson('grep', {
      path: 's10',
      workspacePath: root,
      pattern: 'needle',
      glob: '*.ts',
    })
    expect((out['matches'] as Array<{ file: string }>).map((m) => m.file)).toEqual(['a.ts'])
  })

  it('S11 ReDoS 两道闸在工具层同样生效', async () => {
    write('s11/a.txt', 'aaaa\n')
    await expect(
      tool('grep').execute({
        path: 's11',
        workspacePath: root,
        pattern: '(a+)+$',
      }),
    ).rejects.toThrow(/嵌套量词/)
    await expect(
      tool('grep').execute({
        path: 's11',
        workspacePath: root,
        pattern: 'a'.repeat(201),
      }),
    ).rejects.toThrow(/200/)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
