// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execGit, formatGitResult } from '../src/tools/git-shared.js'

/**
 * F-020 回归:git 派生根失败(ENOENT/EACCES)必须单独成档、透出 code。
 *
 * 修前:execGit 只处理 ETIMEDOUT / ENOBUFS,其余派生层错误落成 exitCode=null + 空 stderr +
 * error=undefined ⇒ 下游只看到「(无输出)」,无从诊断。
 * 用例走文件既有注入点 IHUI_GIT_BIN 指向不存在的路径(不改进程 PATH、零真实 git 派生)。
 */

const GIT_BIN_ENV = 'IHUI_GIT_BIN'

let tmpRoot = ''
let originalGitBin: string | undefined

beforeEach(() => {
  tmpRoot = mkdtempSync(join(tmpdir(), 'ihui-f020-'))
  originalGitBin = process.env[GIT_BIN_ENV]
  // 临时目录存在 ⇒ 失败原因只能是二进制不存在(不是 cwd 不存在)
  process.env[GIT_BIN_ENV] = join(tmpRoot, 'no-such-git-binary')
})

afterEach(() => {
  if (originalGitBin === undefined) delete process.env[GIT_BIN_ENV]
  else process.env[GIT_BIN_ENV] = originalGitBin
  try {
    rmSync(tmpRoot, { recursive: true, force: true })
  } catch {
    /* 临时目录清理失败不干扰断言 */
  }
})

describe('F-020:git 派生根失败单独成档', () => {
  it('git 不存在(ENOENT)⇒ spawnError 透出 code,不再是空 stderr 的"无输出"', () => {
    const r = execGit(['status', '--porcelain'], tmpRoot)

    expect(r.exitCode).toBeNull()
    expect(r.spawnError?.code).toBe('ENOENT')
    // 结果面可诊断:stderr 非空且点名 code
    expect(r.stderr.trim()).not.toBe('')
    expect(r.stderr).toContain('ENOENT')
    expect(r.stdout).toBe('')
    // 与预算封顶档互斥
    expect(r.killed).toBeUndefined()

    const fmt = formatGitResult(r)
    expect(fmt.success).toBe(false)
    expect(fmt.error).toContain('git 不可用(ENOENT)')
    expect(fmt.output).not.toBe('(无输出)')
    expect(fmt.output).toContain('ENOENT')
  })

  it('权限被拒(EACCES)档同样点名 code(不依赖平台差异,按结构构造)', () => {
    const fmt = formatGitResult({
      stdout: '',
      stderr: '[git-spawn-error] git 不可用(EACCES):可执行文件无执行权限',
      exitCode: null,
      spawnError: { code: 'EACCES', message: 'spawn git EACCES' },
    })
    expect(fmt.success).toBe(false)
    expect(fmt.error).toContain('git 不可用(EACCES)')
    expect(fmt.output).toContain('EACCES')
  })
})
