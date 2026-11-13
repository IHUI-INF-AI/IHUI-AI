// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * F-278 回归锁(2026-11-13)。
 *
 * 病灶:`~/.ihui/recent-workspaces.json` 是**全局共享**单文件,无 userId 维度,
 * 任何登录用户 GET /api/workspace/fs/recent 都能读到别人最近打开的绝对路径;
 * /fs/browse 也只校验「落在登记根内」,不查 workspace_permissions。
 *
 * 本文件锁:
 *   ① 用户 A 写入的 recent 不出现在用户 B 的读取结果(按 userId 分文件隔离);
 *   ② 无权限(已配置但被明确拒绝)的工作区被过滤;未配置权限的保留(首开 setup 流程);
 *   ③ 旧全局文件 recent-workspaces.json 不再被任何用户继承(不做跨用户迁移);
 *   ④ 出参结构不变:仍是数组,元素字段 path/name/lastOpened。
 *
 * 隔离:IHUI_STORE_ROOT 指向临时目录;checkWorkspace 被 spy 成纯内存判定,不触 DB。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fsBridge, permissionManager } from '../src/services/workspace-ai-service.js'

interface Decision {
  allowed: boolean
  configured: boolean
  mode: string | null
  reason: string
}

const DECISIONS: Record<string, Decision> = {
  '/srv/ws-allowed': { allowed: true, configured: true, mode: 'acceptEdits', reason: '规则放行' },
  '/srv/ws-denied': { allowed: false, configured: true, mode: 'acceptEdits', reason: '规则拒绝' },
  '/srv/ws-unconfigured': {
    allowed: false,
    configured: false,
    mode: null,
    reason: '工作区权限未配置,请先完成首次设置',
  },
}

let storeRoot: string
let originalStoreRoot: string | undefined
let checkSpy: ReturnType<typeof vi.spyOn>

function recentFile(userId: string): string {
  const key = createHash('sha256').update(userId).digest('hex').slice(0, 32)
  return join(storeRoot, 'recent-workspaces', `${key}.json`)
}

beforeAll(() => {
  originalStoreRoot = process.env.IHUI_STORE_ROOT
  storeRoot = mkdtempSync(join(tmpdir(), 'ihui-f278-'))
  process.env.IHUI_STORE_ROOT = storeRoot
})

afterAll(() => {
  if (originalStoreRoot === undefined) delete process.env.IHUI_STORE_ROOT
  else process.env.IHUI_STORE_ROOT = originalStoreRoot
  rmSync(storeRoot, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(join(storeRoot, 'recent-workspaces'), { recursive: true, force: true })
  rmSync(join(storeRoot, 'recent-workspaces.json'), { force: true })
  checkSpy = vi
    .spyOn(permissionManager, 'checkWorkspace')
    .mockImplementation((async (params: { workspacePath: string }) =>
      DECISIONS[params.workspacePath] ?? DECISIONS['/srv/ws-unconfigured']) as never)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('F-278 最近工作区按 userId 隔离', () => {
  it('① 用户 A 写入的 recent 不出现在用户 B 的读取结果', async () => {
    fsBridge.addRecent('user-a', { path: '/srv/ws-allowed', name: 'A 的项目' })

    expect(await fsBridge.loadRecent('user-b')).toEqual([])
    expect(await fsBridge.loadRecent('user-a')).toEqual([
      { path: '/srv/ws-allowed', name: 'A 的项目', lastOpened: expect.any(Number) },
    ])

    // 落盘维度也隔离:A 有独立文件,全局旧文件不得被创建
    expect(existsSync(recentFile('user-a'))).toBe(true)
    expect(existsSync(recentFile('user-b'))).toBe(false)
    expect(existsSync(join(storeRoot, 'recent-workspaces.json'))).toBe(false)
  })

  it('② 无权限的工作区被过滤,未配置权限的保留', async () => {
    fsBridge.addRecent('user-a', { path: '/srv/ws-denied', name: '被拒工作区' })
    fsBridge.addRecent('user-a', { path: '/srv/ws-allowed', name: '有权限工作区' })
    fsBridge.addRecent('user-a', { path: '/srv/ws-unconfigured', name: '待 setup 工作区' })

    const list = await fsBridge.loadRecent('user-a')

    expect(list.map((w) => w.path)).toEqual(['/srv/ws-unconfigured', '/srv/ws-allowed'])
    expect(checkSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-a',
        workspacePath: '/srv/ws-denied',
        enumerateOnly: true,
      }),
    )
  })

  it('③ 旧全局 recent-workspaces.json 不再被任何用户继承', async () => {
    writeFileSync(
      join(storeRoot, 'recent-workspaces.json'),
      JSON.stringify([{ path: '/srv/legacy-victim', name: 'victim', lastOpened: 1 }]),
      'utf-8',
    )

    expect(await fsBridge.loadRecent('user-a')).toEqual([])
    expect(await fsBridge.loadRecent('user-legacy')).toEqual([])
  })

  it('④ 出参仍是数组,元素字段保持 path/name/lastOpened', async () => {
    fsBridge.addRecent('user-a', { path: '/srv/ws-allowed', name: 'A 的项目' })

    const list = await fsBridge.loadRecent('user-a')

    expect(Array.isArray(list)).toBe(true)
    expect(list).toHaveLength(1)
    expect(Object.keys(list[0]!).sort()).toEqual(['lastOpened', 'name', 'path'])
  })
})
