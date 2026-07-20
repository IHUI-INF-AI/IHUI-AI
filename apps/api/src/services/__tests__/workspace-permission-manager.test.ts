/**
 * PermissionManager.checkWorkspace 单元测试
 *
 * 覆盖 3 种权限模式(default / accept-edits / bypass-permissions)
 * + 人工审计超时 + 决策解锁 + 越权保护 + WebSocket 不可用兜底。
 *
 * checkWorkspace 动态 import '../db/workspace-permission-queries.js',
 * 通过 vi.mock 拦截,无需真实 DB。
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// 必须在 import permissionManager 之前 hoist:env + mock DB queries
vi.hoisted(() => {
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test'
  process.env.JWT_SECRET ??= 'test-jwt-secret-for-vitest-at-least-32-chars'
})

const { mockGetPermission, mockListRules, mockAppendAuditLog, mockPushFn } = vi.hoisted(() => ({
  mockGetPermission: vi.fn(),
  mockListRules: vi.fn(),
  mockAppendAuditLog: vi.fn().mockResolvedValue(undefined),
  mockPushFn: vi.fn(),
}))

vi.mock('../../db/workspace-permission-queries.js', () => ({
  getPermission: mockGetPermission,
  listRules: mockListRules,
  appendAuditLog: mockAppendAuditLog,
}))

// 推进 1 个真实 tick(让 requestWorkspaceConfirmation 内部 Promise executor
// 中的 pushFn 同步调用进入调用栈,await Promise.resolve() 不够,需要 setTimeout)
const flushTick = () => new Promise<void>((r) => setTimeout(r, 0))

// permissionManager 是单例,必须在 mock 设置完成后再 import
const { permissionManager } = await import('../workspace-ai-service.js')

// 类型断言访问私有成员(用于重置内部状态 + 直接测试 private 方法)
type PMInternal = {
  workspacePending: Map<
    string,
    {
      req: {
        requestId: string
        userId: string
        tool: string
        args: Record<string, unknown>
        status: 'pending' | 'approved' | 'denied'
        createdAt: number
        resolvedAt: number | null
      }
      resolve: (result: { allowed: boolean; reason: string }) => void
      timer: ReturnType<typeof setTimeout>
    }
  >
  pushFn: ((userId: string, payload: unknown) => void) | null
  requestWorkspaceConfirmation: (params: {
    userId: string
    workspacePath: string
    tool: string
    args: Record<string, unknown>
  }) => Promise<{ allowed: boolean; reason: string }>
}
const pm = permissionManager as unknown as PMInternal

const USER = 'user-1'
const WORKSPACE = '/workspace'

function resetPermissionManager(): void {
  // 清理单例内部状态,避免测试间污染
  pm.workspacePending.clear()
  mockGetPermission.mockReset()
  mockListRules.mockReset()
  mockAppendAuditLog.mockReset().mockResolvedValue(undefined)
  mockPushFn.mockReset()
  // 默认设置一个 mock pushFn(测试 WS 不可用场景时再覆盖)
  permissionManager.setPushFn(mockPushFn as never)
}

function setPermissionMode(mode: 'default' | 'accept-edits' | 'bypass-permissions' | null): void {
  if (mode === null) {
    mockGetPermission.mockResolvedValue(undefined)
    return
  }
  mockGetPermission.mockResolvedValue({
    userId: USER,
    workspacePath: WORKSPACE,
    name: 'Test WS',
    techStack: null,
    mode,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
  } as never)
}

beforeEach(() => {
  resetPermissionManager()
})

describe('PermissionManager.checkWorkspace', () => {
  it('case 1: bypass-permissions 直接放行,不调 pushFn,不触发人工审计', async () => {
    setPermissionMode('bypass-permissions')
    const result = await permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/src/file.ts' },
    })
    expect(result.allowed).toBe(true)
    expect(result.mode).toBe('bypass-permissions')
    expect(result.matchedRule).toBeUndefined()
    // 推 WS 不应被调用(直接放行)
    expect(mockPushFn).not.toHaveBeenCalled()
    // 审计日志应记录
    expect(mockAppendAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        decision: 'allow',
        reason: expect.stringContaining('bypass-permissions'),
      }),
    )
  })

  it('case 2: default 模式触发人工审计(60s 阻塞),pushFn 推 WS 事件', async () => {
    setPermissionMode('default')
    const promise = permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.write',
      args: { path: '/workspace/a.ts', content: '...' },
    })
    // 推 microtask 让 requestWorkspaceConfirmation 内部的 pushFn 同步调用执行
    await flushTick()
    // 推 WS 应已触发
    expect(mockPushFn).toHaveBeenCalledTimes(1)
    expect(mockPushFn).toHaveBeenCalledWith(
      USER,
      expect.objectContaining({
        type: 'workspace.permission.request',
        tool: 'fs.write',
        workspacePath: WORKSPACE,
      }),
    )
    // 1 个 pending 应存在
    expect(pm.workspacePending.size).toBe(1)
    expect(permissionManager.listWorkspacePending(USER)).toHaveLength(1)

    // 解锁 allow
    const pendingReq = permissionManager.listWorkspacePending(USER)[0]!
    const ok = permissionManager.resolveWorkspace(pendingReq.requestId, USER, true)
    expect(ok).toBe(true)

    const result = await promise
    expect(result.allowed).toBe(true)
    expect(result.mode).toBe('default')
    expect(pm.workspacePending.size).toBe(0)
  })

  it('case 3: accept-edits 规则匹配放行,白名单 allow', async () => {
    setPermissionMode('accept-edits')
    mockListRules.mockResolvedValue([
      {
        id: 'r1',
        userId: USER,
        workspacePath: WORKSPACE,
        ruleType: 'path',
        pattern: '/workspace/src/*',
        operation: null,
        decision: 'allow',
        builtin: false,
        createdAt: new Date(),
      } as never,
    ])
    const result = await permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/src/index.ts' },
    })
    expect(result.allowed).toBe(true)
    expect(result.mode).toBe('accept-edits')
    expect(result.matchedRule).toBe('/workspace/src/*')
    expect(mockPushFn).not.toHaveBeenCalled()
  })

  it('case 4: accept-edits 规则匹配拒绝,白名单 deny', async () => {
    setPermissionMode('accept-edits')
    mockListRules.mockResolvedValue([
      {
        id: 'r2',
        userId: USER,
        workspacePath: WORKSPACE,
        ruleType: 'path',
        pattern: '/workspace/.env*',
        operation: null,
        decision: 'deny',
        builtin: false,
        createdAt: new Date(),
      } as never,
    ])
    const result = await permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/.env.production' },
    })
    expect(result.allowed).toBe(false)
    expect(result.mode).toBe('accept-edits')
    expect(result.matchedRule).toBe('/workspace/.env*')
    expect(mockPushFn).not.toHaveBeenCalled()
  })

  it('case 5: accept-edits 无匹配规则 → 走人工审计', async () => {
    setPermissionMode('accept-edits')
    mockListRules.mockResolvedValue([]) // 无规则
    const promise = permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.delete',
      args: { path: '/workspace/unknown.txt' },
    })
    await flushTick()
    expect(mockPushFn).toHaveBeenCalledTimes(1)

    // 解锁 deny
    const pendingReq = permissionManager.listWorkspacePending(USER)[0]!
    permissionManager.resolveWorkspace(pendingReq.requestId, USER, false, '敏感路径,拒绝')

    const result = await promise
    expect(result.allowed).toBe(false)
    expect(result.mode).toBe('accept-edits')
    expect(result.reason).toContain('拒绝')
  })

  it('case 6: 未配置权限(perm=null)→ mode=unset + allowed=false', async () => {
    setPermissionMode(null)
    const result = await permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/a.ts' },
    })
    expect(result.allowed).toBe(false)
    expect(result.mode).toBe('unset')
    expect(result.reason).toContain('未配置')
    expect(result.requestId).toBeUndefined()
    // 不应触发人工审计(perm 不存在直接拒绝,引导先 setup)
    expect(mockPushFn).not.toHaveBeenCalled()
  })

  it('case 7: 60s 超时自动拒绝', async () => {
    setPermissionMode('default')
    // 注入 fake timer
    vi.useFakeTimers()
    try {
      const promise = permissionManager.checkWorkspace({
        userId: USER,
        workspacePath: WORKSPACE,
        tool: 'fs.run',
        args: { command: 'rm -rf /' },
      })
      // 推进到 60s 临界点
      await vi.advanceTimersByTimeAsync(60_000)
      const result = await promise
      expect(result.allowed).toBe(false)
      expect(result.reason).toContain('超时')
      expect(pm.workspacePending.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  }, 30_000)

  it('case 8: 60s 内提前到时仍可解锁(不在临界点),timer 清理后不重复触发', async () => {
    setPermissionMode('default')
    vi.useFakeTimers()
    try {
      const promise = permissionManager.checkWorkspace({
        userId: USER,
        workspacePath: WORKSPACE,
        tool: 'fs.write',
        args: { path: '/workspace/x.ts' },
      })
      // 推 30s,用户决定 allow
      await vi.advanceTimersByTimeAsync(30_000)
      const pendingReq = permissionManager.listWorkspacePending(USER)[0]!
      permissionManager.resolveWorkspace(pendingReq.requestId, USER, true)
      const result = await promise
      expect(result.allowed).toBe(true)

      // 再推进 30s(timer 应已被 resolveWorkspace clearTimeout 清理),不应再次触发超时回调
      await vi.advanceTimersByTimeAsync(30_000)
      expect(pm.workspacePending.size).toBe(0)
    } finally {
      vi.useRealTimers()
    }
  }, 30_000)
})

describe('PermissionManager.resolveWorkspace', () => {
  beforeEach(() => {
    resetPermissionManager()
  })

  it('case 9: 不存在 requestId → 返回 false', () => {
    const ok = permissionManager.resolveWorkspace('nonexistent-id', USER, true)
    expect(ok).toBe(false)
  })

  it('case 10: 不同 userId 越权保护 → 返回 false', async () => {
    setPermissionMode('default')
    const promise = permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/a.ts' },
    })
    await flushTick()
    const pendingReq = permissionManager.listWorkspacePending(USER)[0]!
    // 攻击者 B 试图解锁 A 的请求
    const ok = permissionManager.resolveWorkspace(pendingReq.requestId, 'attacker-B', true)
    expect(ok).toBe(false)
    // 真实用户 A 仍可解锁
    const ok2 = permissionManager.resolveWorkspace(pendingReq.requestId, USER, false)
    expect(ok2).toBe(true)
    const result = await promise
    expect(result.allowed).toBe(false)
  })
})

describe('PermissionManager.listWorkspacePending', () => {
  beforeEach(() => {
    resetPermissionManager()
  })

  it('case 11: 按 userId 过滤,其他用户的 pending 不返回', async () => {
    // mock 按 userId 分流,两个 user 都有 perm(否则 B 请求会被 short-circuit)
    mockGetPermission.mockImplementation(
      async (userId: string, workspacePath: string) =>
        ({
          userId,
          workspacePath,
          name: 'Test WS',
          techStack: null,
          mode: 'default',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        }) as never,
    )
    // 序列化 2 个 checkWorkspace(每个之间等 30ms 让 dynamic import + microtask 链完成)
    const promiseA = permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.read',
      args: { path: '/workspace/a.ts' },
    })
    await new Promise<void>((r) => setTimeout(r, 30))
    const promiseB = permissionManager.checkWorkspace({
      userId: 'user-B',
      workspacePath: '/other',
      tool: 'fs.read',
      args: { path: '/other/a.ts' },
    })
    await new Promise<void>((r) => setTimeout(r, 30))
    expect(pm.workspacePending.size).toBe(2)
    const aPending = permissionManager.listWorkspacePending(USER)
    const bPending = permissionManager.listWorkspacePending('user-B')
    expect(aPending).toHaveLength(1)
    expect(bPending).toHaveLength(1)
    expect(aPending[0]?.userId).toBe(USER)
    expect(bPending[0]?.userId).toBe('user-B')

    // 清理避免 timer 泄漏
    permissionManager.resolveWorkspace(aPending[0]!.requestId, USER, false)
    permissionManager.resolveWorkspace(bPending[0]!.requestId, 'user-B', false)
    await promiseA
    await promiseB
  })
})

describe('WebSocket 不可用兜底', () => {
  beforeEach(() => {
    resetPermissionManager()
  })

  it('case 12: 未 setPushFn → checkWorkspace 立即拒绝,不挂死', async () => {
    setPermissionMode('default')
    // 显式清空 pushFn
    permissionManager.setPushFn(null as never)
    const result = await permissionManager.checkWorkspace({
      userId: USER,
      workspacePath: WORKSPACE,
      tool: 'fs.write',
      args: { path: '/workspace/a.ts' },
    })
    expect(result.allowed).toBe(false)
    expect(result.reason).toContain('WebSocket')
    expect(pm.workspacePending.size).toBe(0)
  })
})
