// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * `edit_file` 工具单测（2026-11-19，对照 dsh-tool-str-replace-editor + fs-observation-policy）。
 *
 * 钉住七件事：
 * ① 未观察即编辑 ⇒ FS_NOT_OBSERVED；② 读后编辑成功且只改命中处；
 * ③ 读后被外部改动 ⇒ FS_STALE_VERSION；④ 无命中 / 多处命中分别给结构化码；
 * ⑤ 文件不存在 ⇒ FS_NOT_FOUND；⑥ 空 oldText 直接拒绝；
 * ⑦ 编辑成功后观察态同步，同一文件紧接着再编辑无需重读。
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
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

async function call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const out = await tool(name).execute(args)
  return JSON.parse(String(out)) as Record<string, unknown>
}

/** read_file 返回裸文本（不是 JSON），单独一个帮手，避免 JSON.parse 误伤。 */
async function readOnce(path: string): Promise<void> {
  await tool('read_file').execute({ path, workspacePath: root })
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-edit-'))
  prevRoots = process.env[ROOTS_ENV]
  process.env[ROOTS_ENV] = root
})

afterAll(() => {
  if (prevRoots === undefined) delete process.env[ROOTS_ENV]
  else process.env[ROOTS_ENV] = prevRoots
  rmSync(root, { recursive: true, force: true })
})

describe('edit_file 唯一匹配替换', () => {
  it('A1 未读即编辑 ⇒ FS_NOT_OBSERVED', async () => {
    const name = 'a1.txt'
    writeFileSync(join(root, name), 'alpha beta gamma', 'utf-8')
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'beta',
      newText: 'BETA',
    })
    expect(out['code']).toBe('FS_NOT_OBSERVED')
    expect(readFileSync(join(root, name), 'utf-8')).toBe('alpha beta gamma')
  })

  it('A2 读后编辑成功，只改命中处', async () => {
    const name = 'a2.txt'
    writeFileSync(join(root, name), 'one two three', 'utf-8')
    await readOnce(name)
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'two',
      newText: 'TWO',
    })
    expect(out['occurrences']).toBe(1)
    expect(readFileSync(join(root, name), 'utf-8')).toBe('one TWO three')
  })

  it('A3 读后被外部改动 ⇒ FS_STALE_VERSION 且不写盘', async () => {
    const name = 'a3.txt'
    writeFileSync(join(root, name), 'v1 content', 'utf-8')
    await readOnce(name)
    writeFileSync(join(root, name), 'v2 changed by someone else', 'utf-8')
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'v1',
      newText: 'v3',
    })
    expect(out['code']).toBe('FS_STALE_VERSION')
    expect(readFileSync(join(root, name), 'utf-8')).toBe('v2 changed by someone else')
  })

  it('A4 无命中 ⇒ EDIT_NO_MATCH', async () => {
    const name = 'a4.txt'
    writeFileSync(join(root, name), 'nothing here', 'utf-8')
    await readOnce(name)
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'absent',
      newText: 'x',
    })
    expect(out['code']).toBe('EDIT_NO_MATCH')
  })

  it('A5 多处命中 ⇒ EDIT_NOT_UNIQUE', async () => {
    const name = 'a5.txt'
    writeFileSync(join(root, name), 'dup dup dup', 'utf-8')
    await readOnce(name)
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'dup',
      newText: 'once',
    })
    expect(out['code']).toBe('EDIT_NOT_UNIQUE')
    expect(readFileSync(join(root, name), 'utf-8')).toBe('dup dup dup')
  })

  it('A6 文件不存在 ⇒ FS_NOT_FOUND', async () => {
    const out = await call('edit_file', {
      path: 'missing.txt',
      workspacePath: root,
      oldText: 'a',
      newText: 'b',
    })
    expect(out['code']).toBe('FS_NOT_FOUND')
  })

  it('A7 空 oldText ⇒ EDIT_EMPTY_PATTERN', async () => {
    const name = 'a7.txt'
    writeFileSync(join(root, name), 'content', 'utf-8')
    await readOnce(name)
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: '',
      newText: 'x',
    })
    expect(out['code']).toBe('EDIT_EMPTY_PATTERN')
  })

  it('A8 编辑成功后观察态同步，紧接着再编辑无需重读', async () => {
    const name = 'a8.txt'
    writeFileSync(join(root, name), 'first second', 'utf-8')
    await readOnce(name)
    await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'first',
      newText: '1st',
    })
    const out = await call('edit_file', {
      path: name,
      workspacePath: root,
      oldText: 'second',
      newText: '2nd',
    })
    expect(out['occurrences']).toBe(1)
    expect(readFileSync(join(root, name), 'utf-8')).toBe('1st 2nd')
  })
})

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
