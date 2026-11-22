// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 工作区文件桥 mkdir/move/stat 测试(2026-11-23)。
 * 判据与 FSBridge 同源:路径必须落 IHUI_WORKSPACE_ROOTS 登记根内。
 */

import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  fsBridge,
  sandboxTimeoutOutcome,
  settleSandboxJob,
} from '../src/services/workspace-ai-service.js'
import { WORKSPACE_ROOTS_ENV } from '../src/utils/workspace-roots.js'

let root: string
let previousRoots: string | undefined

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'ihui-fs-ops-'))
  previousRoots = process.env[WORKSPACE_ROOTS_ENV]
  process.env[WORKSPACE_ROOTS_ENV] = root
})

afterAll(() => {
  if (previousRoots === undefined) delete process.env[WORKSPACE_ROOTS_ENV]
  else process.env[WORKSPACE_ROOTS_ENV] = previousRoots
  rmSync(root, { recursive: true, force: true })
})

describe('FSBridge mkdir/move/stat', () => {
  it('递归建目录并读到目录元信息', () => {
    const result = fsBridge.mkdir({ path: 'nested/dir', workspacePath: root })
    expect(result.created).toBe(true)
    expect(fsBridge.stat({ path: 'nested/dir', workspacePath: root }).isDir).toBe(true)
    expect(fsBridge.mkdir({ path: 'nested/dir', workspacePath: root }).created).toBe(false)
  })

  it('写文件 → stat → move → 旧路径消失/新路径存在', () => {
    fsBridge.write({ path: 'nested/dir/a.txt', workspacePath: root, content: 'hello' })
    expect(fsBridge.stat({ path: 'nested/dir/a.txt', workspacePath: root }).size).toBe(5)
    fsBridge.move({
      from: 'nested/dir/a.txt',
      to: 'nested/dir/b.txt',
      workspacePath: root,
    })
    expect(existsSync(join(root, 'nested', 'dir', 'a.txt'))).toBe(false)
    expect(fsBridge.stat({ path: 'nested/dir/b.txt', workspacePath: root }).size).toBe(5)
  })

  it('目标存在时默认拒绝,overwrite=true 才替换', () => {
    fsBridge.write({ path: 'nested/dir/c.txt', workspacePath: root, content: 'c' })
    fsBridge.write({ path: 'nested/dir/d.txt', workspacePath: root, content: 'd' })
    expect(() =>
      fsBridge.move({ from: 'nested/dir/c.txt', to: 'nested/dir/d.txt', workspacePath: root }),
    ).toThrow('目标已存在')
    fsBridge.move({
      from: 'nested/dir/c.txt',
      to: 'nested/dir/d.txt',
      workspacePath: root,
      overwrite: true,
    })
    expect(fsBridge.stat({ path: 'nested/dir/d.txt', workspacePath: root }).size).toBe(1)
  })

  it('locate 按片段定位、locate-batch 批量返回且各自独立截断', () => {
    fsBridge.write({ path: 'nested/dir/report-final.md', workspacePath: root, content: 'r' })
    fsBridge.write({ path: 'nested/dir/notes.md', workspacePath: root, content: 'n' })
    const one = fsBridge.locate({ query: 'REPORT', workspacePath: root })
    expect(one.paths).toEqual(['nested/dir/report-final.md'])
    expect(one.truncated).toBe(false)

    const batch = fsBridge.locateBatch({
      queries: ['report', 'notes'],
      workspacePath: root,
      maxFilesPerQuery: 1,
    })
    expect(batch.results.map((r) => r.query)).toEqual(['report', 'notes'])
    expect(batch.results[0]?.paths).toEqual(['nested/dir/report-final.md'])
    expect(batch.results[1]?.paths).toEqual(['nested/dir/notes.md'])
    expect(() => fsBridge.locate({ query: '   ', workspacePath: root })).toThrow('query 不能为空')
  })

  it('locate 达到上限后仍数出精确省略数', () => {
    for (let i = 0; i < 5; i++) {
      fsBridge.write({
        path: `nested/dir/zzz-match-${i}.txt`,
        workspacePath: root,
        content: String(i),
      })
    }
    const hit = fsBridge.locate({ query: 'zzz-match', workspacePath: root, maxFiles: 2 })
    expect(hit.paths).toHaveLength(2)
    expect(hit.truncated).toBe(true)
    expect(hit.omitted).toBe(3)
    expect(hit.totalMatches).toBe(5)
    expect(hit.exact).toBe(true)
  })

  it('截止先到回结构化 TOOL_TIMEOUT,不把未判定伪装成失败退出码', () => {
    const verdict = settleSandboxJob({
      timeoutMs: 1000,
      killed: true,
      code: null,
      stdout: '',
      stderr: '',
    })
    expect(verdict.disposition).toBe('unjudged')
    expect(verdict.exitCode).toBeNull()
    expect(sandboxTimeoutOutcome(verdict, 1000)).toEqual({
      timedOut: true,
      timeoutMs: 1000,
      error: {
        name: 'ToolTimeoutError',
        code: 'TOOL_TIMEOUT',
        message: 'tool call timed out after 1000ms',
      },
    })
    // 按时完成/正常失败不得被标成超时
    const ok = settleSandboxJob({
      timeoutMs: 1000,
      killed: false,
      code: 0,
      stdout: 'ok',
      stderr: '',
    })
    expect(sandboxTimeoutOutcome(ok, 1000)).toEqual({})
  })

  it('write/edit 走原子替换,成功后不留 .tmp 中间件', () => {
    fsBridge.write({ path: 'nested/dir/atomic.txt', workspacePath: root, content: 'first' })
    expect(readFileSync(join(root, 'nested', 'dir', 'atomic.txt'), 'utf-8')).toBe('first')
    fsBridge.edit({
      path: 'nested/dir/atomic.txt',
      workspacePath: root,
      oldText: 'first',
      newText: 'second',
    })
    expect(readFileSync(join(root, 'nested', 'dir', 'atomic.txt'), 'utf-8')).toBe('second')
    const leftovers = readdirSync(join(root, 'nested', 'dir')).filter((name) =>
      name.endsWith('.tmp'),
    )
    expect(leftovers).toEqual([])
  })

  it('拒绝把路径移出登记根', () => {
    expect(() => fsBridge.mkdir({ path: '../../outside', workspacePath: root })).toThrow()
    expect(() =>
      fsBridge.move({ from: 'nested/dir/d.txt', to: '../../outside.txt', workspacePath: root }),
    ).toThrow()
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
