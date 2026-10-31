// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * agent-extended IDOR 防护单元测试(2026-08-02 立)。
 * 验证 commit ef76a13a26 修复的 IDOR Bug 2/4/6/7/8/14:
 * - Bug 2: PUT /withdrawal/:id ownership 校验 + status 字段从 Zod schema 剥离
 * - Bug 4: GET /buy/:id、GET/DELETE /withdrawal/:id、POST /withdrawal/batch-delete IDOR
 * - Bug 6: GET /need-task/:id、DELETE /upload/:id IDOR
 * - Bug 7: GET /usedetail/list 非 admin 强制按 user_id 过滤
 * - Bug 8: POST /need-task 强制 user_id = req.userId(防欺骗)
 * - Bug 14: requireActiveUser 拦截已注销账号(status=3)→ 401
 *
 * 测试模式:vi.hoisted + vi.mock + Fastify inject(对齐 ai-generation-idor.test.ts)。
 * 测试文件豁免 any(mock 类型断言必需,AGENTS.md §3),本文件尽量用精确类型。
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import type { FastifyRequest } from 'fastify'
import Fastify from 'fastify'
import type { JWTPayload } from '@ihui/auth'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireAdmin: vi.fn(),
  requireActiveUser: vi.fn(),
  authenticate: vi.fn(),
  dbExecute: vi.fn(),
  dbSelect: vi.fn(),
  dbInsert: vi.fn(),
  dbUpdate: vi.fn(),
  dbDelete: vi.fn(),
  syncSettlement: vi.fn(),
  calcPermission: vi.fn(),
  getHistory: vi.fn(),
  genOrderNo: vi.fn(),
}))

vi.mock('../src/plugins/auth.js', () => ({
  authenticate: mocks.authenticate,
  requireActiveUser: mocks.requireActiveUser,
  default: vi.fn(),
}))
vi.mock('../src/plugins/require-permission.js', () => ({
  requireAuth: mocks.requireAuth,
  requireAdmin: mocks.requireAdmin,
  requirePermission: vi.fn(() => mocks.requireAuth),
}))
vi.mock('../src/db/index.js', () => ({
  db: {
    execute: mocks.dbExecute,
    select: mocks.dbSelect,
    insert: mocks.dbInsert,
    update: mocks.dbUpdate,
    delete: mocks.dbDelete,
  },
}))
vi.mock('../src/services/settlement-service.js', () => ({
  syncAgentBuyToSettlement: mocks.syncSettlement,
}))
vi.mock('../src/services/agent-service.js', () => ({
  calculateAgentPermission: mocks.calcPermission,
}))
vi.mock('../src/services/context-manager-service.js', () => ({
  getConversationHistory: mocks.getHistory,
}))
vi.mock('../src/utils/crypto-random.js', () => ({
  generateOrderNumber: mocks.genOrderNo,
}))

import agentExtendedRoutes from '../src/routes/agent-extended.js'

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-abbb-bbbbbbbbbbbb'
const REC_ID = '11111111-1111-4111-8111-111111111111'

function makePayload(userId: string, roleId: number): JWTPayload {
  return { userId, phone: '', familyId: '', roleId }
}

/** 构造 thenable Drizzle query builder mock,await 后返回 finalValue。 */
function chain<T>(finalValue: T): unknown {
  const obj: Record<string, unknown> = {
    then: (resolve?: (v: T) => unknown, reject?: (e: unknown) => unknown) =>
      Promise.resolve(finalValue).then(resolve, reject),
  }
  for (const m of ['from', 'where', 'limit', 'offset', 'orderBy', 'values', 'set', 'returning']) {
    obj[m] = vi.fn().mockReturnValue(obj)
  }
  return obj
}

