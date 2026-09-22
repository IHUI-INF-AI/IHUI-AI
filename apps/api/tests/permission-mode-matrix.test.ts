// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// 权限档 × 工具族 判定矩阵(G-163,blocking 级缺陷的回归网)。
//
// 立因:apps/api 的授权门 permissionManager.check() 此前是 **fail-open** ——
// 「非 default 档且无规则匹配 → { allowed: true }」,而它的入参枚举里明确有 `plan`。
// 于是客户端只要声明"只读计划档",写文件与执行命令一律放行:档位名承诺最严,
// 实现给的最松。现改穷尽矩阵,兜底方向只能是"更严"。
import { describe, expect, it, vi } from 'vitest'

const mockGetPermission = vi.fn()
const mockListRules = vi.fn()
const mockAppendAuditLog = vi.fn()

vi.mock('../src/db/workspace-permission-queries.js', () => ({
  getPermission: (userId: string, path: string) => mockGetPermission(userId, path),
  listRules: (userId: string, path: string) => mockListRules(userId, path),
  appendAuditLog: (data: unknown) => mockAppendAuditLog(data),
}))

import {
  decideByPermissionMode,
  permissionToolFamilyOf,
  permissionManager,
} from '../src/services/workspace-ai-service.js'

const ALL_MODES = ['default', 'acceptEdits', 'bypassPermissions', 'plan', 'manual'] as const

describe('permissionToolFamilyOf', () => {
  it('只读/编辑/执行三族按名字归类', () => {
    expect(permissionToolFamilyOf('read')).toBe('read')
    expect(permissionToolFamilyOf('Grep')).toBe('read')
    expect(permissionToolFamilyOf('write')).toBe('edit')
    expect(permissionToolFamilyOf('multi_edit')).toBe('edit')
    expect(permissionToolFamilyOf('run')).toBe('exec')
    expect(permissionToolFamilyOf('delete')).toBe('exec')
  })

  it('认不出的工具名落 unknown 而不是 edit(兜底必须更严)', () => {
    expect(permissionToolFamilyOf('teleport_to_prod')).toBe('unknown')
    expect(permissionToolFamilyOf('')).toBe('unknown')
  })
})

describe('decideByPermissionMode(穷尽矩阵)', () => {
  it('plan 档:只读放行,其余一律 deny —— 这条就是 G-163 的原缺陷', () => {
    expect(decideByPermissionMode('plan', 'read').verdict).toBe('allow')
    for (const tool of ['write', 'edit', 'run', 'delete', 'teleport_to_prod']) {
      expect(decideByPermissionMode('plan', tool)).toMatchObject({ verdict: 'deny' })
    }
  })

  it('acceptEdits 档:只读与编辑放行,执行/未知转人工(不再无条件放行)', () => {
    expect(decideByPermissionMode('acceptEdits', 'read').verdict).toBe('allow')
    expect(decideByPermissionMode('acceptEdits', 'write').verdict).toBe('allow')
    expect(decideByPermissionMode('acceptEdits', 'run').verdict).toBe('ask')
    expect(decideByPermissionMode('acceptEdits', 'whatever').verdict).toBe('ask')
  })

  it('default 与 manual 档:任何工具都要人工确认', () => {
    for (const mode of ['default', 'manual'] as const) {
      for (const tool of ['read', 'write', 'run']) {
        expect(decideByPermissionMode(mode, tool).verdict).toBe('ask')
      }
    }
  })

  it('bypassPermissions 是唯一全放档', () => {
    for (const tool of ['read', 'write', 'run', 'unknown_thing']) {
      expect(decideByPermissionMode('bypassPermissions', tool).verdict).toBe('allow')
    }
  })

  it('兜底方向:未注册档位绝不 allow(矩阵 default 分支 + 未知档)', () => {
    const verdict = decideByPermissionMode('yolo-mode' as (typeof ALL_MODES)[number], 'write')
    expect(verdict.verdict).toBe('ask')
  })

  it('全档 × 全族无遗漏:每格都必须给出 reason', () => {
    for (const mode of ALL_MODES) {
      for (const tool of ['read', 'write', 'run', 'weird']) {
        const d = decideByPermissionMode(mode, tool)
        expect(['allow', 'ask', 'deny']).toContain(d.verdict)
        expect(d.reason.length).toBeGreaterThan(3)
      }
    }
  })
})

