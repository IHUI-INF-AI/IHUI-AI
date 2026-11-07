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
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  existsSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { copyOrPlaceholder } from '../src/services/registry-sync/config-migrator.js'
import { specService } from '../src/services/spec-service.js'
import { checkpointManager, codebaseIndexer, incrementalIndexer, permissionManager } from '../src/services/workspace-ai-service.js'
import type { SpecScope } from '@ihui/shared'

let scratchRoot: string
let savedRootsEnv: string | undefined

const scope: SpecScope = { type: 'workspace' }

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
    await expect(specService.listBranches(scratchRoot)).rejects.toThrow(/未启用/)
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
    await expect(specService.loadSpec(scratchRoot, scope, '../../some-evil')).rejects.toThrow(
      /版本号/,
    )
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

describe('读不到不覆盖', () => {
  function scratch(): string {
    return mkdtempSync(join(tmpdir(), 'ihui-unread-'))
  }

  it('备份源是目录时不写空占位', async () => {
    const dir = scratch()
    try {
      const src = join(dir, 'src')
      const dst = join(dir, 'dst')
      mkdirSync(src)
      await expect(copyOrPlaceholder(src, dst)).rejects.toThrow(/读不到/)
      expect(() => statSync(dst)).toThrow()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('备份源确实没有时才写空占位', async () => {
    const dir = scratch()
    try {
      const dst = join(dir, 'dst')
      await copyOrPlaceholder(join(dir, 'missing.txt'), dst)
      expect(readFileSync(dst, 'utf8')).toBe('')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('检查点文件读不到时不覆盖', () => {
    const dir = scratch()
    try {
      const file = join(dir, '.ihui', 'checkpoints.json')
      mkdirSync(file, { recursive: true })
      expect(() =>
        checkpointManager.snapshot(dir, { tool: 'write', description: 'x', files: [] }),
      ).toThrow(/读不到/)
      expect(statSync(file).isDirectory()).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('权限规则读不到时不说成没有拒绝规则', () => {
    const dir = scratch()
    try {
      const file = join(dir, '.claude', 'settings.json')
      mkdirSync(file, { recursive: true })
      expect(() => permissionManager.loadRules(dir)).toThrow(/读不到/)
      expect(statSync(file).isDirectory()).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('分支索引读不到时不建分支、不覆盖索引', async () => {
    const dir = scratch()
    const saved = process.env.IHUI_WORKSPACE_ROOTS
    process.env.IHUI_WORKSPACE_ROOTS = dir
    const index = join(dir, '.ihui-agent', 'specs', 'branches', 'index.json')
    mkdirSync(index, { recursive: true })
    try {
      await expect(
        specService.createBranch({
          scope,
          workspacePath: dir,
          branchName: 'feature-ok',
          baseVersion: 'latest',
        }),
      ).rejects.toThrow(/读不到/)
      expect(statSync(index).isDirectory()).toBe(true)
      expect(() =>
        statSync(join(dir, '.ihui-agent', 'specs', 'branches', 'feature-ok.md')),
      ).toThrow()
    } finally {
      if (saved === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
      else process.env.IHUI_WORKSPACE_ROOTS = saved
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('主规格读不到时不用分支覆盖', async () => {
    const dir = scratch()
    const saved = process.env.IHUI_WORKSPACE_ROOTS
    process.env.IHUI_WORKSPACE_ROOTS = dir
    try {
      const branch = await specService.createBranch({
        scope,
        workspacePath: dir,
        branchName: 'feature-ok',
        baseVersion: 'latest',
      })
      writeFileSync(
        join(dir, '.ihui-agent', 'specs', 'branches', 'feature-ok.md'),
        'branch body',
        'utf8',
      )
      const main = join(dir, '.ihui-agent', 'specs', `${branch.specId}.md`)
      mkdirSync(main, { recursive: true })
      await expect(
        specService.mergeBranch({ scope, workspacePath: dir, branchName: 'feature-ok' }),
      ).rejects.toThrow(/读不到/)
      expect(statSync(main).isDirectory()).toBe(true)
    } finally {
      if (saved === undefined) delete process.env.IHUI_WORKSPACE_ROOTS
      else process.env.IHUI_WORKSPACE_ROOTS = saved
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('规格文件读不到时流水线失败且不换成新正文', async () => {
    const { createHash } = await import('node:crypto')
    const ws = join(scratchRoot, 'ws-unread')
    mkdirSync(ws)
    const scopeObj = { type: scope.type, path: null }
    const hash = createHash('md5')
      .update(JSON.stringify(scopeObj, Object.keys(scopeObj).sort()), 'utf8')
      .digest('hex')
      .slice(0, 12)
    const specFile = join(ws, '.ihui-agent', 'specs', `${hash}.md`)
    mkdirSync(specFile, { recursive: true })
    writeFileSync(join(specFile, 'keep.txt'), 'keep', 'utf8')
    const result = await specService.runFullPipeline({
      workspacePath: ws,
      scope,
      newSpec: 'replacement',
      autoCommit: false,
    })
    expect(result.overallStatus).toBe('failed')
    expect(result.stages[0]?.log).toContain('规格原文读不到')
    expect(readFileSync(join(specFile, 'keep.txt'), 'utf8')).toBe('keep')
  })

  it('代码索引损坏时增量对比不覆盖原文件', () => {
    const ws = join(scratchRoot, 'idx-unread')
    const indexFile = join(ws, '.ihui', 'codebase-index.json')
    mkdirSync(join(ws, '.ihui'), { recursive: true })
    const body = '{not json'
    writeFileSync(indexFile, body, 'utf8')
    expect(() => incrementalIndexer.diff(ws)).toThrow(/代码索引读不到/)
    expect(readFileSync(indexFile, 'utf8')).toBe(body)
  })

  it('代码索引根是 null 时增量对比不覆盖原文件', () => {
    const ws = join(scratchRoot, 'idx-null')
    const indexFile = join(ws, '.ihui', 'codebase-index.json')
    mkdirSync(join(ws, '.ihui'), { recursive: true })
    writeFileSync(indexFile, 'null', 'utf8')
    expect(() => incrementalIndexer.diff(ws)).toThrow(/代码索引读不到/)
    expect(readFileSync(indexFile, 'utf8')).toBe('null')
  })

  it('工作区目录读不到时不写成空索引', () => {
    const missing = join(scratchRoot, 'idx-missing')
    expect(() => codebaseIndexer.index(missing)).toThrow(/不能把它覆盖成空索引/)
    expect(existsSync(join(missing, '.ihui', 'codebase-index.json'))).toBe(false)
  })

  it('分支文件读不到时差异对比不说成不存在', async () => {
    const branchDir = join(scratchRoot, '.ihui-agent', 'specs', 'branches', 'feature-ok.md')
    mkdirSync(branchDir, { recursive: true })
    writeFileSync(join(branchDir, 'keep.txt'), 'keep', 'utf8')
    await expect(
      specService.diffBranch({ scope, workspacePath: scratchRoot, branchName: 'feature-ok' }),
    ).rejects.toThrow(/不能把它说成不存在/)
    expect(readFileSync(join(branchDir, 'keep.txt'), 'utf8')).toBe('keep')
  })

  it('主规格读不到时差异对比不把主规格说成空的', async () => {
    const { createHash } = await import('node:crypto')
    const scopeObj = { type: scope.type, path: null }
    const hash = createHash('md5')
      .update(JSON.stringify(scopeObj, Object.keys(scopeObj).sort()), 'utf8')
      .digest('hex')
      .slice(0, 12)
    mkdirSync(join(scratchRoot, '.ihui-agent', 'specs', 'branches'), { recursive: true })
    writeFileSync(
      join(scratchRoot, '.ihui-agent', 'specs', 'branches', 'feature-ok.md'),
      'branch body\n',
      'utf8',
    )
    const mainFile = join(scratchRoot, '.ihui-agent', 'specs', `${hash}.md`)
    mkdirSync(mainFile, { recursive: true })
    writeFileSync(join(mainFile, 'keep.txt'), 'keep', 'utf8')
    await expect(
      specService.diffBranch({ scope, workspacePath: scratchRoot, branchName: 'feature-ok' }),
    ).rejects.toThrow(/不能把它说成空规格/)
    expect(readFileSync(join(mainFile, 'keep.txt'), 'utf8')).toBe('keep')
  })

  it('流水线记录不是目录时不说成没有', async () => {
    const backup = join(scratchRoot, '.ihui-agent', 'specs', 'backups', 'pipe1')
    mkdirSync(join(scratchRoot, '.ihui-agent', 'specs', 'backups'), { recursive: true })
    writeFileSync(backup, 'keep', 'utf8')
    await expect(
      specService.getPipelineStatus({
        workspacePath: scratchRoot,
        scope,
        pipelineId: 'pipe1',
      }),
    ).rejects.toThrow(/不能把它说成没有/)
    expect(readFileSync(backup, 'utf8')).toBe('keep')
  })
})