function asRegular(userId: string): void {
  mocks.requireAuth.mockImplementation(async (req: FastifyRequest) => {
    req.userId = userId
    req.jwtPayload = makePayload(userId, 0)
  })
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

function asAdmin(userId: string): void {
  mocks.requireAuth.mockImplementation(async (req: FastifyRequest) => {
    req.userId = userId
    req.jwtPayload = makePayload(userId, 1)
  })
  mocks.requireAdmin.mockImplementation(async (req: FastifyRequest) => {
    req.userId = userId
    req.jwtPayload = makePayload(userId, 1)
  })
  mocks.requireActiveUser.mockResolvedValue(undefined)
}

function asDeactivated(userId: string): void {
  mocks.requireAuth.mockImplementation(async (req: FastifyRequest) => {
    req.userId = userId
    req.jwtPayload = makePayload(userId, 0)
  })
  const err = new Error('账号已注销') as Error & { statusCode: number }
  err.statusCode = 401
  mocks.requireActiveUser.mockRejectedValue(err)
}

describe('agent-extended IDOR 防护', () => {
  const server = Fastify({ logger: false })

  beforeAll(async () => {
    await server.register(agentExtendedRoutes)
    await server.ready()
  })

  afterAll(async () => {
    await server.close()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockReset()
    mocks.requireAdmin.mockReset()
    mocks.requireActiveUser.mockReset()
    mocks.dbExecute.mockReset()
    mocks.dbSelect.mockReset()
    mocks.dbInsert.mockReset()
    mocks.dbUpdate.mockReset()
    mocks.dbDelete.mockReset()
    // 安全默认值:requireActiveUser 放行 + db 返回空
    mocks.requireActiveUser.mockResolvedValue(undefined)
    mocks.dbExecute.mockResolvedValue([])
    mocks.dbSelect.mockReturnValue(chain([]))
    mocks.dbInsert.mockReturnValue(chain([]))
    mocks.dbUpdate.mockReturnValue(chain([]))
    mocks.dbDelete.mockReturnValue(chain([]))
    mocks.syncSettlement.mockResolvedValue(undefined)
    mocks.calcPermission.mockResolvedValue({ hasPermission: true })
  })

  // ===== Bug 14:requireActiveUser 拦截已注销账号 =====
  describe('Bug 14:requireActiveUser 拦截已注销账号', () => {
    it('GET /withdrawal/:id 已注销账号 → 401(不触碰 DB)', async () => {
      asDeactivated(USER_A)
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(401)
      expect(res.json().message).toBe('账号已注销')
      expect(mocks.dbSelect).not.toHaveBeenCalled()
    })
  })

  // ===== 票「非会话 401 被当成会话死亡」(2026-10-30 代裁落地)=====
  // 会话死亡分支的唯一触发键是 HTTP 401 —— packages/api-client/src/client.ts 里
  // `result.status === 401 && !isAuthEndpoint(normalizedUrl)` 那一格(→ 静默续期 →
  // notifyUnauthorized → 端上弹「重新登录」并清登录态)。本仓判据不在测试里复刻(§22c),
  // 所以这里钉的是**出栈状态码与包络形状**这一唯一契约面:
  //   正向:未标注原因的抛出不得以 401 出栈(那会把服务侧故障说成用户掉线);
  //   反向:真会话结论(注销/未登录/查无此人)必须仍是 401,否则用户永远等不到登录屏。
  describe('非会话失败不得被读成会话死亡(preHandler catch 双通道收敛)', () => {
    it('requireActiveUser 抛未标注异常 → 502 + ACCOUNT_STATE_CHECK_FAILED,绝不以 401 出栈', async () => {
      asRegular(USER_A)
      mocks.requireActiveUser.mockRejectedValue(new Error('getaddrinfo ENOTFOUND pg-primary'))
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(502)
      expect(res.statusCode).not.toBe(401)
      const body = res.json()
      expect(body.code).toBe(502)
      expect(body.errorCode).toBe('ACCOUNT_STATE_CHECK_FAILED')
      // 短路语义不变:preHandler 拒了就不会碰 handler,更不会查库
      expect(mocks.dbSelect).not.toHaveBeenCalled()
    })

    it('未标注异常的原文只进日志、不进响应体(依赖故障/SQL 细节不得回显)', async () => {
      asRegular(USER_A)
      mocks.requireActiveUser.mockRejectedValue(
        new Error('relation "zhs_agent_withdrawal_detail" does not exist -- token=secret'),
      )
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(502)
      expect(res.json().message).toBe('操作失败,请稍后重试')
      expect(res.body).not.toContain('does not exist')
      expect(res.body).not.toContain('secret')
    })

    it('反向对照:账号已注销(status=3)仍是 401 + 原文案,包络形状逐字不变', async () => {
      asDeactivated(USER_A)
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(401)
      const body = res.json()
      expect(body).toEqual({ code: 401, message: '账号已注销' })
      // 无 errorCode 的既有结论不得被凭空补出键来(补了就是改变契约形状)
      expect('errorCode' in body).toBe(false)
    })

    it('反向对照:未登录与查无此人这两型真会话结论仍按 401 出栈', async () => {
      for (const message of ['Authentication required', 'User not found']) {
        asRegular(USER_A)
        const err = new Error(message) as Error & { statusCode: number }
        err.statusCode = 401
        mocks.requireActiveUser.mockRejectedValue(err)
        const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
        expect(res.statusCode).toBe(401)
        expect(res.json().message).toBe(message)
      }
    })

    it('带 statusCode 的结论(502)保留状态码,并把 errorCode 透出(此前在这一步被剥掉)', async () => {
      asRegular(USER_A)
      const err = new Error('操作失败,请稍后重试') as Error & {
        statusCode: number
        errorCode: string
      }
      err.statusCode = 502
      err.errorCode = 'ACCOUNT_STATE_CHECK_FAILED'
      mocks.requireActiveUser.mockRejectedValue(err)
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(502)
      expect(res.json()).toEqual({
        code: 502,
        message: '操作失败,请稍后重试',
        errorCode: 'ACCOUNT_STATE_CHECK_FAILED',
      })
    })

    it('权限类结论(403)同样逐字透传,不被本票的收敛改成 502', async () => {
      asRegular(USER_A)
      const err = new Error('CSRF 校验失败') as Error & { statusCode: number }
      err.statusCode = 403
      mocks.requireActiveUser.mockRejectedValue(err)
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toBe('CSRF 校验失败')
    })
  })

  // ===== Bug 2:PUT /withdrawal/:id ownership + status 剥离 =====
  describe('Bug 2:PUT /withdrawal/:id', () => {
    it('非 admin 改他人提现 → 403(不触发 update)', async () => {
      asRegular(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ userId: USER_B }]))
      const res = await server.inject({
        method: 'PUT',
        url: `/withdrawal/${REC_ID}`,
        payload: { amount: 100 },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('他人')
      expect(mocks.dbUpdate).not.toHaveBeenCalled()
    })

    it('非 admin 改自己提现但传 status/amount/type → 三个字段全被 schema 剥离', async () => {
      // 2026-10-31 安全强化第 10 批 R10 收紧：amount 与 type 也进了不可改集。
      // 此前只剥离 status，owner 可把待审单金额从 1 元改成 10 万（审批人看到的就是
      // 改后的行）—— 等于申请人自己决定打款金额。金额只应在创建时由服务端按余额定死。
      asRegular(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ userId: USER_A }]))
      const updateChain = chain([{ id: REC_ID, status: 'pending' }])
      mocks.dbUpdate.mockReturnValue(updateChain)
      const res = await server.inject({
        method: 'PUT',
        url: `/withdrawal/${REC_ID}`,
        payload: { amount: 100, type: 2, status: 'completed' },
      })
      expect(res.statusCode).toBe(200)
      const setArg = updateChain.set.mock.calls[0][0] as Record<string, unknown>
      expect(setArg.status).toBeUndefined()
      expect(setArg.amount).toBeUndefined()
      expect(setArg.type).toBeUndefined()
    })

    it('admin 改任意提现 → 200(特权放行)', async () => {
      asAdmin(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ userId: USER_B }]))
      mocks.dbUpdate.mockReturnValue(chain([{ id: REC_ID, status: 'pending' }]))
      const res = await server.inject({
        method: 'PUT',
        url: `/withdrawal/${REC_ID}`,
        payload: { amount: 200 },
      })
      expect(res.statusCode).toBe(200)
    })
  })

  // ===== Bug 4:多端点 IDOR =====
  describe('Bug 4:buy/withdrawal IDOR', () => {
    it('GET /buy/:id 非 admin 访问他人 → 403', async () => {
      asRegular(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ id: REC_ID, userId: USER_B }]))
      const res = await server.inject({ method: 'GET', url: `/buy/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('他人')
    })

    it('GET /withdrawal/:id 非 admin 访问他人 → 403', async () => {
      asRegular(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ id: REC_ID, userId: USER_B }]))
      const res = await server.inject({ method: 'GET', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('他人')
    })

    it('DELETE /withdrawal/:id 非 admin 删他人 → 403(不触发 delete)', async () => {
      asRegular(USER_A)
      mocks.dbSelect.mockReturnValue(chain([{ id: REC_ID, userId: USER_B, status: 'pending' }]))
      const res = await server.inject({ method: 'DELETE', url: `/withdrawal/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      expect(mocks.dbDelete).not.toHaveBeenCalled()
    })

    it('POST /withdrawal/batch-delete 非 admin 仅删本人 pending(SQL WHERE 含 userId)', async () => {
      asRegular(USER_A)
      mocks.dbDelete.mockReturnValue(chain([{ id: REC_ID }]))
      const res = await server.inject({
        method: 'POST',
        url: '/withdrawal/batch-delete',
        payload: { ids: [REC_ID] },
      })
      expect(res.statusCode).toBe(200)
      expect(mocks.dbDelete).toHaveBeenCalled()
      expect(res.json().deletedCount).toBe(1)
    })
  })

  // ===== Bug 6:need-task / upload IDOR =====
  describe('Bug 6:need-task / upload IDOR', () => {
    it('GET /need-task/:id 非 admin 访问他人 → 403', async () => {
      asRegular(USER_A)
      mocks.dbExecute.mockResolvedValue([{ id: REC_ID, user_id: USER_B }])
      const res = await server.inject({ method: 'GET', url: `/need-task/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      expect(res.json().message).toContain('他人')
    })

    it('DELETE /upload/:id 非 admin 删他人 → 403(不触发软删除 UPDATE)', async () => {
      asRegular(USER_A)
      mocks.dbExecute.mockResolvedValue([{ id: REC_ID, user_id: USER_B, status: 1 }])
      const res = await server.inject({ method: 'DELETE', url: `/upload/${REC_ID}` })
      expect(res.statusCode).toBe(403)
      // 仅 rawById 查询触发 1 次 db.execute,软删除 UPDATE 不应触发
      expect(mocks.dbExecute).toHaveBeenCalledTimes(1)
    })
  })

  // ===== Bug 7:GET /usedetail/list 强制 user_id 过滤 =====
  describe('Bug 7:usedetail/list 强制 user_id 过滤', () => {
    it('非 admin 不传 user_id → 强制按自己 user_id 过滤(200)', async () => {
      asRegular(USER_A)
      mocks.dbExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }])
      const res = await server.inject({ method: 'GET', url: '/usedetail/list' })
      expect(res.statusCode).toBe(200)
      // rawList 调 2 次 db.execute(SELECT * + SELECT count)
      expect(mocks.dbExecute).toHaveBeenCalledTimes(2)
    })

    it('admin 传 user_id → 按指定 user_id 过滤(特权放行)', async () => {
      asAdmin(USER_A)
      mocks.dbExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }])
      const res = await server.inject({
        method: 'GET',
        url: `/usedetail/list?user_id=${USER_B}`,
      })
      expect(res.statusCode).toBe(200)
    })

    it('非 admin 传他人 user_id → 仍强制按自己 user_id 过滤(被覆盖,200)', async () => {
      asRegular(USER_A)
      mocks.dbExecute.mockResolvedValueOnce([]).mockResolvedValueOnce([{ count: 0 }])
      const res = await server.inject({
        method: 'GET',
        url: `/usedetail/list?user_id=${USER_B}`,
      })
      expect(res.statusCode).toBe(200)
      // 非 admin 路径:不查 q.user_id,直接用 req.userId=USER_A 过滤
    })
  })

  // ===== Bug 8:POST /need-task 强制 user_id =====
  describe('Bug 8:POST /need-task 强制 user_id = req.userId', () => {
    it('非 admin 传他人 user_id → user_id 被强制覆盖为自己的', async () => {
      asRegular(USER_A)
      mocks.dbExecute.mockImplementation(async (sqlObj: unknown) => {
        // Drizzle sql 模板对象的 params 数组包含所有 ${value} 占位符的值
        const params = (sqlObj as { params?: unknown[] }).params ?? []
        if (params.length > 0) {
          // 强制覆盖后,USER_A 在参数中,USER_B 不在
          expect(params).toContain(USER_A)
          expect(params).not.toContain(USER_B)
        }
        return [{ id: REC_ID, user_id: USER_A, title: 'test' }]
      })
      const res = await server.inject({
        method: 'POST',
        url: '/need-task',
        payload: { user_id: USER_B, title: 'test task', type: 'task' },
      })
      expect(res.statusCode).toBe(201)
    })
  })
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
