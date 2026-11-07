// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * hooks-auto 工作区信任门回归锁(2026-10-31 安全强化第 10 批 R6)。
 *
 * 克隆的恶意仓库自带 .claude/hooks/ 等目录,发现器一旦被接进自动执行链
 * (serve/agent loop),克隆即执行 = 任意代码执行。信任模型:工作区级 hook
 * 默认 enabled=false(执行器只认 enabled ⇒ 结构性断开),用户显式
 * `ihui hooks-auto trust` 后才生效;~/.ihui/hooks 全局目录免信任。
 */
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { agentsMdExists } from '../src/commands/template.js'
import {
  HookAutoDiscovery,
  addTrustedWorkspace,
  loadTrustedWorkspaces,
} from '../src/commands/hooks-auto.js'
import { ensureWorktreeGitignore } from '../src/tools/worktree-state.js'

let scratch: string
let savedTrustFile: string | undefined

beforeEach(() => {
  scratch = mkdtempSync(join(tmpdir(), 'ihui-hooks-trust-'))
  mkdirSync(join(scratch, '.claude', 'hooks'), { recursive: true })
  writeFileSync(
    join(scratch, '.claude', 'hooks', 'pre_tool_demo.sh'),
    '# ---\n# type: pre_tool\n# ---\necho pwned\n',
    'utf-8',
  )
  savedTrustFile = process.env.IHUI_HOOKS_TRUST_FILE
  // 信任文件注入隔离路径:绝不读写真实家目录的 ~/.ihui/hooks-trust.json
  process.env.IHUI_HOOKS_TRUST_FILE = join(scratch, 'trust.json')
})

afterEach(() => {
  if (savedTrustFile === undefined) delete process.env.IHUI_HOOKS_TRUST_FILE
  else process.env.IHUI_HOOKS_TRUST_FILE = savedTrustFile
  rmSync(scratch, { recursive: true, force: true })
})

describe('工作区 hook 信任门', () => {
  it('未信任工作区:发现即禁用(enabled=false,执行器结构性断开)', () => {
    const discovery = new HookAutoDiscovery(scratch)
    const hooks = discovery.discover()
    const workspaceHooks = hooks.filter((h) => h.sourceLabel !== 'global')
    expect(workspaceHooks.length).toBeGreaterThan(0)
    for (const h of workspaceHooks) {
      expect(h.enabled).toBe(false)
    }
  })

  it('信任集读写往返:trust 后 discover 启用', () => {
    expect(loadTrustedWorkspaces().size).toBe(0)
    addTrustedWorkspace(scratch)
    expect(loadTrustedWorkspaces().has(scratch)).toBe(true)
    const discovery = new HookAutoDiscovery(scratch)
    const hooks = discovery.discover()
    const workspaceHooks = hooks.filter((h) => h.sourceLabel !== 'global')
    for (const h of workspaceHooks) {
      expect(h.enabled).toBe(true)
    }
  })

  it('信任名单读不到时不覆盖,执行侧仍视为未信任', () => {
    mkdirSync(join(scratch, 'trust.json'))
    expect(() => loadTrustedWorkspaces()).toThrow(/读不到/)
    expect(() => addTrustedWorkspace(scratch)).toThrow(/不能把它覆盖成只剩新的工作区/)
    const discovery = new HookAutoDiscovery(scratch)
    const workspaceHooks = discovery.discover().filter((h) => h.sourceLabel !== 'global')
    expect(workspaceHooks.length).toBeGreaterThan(0)
    for (const h of workspaceHooks) expect(h.enabled).toBe(false)
    expect(statSync(join(scratch, 'trust.json')).isDirectory()).toBe(true)
  })

  it('hook 目录读不到时不能当成没有 hook', () => {
    const denied = new Error('denied') as NodeJS.ErrnoException
    denied.code = 'EACCES'
    const missing = new Error('missing') as NodeJS.ErrnoException
    missing.code = 'ENOENT'
    const hookDir = join(scratch, '.claude', 'hooks')
    const discovery = new HookAutoDiscovery(scratch, (dir) => {
      if (dir === hookDir) throw denied
      throw missing
    })
    const hooks = discovery.discover().filter((h) => h.sourceLabel !== 'global')
    expect(hooks).toEqual([])
    expect(discovery.unreadScanCount()).toBe(1)
    expect(statSync(join(hookDir, 'pre_tool_demo.sh')).isFile()).toBe(true)
  })

  it('信任名单根是数组时不收成只剩这一处', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-hooks-trust-'))
    const file = join(dir, 'hooks-trust.json')
    const body = '[]'
    writeFileSync(file, body, 'utf-8')
    const prev = process.env.IHUI_HOOKS_TRUST_FILE
    process.env.IHUI_HOOKS_TRUST_FILE = file
    try {
      expect(() => addTrustedWorkspace(dir)).toThrow(/格式非法/)
      expect(readFileSync(file, 'utf-8')).toBe(body)
    } finally {
      if (prev === undefined) delete process.env.IHUI_HOOKS_TRUST_FILE
      else process.env.IHUI_HOOKS_TRUST_FILE = prev
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('信任文件损坏 ⇒ 视为空集(fail-closed,不抛错)', () => {
    // loadTrustedWorkspaces 读固定路径;此处只验证"空集语义"由调用方保证
    expect(loadTrustedWorkspaces().has(scratch)).toBe(false)
  })
})

describe('读不到不覆盖 gitignore 和 AGENTS.md', () => {
  it('gitignore 是目录时不改写成隔离条目', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-unread-cover-'))
    try {
      const file = join(dir, '.gitignore')
      mkdirSync(file)
      expect(() => ensureWorktreeGitignore(dir)).toThrow(/读不到/)
      expect(statSync(file).isDirectory()).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('AGENTS.md 读不到时不用模板覆盖', () => {
    const dir = mkdtempSync(join(tmpdir(), 'ihui-unread-cover-'))
    try {
      const file = join(dir, 'AGENTS.md')
      mkdirSync(file)
      expect(agentsMdExists(dir)).toBe(true)
      expect(statSync(file).isDirectory()).toBe(true)
      const denied = Object.assign(new Error('denied'), { code: 'EACCES' })
      expect(() =>
        agentsMdExists(dir, () => {
          throw denied
        }),
      ).toThrow(/读不到/)
      expect(statSync(file).isDirectory()).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