describe('permissionManager.check(活的 HTTP 授权入口)', () => {
  const base = {
    userId: 'u-perm-matrix',
    workspacePath: '/tmp/ihui-perm-matrix',
    args: {},
  }

  it('plan 档写工具被直接拒绝,且不给出 requestId(不能靠"确认"蒙过)', async () => {
    const r = await permissionManager.check({ ...base, mode: 'plan', tool: 'write' })
    expect(r.allowed).toBe(false)
    expect(r.requestId).toBeUndefined()
    expect(r.reason).toContain('plan')
  })

  it('plan 档只读工具放行', async () => {
    const r = await permissionManager.check({ ...base, mode: 'plan', tool: 'read' })
    expect(r.allowed).toBe(true)
  })

  it('bypassPermissions 放行执行类工具', async () => {
    const r = await permissionManager.check({ ...base, mode: 'bypassPermissions', tool: 'run' })
    expect(r.allowed).toBe(true)
  })
})

describe('permissionManager.checkWorkspace(Agent 工具的真实闸门,G-163 上限接线)', () => {
  const base = {
    userId: 'u-ws-matrix',
    workspacePath: '/tmp/ihui-ws-matrix',
    args: { path: 'a.ts' },
  }

  /**
   * 阻塞式人工审计在单测里必须旁掉:它会等 WebSocket 回落到 60s 超时。
   * 只桩这一个私有方法,其余逻辑(归一 + 上限 + 规则梯)全部走真实代码。
   */
  const stubConfirmation = () => {
    const target = permissionManager as unknown as {
      requestWorkspaceConfirmation: (p: unknown) => Promise<{ allowed: boolean; reason: string }>
    }
    target.requestWorkspaceConfirmation = async () => ({ allowed: false, reason: 'stub-ask' })
  }

  it('DB 存 kebab 旧值(accept-edits)照样被识别为 acceptEdits 档', async () => {
    stubConfirmation()
    mockGetPermission.mockResolvedValue({ mode: 'accept-edits' })
    mockListRules.mockResolvedValue([])
    const r = await permissionManager.checkWorkspace({ ...base, tool: 'write' })
    // acceptEdits 档无规则匹配 → 走人工审计(allowed=false + reason),但档位已被认出来
    expect(mockAppendAuditLog).toHaveBeenCalled()
    const auditCall = mockAppendAuditLog.mock.calls.find(
      (c) =>
        typeof (c[0] as { reason?: string })?.reason === 'string' &&
        (c[0] as { reason: string }).reason.includes('accept'),
    )
    expect(auditCall ?? r.reason).toBeTruthy()
  })

  it('plan 档写工具在真实闸门被 deny,且不进入人工审计', async () => {
    stubConfirmation()
    mockGetPermission.mockResolvedValue({ mode: 'plan' })
    mockListRules.mockResolvedValue([])
    mockAppendAuditLog.mockClear()
    const r = await permissionManager.checkWorkspace({ ...base, tool: 'write' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toContain('plan')
    // 上限阶段就拒了,不该再产生"人工审计"这条流水
    expect(
      mockAppendAuditLog.mock.calls.some((c) =>
        String((c[0] as { reason?: string }).reason ?? '').includes('人工审计'),
      ),
    ).toBe(false)
  })

  it('认不出的档位不得被当成某个已列档位放行(按 default 最严)', async () => {
    stubConfirmation()
    mockGetPermission.mockResolvedValue({ mode: 'yolo-mode' })
    mockListRules.mockResolvedValue([])
    const r = await permissionManager.checkWorkspace({ ...base, tool: 'write' })
    expect(r.allowed).toBe(false)
    expect(r.mode).toBe('yolo-mode') // 回显仍是库中原值(对外契约不变)
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
