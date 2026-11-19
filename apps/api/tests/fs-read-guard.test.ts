// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `read_file` 护栏单测（2026-11-20）。
 *
 * 钉住四件事：
 * ① startLine/endLine 真透传到文件桥（此前路由层有、工具层忽略）；
 * ② 超大文件按字符截断并带续读指引；
 * ③ 截断只影响回给模型的那段 —— 观察态仍记整文件，随后 edit_file 能直接改没被返回的部分；
 * ④ 二进制文件给结构化 FS_BINARY_FILE，不当文本读。
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

async function run(name: string, args: Record<string, unknown>): Promise<string> {
  return String(await tool(name).execute(args))
}

async function callJson(
  name: string,
  args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  return JSON.parse(await run(name, args)) as Record<string, unknown>
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-read-'))
  prevRoots = process.env[ROOTS_ENV]
  process.env[ROOTS_ENV] = root
})

afterAll(() => {
  if (prevRoots === undefined) delete process.env[ROOTS_ENV]
  else process.env[ROOTS_ENV] = prevRoots
  rmSync(root, { recursive: true, force: true })
})

describe('read_file 护栏', () => {
  it('R1 startLine/endLine 分段读生效', async () => {
    writeFileSync(join(root, 'r1.txt'), 'l1\nl2\nl3\nl4\n', 'utf-8')
    const out = await run('read_file', {
      path: 'r1.txt',
      workspacePath: root,
      startLine: 2,
      endLine: 3,
    })
    expect(out).toBe('l2\nl3')
  })

  it('R2 超大文件截断并带续读指引', async () => {
    writeFileSync(join(root, 'r2.txt'), 'A'.repeat(130_000) + '\nTAIL_ONLY_AT_END', 'utf-8')
    const out = await run('read_file', { path: 'r2.txt', workspacePath: root })
    expect(out.length).toBeLessThan(130_000)
    expect(out).toContain('read_file 截断')
    expect(out).toContain('startLine/endLine')
    expect(out).not.toContain('TAIL_ONLY_AT_END')
  })

  it('R3 截断后观察态仍记整文件，edit_file 可改未被返回的尾部', async () => {
    const name = 'r3.txt'
    writeFileSync(join(root, name), 'A'.repeat(130_000) + '\nTAIL_ONLY_AT_END', 'utf-8')
    await run('read_file', { path: name, workspacePath: root })
    const out = await callJson('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'TAIL_ONLY_AT_END',
      newText: 'TAIL_EDITED',
    })
    expect(out['ok']).toBe(true)
    expect(readFileSync(join(root, name), 'utf-8').endsWith('TAIL_EDITED')).toBe(true)
  })

  it('R4 二进制文件给 FS_BINARY_FILE，不按文本读', async () => {
    writeFileSync(join(root, 'r4.bin'), Buffer.from([0x50, 0x00, 0x01, 0x02, 0xff]))
    const out = await callJson('read_file', { path: 'r4.bin', workspacePath: root })
    expect(out['ok']).toBe(false)
    expect(out['code']).toBe('FS_BINARY_FILE')
  })

  it('R5 小文本原样返回（护栏不削弱原路径）', async () => {
    writeFileSync(join(root, 'r5.txt'), 'plain text here', 'utf-8')
    const out = await run('read_file', { path: 'r5.txt', workspacePath: root })
    expect(out).toBe('plain text here')
  })

  it('R6 list_dir 大目录默认截到 200 条并自述 total/truncated', async () => {
    const bigDir = join(root, 'big')
    mkdirSync(bigDir, { recursive: true })
    for (let i = 0; i < 250; i += 1)
      writeFileSync(join(bigDir, `f${String(i).padStart(3, '0')}.txt`), 'x')
    const out = await callJson('list_dir', { path: bigDir })
    expect(out['ok']).toBe(true)
    expect(out['total']).toBe(250)
    expect(out['truncated']).toBe(true)
    expect((out['entries'] as unknown[]).length).toBe(200)
    expect(String(out['hint'])).toContain('200')
  })

  it('R7 list_dir 小目录不截断（原路径不削弱）', async () => {
    const smallDir = join(root, 'small')
    mkdirSync(smallDir, { recursive: true })
    writeFileSync(join(smallDir, 'one.txt'), 'x')
    writeFileSync(join(smallDir, 'two.txt'), 'y')
    const out = await callJson('list_dir', { path: smallDir })
    expect(out['truncated']).toBe(false)
    expect(out['total']).toBe(2)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
