// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
// @vitest-need
/**
 * G-937952 [A4] 回归:Bash 副作用回写 readFileState(上游 tool/handlers/bash-read-file-state.ts 机制等价版)。
 *
 * 票面三判据各配正反对照:
 *  ① stale 回填:此前 Read 过的文件被命令改写 ⇒ 状态图条目摘除 + 输出尾部附
 *     "modified N file(s) you've previously read … Call Read before editing" 提示;
 *  ② cat 整文件回填:`cat a.ts` 完整输出 ⇒ 记全读条目,后续 read_file 短路免整读;
 *  ③ 截断不回填:stdout 被截断 ⇒ 一律不记(假新鲜比不新鲜更危险)。
 * 反例:旗标/多操作数/shell 操作符/内容不一致/工作区外/blocked 命令均不产生任何回填。
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { settleForegroundCommand } from '../src/tools/builtins.js'
import { read_file } from '../src/tools/builtins.js'
import {
  FILE_UNCHANGED_STUB,
  getReadFileStateMap,
  type ReadFileStateEntry,
} from '../src/tools/read-file-state.js'
import type { ToolContext } from '../src/tools/index.js'

let workDir = ''

beforeEach(() => {
  workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ihui-bash-read-state-'))
})

afterEach(() => {
  fs.rmSync(workDir, { recursive: true, force: true })
})

function mkCtx(): ToolContext {
  return { workspacePath: workDir } as unknown as ToolContext
}

function sandboxResult(over: Partial<Parameters<typeof settleForegroundCommand>[0]> = {}) {
  return {
    stdout: '',
    stderr: '',
    exitCode: 0,
    timedOut: false,
    truncated: false,
    blocked: false,
    ...over,
  } as Parameters<typeof settleForegroundCommand>[0]
}

function seedReadState(ctx: object, abs: string, _content: string): void {
  const stat = fs.statSync(abs)
  const entry: ReadFileStateEntry = {
    path: abs,
    isPartialView: false,
    mtimeMs: stat.mtimeMs,
    sizeBytes: stat.size,
    recordedAt: Date.now(),
  }
  getReadFileStateMap(ctx).set(JSON.stringify([abs, null, null]), entry)
}

describe('① stale 回填:此前 Read 过的文件被命令改写(票面验收:Read→eslint --fix→Edit 前的提示)', () => {
  it('命令改写已读文件 ⇒ 输出附 stale 提示 + 条目从状态图摘除', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'a.ts')
    fs.writeFileSync(abs, 'const a = 1;\n')
    seedReadState(ctx, abs, 'const a = 1;\n')

    // "eslint --fix":命令改写了文件(长度必须不同,防同毫秒 mtime 假新鲜)
    fs.writeFileSync(abs, 'const a = 1; /* fixed */\n')
    const out = settleForegroundCommand(sandboxResult({ stdout: 'fixed 1 problem' }), 'eslint a.ts --fix', ctx)

    expect(out.output).toContain("file(s) you've previously read")
    expect(out.output).toContain('call Read before editing')
    expect(out.output).toContain('a.ts')
    expect(getReadFileStateMap(ctx).size).toBe(0)
  })

  it('文件被删除也算 stale;未读过的路径不进提示', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'gone.txt')
    fs.writeFileSync(abs, 'x')
    seedReadState(ctx, abs, 'x')
    fs.rmSync(abs)
    const out = settleForegroundCommand(sandboxResult(), 'rm gone.txt', ctx)
    expect(out.output).toContain('previously read')
    expect(getReadFileStateMap(ctx).size).toBe(0)
  })

  it('文件未被改动 ⇒ 无提示、条目保留(反例)', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'keep.txt')
    fs.writeFileSync(abs, 'unchanged content\n')
    seedReadState(ctx, abs, 'unchanged content\n')
    const out = settleForegroundCommand(sandboxResult({ stdout: 'hi' }), 'echo hi', ctx)
    expect(out.output).not.toContain('previously read')
    expect(getReadFileStateMap(ctx).size).toBe(1)
  })

  it('blocked 的命令没跑过 ⇒ 不扫不提示(反例)', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'a.ts')
    fs.writeFileSync(abs, 'v1\n')
    seedReadState(ctx, abs, 'v1\n')
    fs.writeFileSync(abs, 'v2-different-length\n')
    const out = settleForegroundCommand(sandboxResult({ blocked: true }), 'evil', ctx)
    expect(out.output).not.toContain('previously read')
    expect(getReadFileStateMap(ctx).size).toBe(1)
  })
})

describe('② cat 整文件回填(票面验收:cat 后免整读)', () => {
  it('cat a.ts 完整输出 ⇒ 记全读条目;后续 read_file 短路 FILE_UNCHANGED_STUB', async () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'a.ts')
    const content = 'export const a = 1;\n'
    fs.writeFileSync(abs, content)

    const settled = settleForegroundCommand(sandboxResult({ stdout: content }), 'cat a.ts', ctx)
    expect(settled.success).toBe(true)
    expect(getReadFileStateMap(ctx).get(JSON.stringify([abs, null, null]))?.isPartialView).toBe(false)

    // 免整读:同一内容再 Read,命中短路
    const reread = await read_file.execute({ path: 'a.ts' }, ctx)
    expect(reread.output).toBe(FILE_UNCHANGED_STUB)
  })

  it('stdout 截断 ⇒ 不回填(票面判据③)', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'big.txt')
    const content = Array.from({ length: 100 }, (_, i) => `line-${i}`).join('\n')
    fs.writeFileSync(abs, content)
    settleForegroundCommand(sandboxResult({ stdout: content.slice(0, 50), truncated: true }), 'cat big.txt', ctx)
    expect(getReadFileStateMap(ctx).size).toBe(0)
  })

  it.each([
    ['cat -n a.ts', '旗标改变输出字节'],
    ['cat a.ts b.ts', '多操作数不是单文件全读'],
    ['cat a.ts; cat b.ts', 'shell 操作符'],
    ['cat missing.txt', '文件不存在'],
  ])('形状闸拒绝:%s(%s)', (command) => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'a.ts')
    fs.writeFileSync(abs, 'content\n')
    settleForegroundCommand(sandboxResult({ stdout: 'content\n' }), command, ctx)
    expect(getReadFileStateMap(ctx).size).toBe(0)
  })

  it('stdout 与盘上内容不一致 ⇒ 不回填(反例:改写后 cat 旧输出)', () => {
    const ctx = mkCtx()
    const abs = path.join(workDir, 'a.ts')
    fs.writeFileSync(abs, 'actual-on-disk\n')
    settleForegroundCommand(sandboxResult({ stdout: 'stale-output\n' }), 'cat a.ts', ctx)
    expect(getReadFileStateMap(ctx).size).toBe(0)
  })

  it('工作区外路径 ⇒ 不回填', () => {
    const ctx = mkCtx()
    const outside = path.join(os.tmpdir(), 'outside-of-workspace.txt')
    fs.writeFileSync(outside, 'outside\n')
    try {
      settleForegroundCommand(sandboxResult({ stdout: 'outside\n' }), `cat ${outside}`, ctx)
      expect(getReadFileStateMap(ctx).size).toBe(0)
    } finally {
      fs.rmSync(outside, { force: true })
    }
  })
})