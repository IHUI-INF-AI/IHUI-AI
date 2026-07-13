import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../src/db/index.js', () => {
  const mockDbSelect = vi.fn()
  return {
    db: {
      select: mockDbSelect,
    },
  }
})

vi.mock('@ihui/database', () => ({
  eduOrders: { id: 'id', userId: 'userId' },
  eduPayments: { id: 'id', userId: 'userId' },
  eduRefunds: { id: 'id', userId: 'userId' },
  eduInvoiceTitles: { id: 'id', userId: 'userId' },
  eduInvoiceApplications: { id: 'id', userId: 'userId' },
  files: { id: 'id', uploadedBy: 'uploadedBy' },
  projects: { id: 'id', userId: 'userId' },
}))

import { checkOwnership, idorGuard } from '../src/utils/idor-guard.js'
import { db } from '../src/db/index.js'

const mockDbSelect = db.select as unknown as ReturnType<typeof vi.fn>

function buildOwnedSelectChain(rows: unknown[]) {
  const limitFn = vi.fn().mockResolvedValue(rows)
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({ limit: limitFn }),
    }),
  }
}

describe('idor-guard — IDOR 防护', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('checkOwnership', () => {
    it('owner 匹配返回 true', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'order', 'r1')
      expect(r).toBe(true)
    })
    it('owner 不匹配返回 false', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([]))
      const r = await checkOwnership('u1', 'order', 'r1')
      expect(r).toBe(false)
    })
    it('未注册的资源类型默认拒绝', async () => {
      const r = await checkOwnership('u1', 'unknown-type', 'r1')
      expect(r).toBe(false)
      expect(mockDbSelect).not.toHaveBeenCalled()
    })
    it('payment 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'payment', 'r1')
      expect(r).toBe(true)
    })
    it('refund 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'refund', 'r1')
      expect(r).toBe(true)
    })
    it('invoice-title 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'invoice-title', 'r1')
      expect(r).toBe(true)
    })
    it('invoice-application 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'invoice-application', 'r1')
      expect(r).toBe(true)
    })
    it('file 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'file', 'r1')
      expect(r).toBe(true)
    })
    it('project 类型', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const r = await checkOwnership('u1', 'project', 'r1')
      expect(r).toBe(true)
    })
  })

  describe('idorGuard — preHandler hook', () => {
    function buildRequest(opts: {
      params?: Record<string, string>
      userId?: string
      roleId?: number
    }) {
      return {
        params: opts.params ?? {},
        userId: opts.userId,
        jwtPayload: opts.roleId !== undefined ? { roleId: opts.roleId } : undefined,
      } as never
    }
    function buildReply() {
      const sent: Array<{ status: number; body: unknown }> = []
      return {
        status(code: number) {
          return {
            send: (body: unknown) => {
              sent.push({ status: code, body })
            },
          }
        },
        _sent: sent,
      } as never
    }

    it('缺少资源 ID 返回 400', async () => {
      const hook = idorGuard('order')
      const req = buildRequest({ params: {} })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent[0]!.status).toBe(400)
    })

    it('未登录返回 401', async () => {
      const hook = idorGuard('order')
      const req = buildRequest({ params: { id: 'r1' } })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent[0]!.status).toBe(401)
    })

    it('管理员（roleId>=1）绕过校验', async () => {
      const hook = idorGuard('order')
      const req = buildRequest({ params: { id: 'r1' }, userId: 'u1', roleId: 1 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent).toHaveLength(0)
      // 不应调用 db
      expect(mockDbSelect).not.toHaveBeenCalled()
    })

    it('普通用户 owner 校验通过', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const hook = idorGuard('order')
      const req = buildRequest({ params: { id: 'r1' }, userId: 'u1', roleId: 0 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent).toHaveLength(0)
    })

    it('普通用户 owner 校验失败返回 403', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([]))
      const hook = idorGuard('order')
      const req = buildRequest({ params: { id: 'r1' }, userId: 'u1', roleId: 0 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent[0]!.status).toBe(403)
    })

    it('allowAdmin=false 时管理员也需校验', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([]))
      const hook = idorGuard('order', { allowAdmin: false })
      const req = buildRequest({ params: { id: 'r1' }, userId: 'u1', roleId: 1 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent[0]!.status).toBe(403)
    })

    it('自定义 idParam', async () => {
      mockDbSelect.mockReturnValue(buildOwnedSelectChain([{ id: 'r1' }]))
      const hook = idorGuard('order', { idParam: 'orderId' })
      const req = buildRequest({ params: { orderId: 'r1' }, userId: 'u1', roleId: 0 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent).toHaveLength(0)
    })

    it('自定义 idParam 缺失返回 400', async () => {
      const hook = idorGuard('order', { idParam: 'orderId' })
      const req = buildRequest({ params: { id: 'r1' }, userId: 'u1', roleId: 0 })
      const reply = buildReply()
      await hook(req, reply)
      const sent = (reply as unknown as { _sent: Array<{ status: number }> })._sent
      expect(sent[0]!.status).toBe(400)
    })
  })
})
