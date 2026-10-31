// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * spec-service 落盘容纳性单测(2026-10-31 安全强化第 10 批)。
 *
 * 修复前:workspacePath / branchName / version 全是客户端自报字符串,原样进
 * path.join ⇒ `branchName=../../Windows/Temp/pwn` 可穿越出 .ihui-agent/specs
 * 写服务器任意 .md(loadSpec/mergeBranch 的读侧同样可把穿越路径内容回吐)。
 * 钉住:登记根闸 fail-closed / branchName 白名单 / version 白名单 / 根内正常建分支
 * (闸不削合法能力,正向对照)。零网络、零 DB。
 */
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { specService } from '../src/services/spec-service.js'
import type { SpecScope } from '@ihui/shared'

let scratchRoot: string
let savedRootsEnv: string | undefined

const scope: SpecScope = { kind: 'project', id: 'containment-test' }

beforeEach(() => {
  scratchRoot = mkdtempSync(join(tmpdir(), 'ihui-spec-'))
  savedRootsEnv = process.env.IHUI_WORKSPACE_ROOTS
  process.env.IHUI_WORKSPACE_ROOTS = scratchRoot
})

afterEach(() => {
  if (savedRootsEnv === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
  else process.env.IHUI_WORKSPACE_ROOTS = savedRootsEnv
  rmSync(scratchRoot, { recursive: true, force: true })
})

describe('spec-service 登记根闸', () => {
  it('workspacePath 在登记根外 ⇒ createBranch 拒绝', async () => {
    await expect(
      specService.createBranch({
        scope,
        workspacePath: join(scratchRoot, '..'),
        branchName: 'feature-x',
        baseVersion: 'latest',
      }),
    ).rejects.toThrow(/未在服务端登记/)
  })

  it('IHUI_WORKSPACE_ROOTS 未登记 ⇒ fail-closed 拒绝', async () => {
    delete process.env.IHUI_WORKSPACE_ROOTS
    await expect(
      specService.listBranches(scratchRoot),
    ).rejects.toThrow(/未启用/)
  })
})

describe('spec-service 段白名单', () => {
  it('branchName 含 `..` 穿越 ⇒ 拒绝且不落盘', async () => {
    await expect(
      specService.createBranch({
        scope,
        workspacePath: scratchRoot,
        branchName: '../../escaped-pwn',
        baseVersion: 'latest',
      }),
    ).rejects.toThrow(/分支名/)
    expect(existsSync(join(scratchRoot, '..', 'escaped-pwn.md'))).toBe(false)
  })

  it('loadSpec 的 version 含 `..` 穿越 ⇒ 拒绝(读侧同面)', async () => {
    await expect(
      specService.loadSpec(scratchRoot, scope, '../../some-evil'),
    ).rejects.toThrow(/版本号/)
  })

  it('mergeBranch / diffBranch 的 branchName 穿越同面拒绝', async () => {
    await expect(
      specService.mergeBranch({ scope, workspacePath: scratchRoot, branchName: '../x' }),
    ).rejects.toThrow(/分支名/)
    await expect(
      specService.diffBranch({ scope, workspacePath: scratchRoot, branchName: 'a/b' }),
    ).rejects.toThrow(/分支名/)
  })
})

describe('spec-service 正向对照(闸不削合法能力)', () => {
  it('根内合法 branchName 照常建分支并写文件', async () => {
    mkdirSync(join(scratchRoot, '.ihui-agent', 'specs'), { recursive: true })
    writeFileSync(join(scratchRoot, '.ihui-agent', 'specs', `${'x'.repeat(0) || 'base'}.md`), '')

    const branch = await specService.createBranch({
      scope,
      workspacePath: scratchRoot,
      branchName: 'feature-ok',
      baseVersion: 'latest',
    })

    expect(branch.name).toBe('feature-ok')
    expect(branch.status).toBe('active')
    expect(existsSync(join(scratchRoot, '.ihui-agent', 'specs', 'branches', 'feature-ok.md'))).toBe(
      true,
    )
  })
})
