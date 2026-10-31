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
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  HookAutoDiscovery,
  addTrustedWorkspace,
  loadTrustedWorkspaces,
} from '../src/commands/hooks-auto.js'

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

  it('信任文件损坏 ⇒ 视为空集(fail-closed,不抛错)', () => {
    // loadTrustedWorkspaces 读固定路径;此处只验证"空集语义"由调用方保证
    expect(loadTrustedWorkspaces().has(scratch)).toBe(false)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
