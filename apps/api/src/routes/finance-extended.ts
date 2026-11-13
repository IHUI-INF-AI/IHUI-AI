// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql, type SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { requireStepUpForTwoFactorUser } from '../services/two-factor-step-up-store.js'
import { requireAdmin } from '../plugins/require-permission.js'
// F-452:此文件的 agent-withdrawal apply/approve/reject 原先绕开统一提现服务,自管
// withdrawalFlows——apply 不冻结余额、不生成 partnerTradeNo(回调 eq(partnerTradeNo) 永远
// 匹配不到,单据无法闭环),approve 仅 currentStatus+1 无前置状态断言(可把已完成单再推进),
// reject 的 where 只有 id(可把已完成(2)改回 3、且不退冻结 ⇒ 已打款单被驳回后可用额复原,
// 可重复申请 ⇒ 资金损失)。现全部改调 commission-queries 的单源服务,与主链路 /finance/
// withdrawal/* 同一份资金守恒逻辑(冻结/单号/守卫/退款),彻底消除旁路。
import {
  applyWithdrawal,
  approveWithdrawal,
  rejectWithdrawal,
} from '../db/commission-queries.js'
import {
  commissionFlows,
  withdrawalFlows,
  identityProportions,
  orders,
  userMargins,
  tokenFlows,
} from '@ihui/database'

export const financeExtendedRoutes: FastifyPluginAsync = async (server) => {
  const idParam = z.object({ id: z.string() })

  // ==========================================================================
  // 分销统计
  // ==========================================================================

  // 团队业绩统计（查询 commissionFlows 按 beneficiaryId 汇总 totalAmount/count）
  server.get('/finance/distribution/team-stats', async (request, reply) => {
    await authenticate(request)
    const { beneficiaryId } = z
      .object({ beneficiaryId: z.string().optional() })
      .parse(request.query)
    const targetId = beneficiaryId ?? request.userId!
    // P1 修复(F-05): 分销统计按 beneficiaryId 直读佣金/下级关系,指定他人必须过管理员闸
    // (与此文件 /agent-withdrawal/list 同一判据)。
    if (beneficiaryId && beneficiaryId !== request.userId) {
      await requireAdmin(request, reply)
      if (reply.sent) return
    }
    try {
      const rows = await db
        .select({
          beneficiaryId: commissionFlows.beneficiaryId,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
        .groupBy(commissionFlows.beneficiaryId)
      // 当前活跃的分销比例配置
      const proportionRows = await db
        .select()
        .from(identityProportions)
        .where(eq(identityProportions.status, 1))
        .limit(1)
      return reply.send(
        success(
          rows[0] ?? {
            beneficiaryId: targetId,
            totalAmount: 0,
            totalCount: 0,
            proportion: proportionRows[0] ?? null,
          },
        ),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询团队业绩统计失败'))
    }
  })

  // 下级统计（查询 commissionFlows 按 invitedUserId 汇总）
  server.get('/finance/distribution/subordinate-stats', async (request, reply) => {
    await authenticate(request)
    const { beneficiaryId, page, pageSize } = z
      .object({
        beneficiaryId: z.string().optional(),
        page: z.coerce.number().optional().default(1),
        // P1 修复(2026-08-06): 分页 pageSize 补上限,防恶意大分页拖垮数据库
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      })
      .parse(request.query)
    const targetId = beneficiaryId ?? request.userId!
    // P1 修复(F-05): 指定他人受益人必须过管理员闸(同上)。
    if (beneficiaryId && beneficiaryId !== request.userId) {
      await requireAdmin(request, reply)
      if (reply.sent) return
    }
    const offset = (page - 1) * pageSize
    try {
      const list = await db
        .select({
          invitedUserId: commissionFlows.invitedUserId,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
        .groupBy(commissionFlows.invitedUserId)
        .limit(pageSize)
        .offset(offset)
      const countRows = await db
        .select({ count: sql<number>`count(DISTINCT ${commissionFlows.invitedUserId})::int` })
        .from(commissionFlows)
        .where(and(eq(commissionFlows.beneficiaryId, targetId), eq(commissionFlows.status, 1)))
      return reply.send(
        success({
          list,
          total: countRows[0]?.count ?? 0,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询下级统计失败'))
    }
  })

  // 邀请汇总（查询 commissionFlows 按日期分组统计）
  server.get('/finance/distribution/invitation-summary', async (request, reply) => {
    await authenticate(request)
    const { beneficiaryId, startDate, endDate } = z
      .object({
        beneficiaryId: z.string().optional(),
        startDate: z.string().optional(),
        endDate: z.string().optional(),
      })
      .parse(request.query)
    const targetId = beneficiaryId ?? request.userId!
    // P1 修复(F-05): 指定他人受益人必须过管理员闸(同上)。
    if (beneficiaryId && beneficiaryId !== request.userId) {
      await requireAdmin(request, reply)
      if (reply.sent) return
    }
    const conditions: SQL[] = [
      eq(commissionFlows.beneficiaryId, targetId),
      eq(commissionFlows.status, 1),
    ]
    if (startDate) conditions.push(sql`${commissionFlows.createdAt} >= ${startDate}::timestamp`)
    if (endDate)
      conditions.push(sql`${commissionFlows.createdAt} <= ${`${endDate} 23:59:59`}::timestamp`)
    const where = and(...conditions)
    try {
      const rows = await db
        .select({
          dateStr: sql<string>`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
          totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          totalCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(where)
        .groupBy(
          sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
        )
        .orderBy(
          sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') DESC`,
        )
      return reply.send(success(rows))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询邀请汇总失败'))
    }
  })

  // 日/月收益汇总（前端 distribution/company 调用 /api/finance/commission/day-month-summary）
  server.get('/finance/commission/day-month-summary', async (request, reply) => {
    await authenticate(request)
    const userId = request.userId!
    try {
      const [dayRows, monthRows, totalRow] = await Promise.all([
        db
          .select({
            dateStr: sql<string>`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
            amount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(commissionFlows)
          .where(
            and(
              eq(commissionFlows.beneficiaryId, userId),
              eq(commissionFlows.status, 1),
              sql`${commissionFlows.createdAt} >= NOW() - INTERVAL '30 days'`,
            ),
          )
          .groupBy(
            sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD')`,
          )
          .orderBy(
            sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD') DESC`,
          ),
        db
          .select({
            monthStr: sql<string>`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM')`,
            amount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(commissionFlows)
          .where(
            and(
              eq(commissionFlows.beneficiaryId, userId),
              eq(commissionFlows.status, 1),
              sql`${commissionFlows.createdAt} >= NOW() - INTERVAL '12 months'`,
            ),
          )
          .groupBy(
            sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM')`,
          )
          .orderBy(
            sql`to_char(${commissionFlows.createdAt} AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM') DESC`,
          ),
        db
          .select({
            totalAmount: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
            totalCount: sql<number>`count(*)::int`,
          })
          .from(commissionFlows)
          .where(and(eq(commissionFlows.beneficiaryId, userId), eq(commissionFlows.status, 1))),
      ])
      return reply.send(
        success({
          daySummary: dayRows,
          monthSummary: monthRows,
          total: totalRow[0] ?? { totalAmount: 0, totalCount: 0 },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询日/月收益汇总失败'))
    }
  })

  // ==========================================================================
  // Agent 提现全套
  // ==========================================================================

  const applySchema = z.object({
    amount: z.number().int().positive(),
    type: z.string().min(1),
    bankInfo: z.string().optional(),
    openId: z.string().optional(),
  })

  // 提现申请（写入 withdrawalFlows 表, status=0; 检查余额是否足够）
  server.post('/finance/agent-withdrawal/apply', async (request, reply) => {
    const payload = await authenticate(request)
    const userId = payload.userId
    const parsed = applySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误: amount, type 必填'))
    const { amount, type, bankInfo, openId } = parsed.data
    // 2FA step-up：已开 2FA 的账号，资金流出动作必须有窗内二次验证；
    // 未开 2FA 的账号逐字不变（不打断存量）。判不出账号状态一律拒，不默认放行。
    const gate = await requireStepUpForTwoFactorUser({ userId, redis: request.server.redis })
    if (!gate.ok) {
      return reply
        .status(401)
        .send(
          error(
            401,
            gate.code === 'STEP_UP_REQUIRED'
              ? '提现需要二次验证：请先调用 POST /auth/2fa/step-up 提交当前验证码'
              : '暂时无法确认该账号的两步验证状态，请稍后重试',
            gate.code,
          ),
        )
    }
    try {
      // F-452:改调统一提现服务。原先只校验佣金口径后直接插流水——不冻结余额、不生成
      // partnerTradeNo(回调 eq(partnerTradeNo) 永远匹配不到,单据无法闭环)、申请期间余额
      // 未锁定可并发超额挂单。现走 applyWithdrawal:同事务内原子冻结(token-=actualAmount /
      // frozen+=actualAmount)、按 2% 收手续费、生成单号,与 payment-extended 回调严格配套。
      // requireCommissionEligibility=true ⇒ 保持「仅佣金可提现」口径(与 availableWithdrawal
      // 同源,服务内在同一事务、先锁 margin 行后校验,消除 TOCTOU)。
      let flow
      try {
        flow = await applyWithdrawal(
          {
            userId,
            amount,
            method: type,
            accountInfo: bankInfo ? { bankInfo } : openId ? { openId } : {},
            requireCommissionEligibility: true,
          },
          request.userId ?? null,
        )
      } catch (e) {
        const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
        if (statusCode >= 500) request.log.error({ err: e }, 'agent withdrawal apply failed')
        return reply
          .status(statusCode)
          .send(error(statusCode, statusCode < 500 ? (e as Error).message : '提现申请失败'))
      }
      return reply.send(success(flow))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '提现申请失败'))
    }
  })

  // 提现列表（分页，支持 userId/status 筛选）
  server.get('/finance/agent-withdrawal/list', async (request, reply) => {
    await authenticate(request)
    const { userId, status, page, pageSize } = z
      .object({
        userId: z.string().optional(),
        status: z.coerce.number().optional(),
        page: z.coerce.number().optional().default(1),
        // P1 修复(2026-08-06): 分页 pageSize 补上限,防恶意大分页拖垮数据库
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      })
      .parse(request.query)
    const targetUserId = userId ?? request.userId!
    // 2026-10-31 安全强化第 10 批 R10：**读他人提现单必须管理员**。
    //
    // 此前 `userId ?? request.userId` 直接当条件 —— 任何登录用户换一个 userId 就能读
    // 别人的提现单，而提现单里带 `accountInfo`（收款账户/银行信息）。这是可直接变现的
    // 个人信息泄露面（拿去冒充客服、做精准诈骗），不是"多看了个数字"。
    // 读自己恒允许（前端"我的提现"就靠它）；指定他人一律过 admin 闸，判据走单源
    // requireAdmin（与 approve/reject 同一条）。
    if (userId && userId !== request.userId) {
      await requireAdmin(request, reply)
      if (reply.sent) return
    }
    const conditions: SQL[] = [eq(withdrawalFlows.userId, targetUserId)]
    if (status !== undefined) conditions.push(eq(withdrawalFlows.status, status))
    const where = and(...conditions)
    const offset = (page - 1) * pageSize
    try {
      const list = await db
        .select()
        .from(withdrawalFlows)
        .where(where)
        .orderBy(desc(withdrawalFlows.createdAt))
        .limit(pageSize)
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawalFlows)
        .where(where)
      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询提现列表失败'))
    }
  })

  // 管理员审批通过（status 0→1,由 approveWithdrawal 单源守卫）
  server.post('/finance/agent-withdrawal/:id/approve', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    try {
      // F-452:改调 approveWithdrawal。原先仅 currentStatus+1、无前置状态断言,可把已完成(2)
      // 的单再推进、也可两步 0→1→2 各释放一次冻结(frozen 扣成负数)。统一服务只允许
      // pending(0)→processing(1) 的条件 UPDATE(status=0),并发重复审批由 0 行影响兜住;
      // 冻结的实际释放交给支付回调(payment-extended:成功只 frozen-=amount)。
      const operatorId = request.userId ?? null
      const updated = await approveWithdrawal(id, operatorId)
      if (!updated) return reply.status(409).send(error(409, '提现记录不存在或已被处理'))
      return reply.send(success(updated))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '审批通过失败'))
    }
  })

  // 管理员驳回（body: rejectReason; status 0→3 并退还冻结,由 rejectWithdrawal 单源守卫）
  server.post('/finance/agent-withdrawal/:id/reject', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const { rejectReason } = z.object({ rejectReason: z.string().optional() }).parse(request.body)
    try {
      // F-452:改调 rejectWithdrawal。原先 where 只有 id——可把已完成(2)改回 3,而可用额
      // 校验只减 status IN(0,1,2) ⇒ 已打款单被驳回后可用额复原、可再次申请(重复打款);
      // 且原实现不退还冻结。统一服务在事务内:① 条件 UPDATE 只允许 pending(0)→failed(3)
      // ② 同时 token+=amount / frozen-=amount 退还冻结,且带「冻结够才退」守卫。
      const operatorId = request.userId ?? null
      const rejected = await rejectWithdrawal(id, rejectReason ?? '', operatorId)
      if (!rejected) return reply.status(409).send(error(409, '提现记录不存在或已被处理'))
      return reply.send(success(rejected))
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 500
      if (statusCode >= 500) request.log.error(e)
      return reply
        .status(statusCode)
        .send(error(statusCode, statusCode < 500 ? (e as Error).message : '驳回失败'))
    }
  })

  // ==========================================================================
  // 管理员工具
  // ==========================================================================

  const adjustSchema = z.object({
    // user_margins.user_id 是 uuid 列：本路由下面两处 eq() 与一处 insert().values()
    // 都要吃这个值，非 uuid 串让 Postgres 抛 22P02 ⇒ 500。原只校验 min(1)，漏掉格式。
    userId: z.uuid({ error: 'userId 格式不正确' }),
    amount: z.number().int(),
    remark: z.string().optional(),
  })

  // 保证金调整（写入 tokenFlows opType=5 管理员调整）
  server.post('/admin/finance/margin/adjust', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const parsed = adjustSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误: userId, amount 必填'))
    const { userId, amount, remark } = parsed.data
    try {
      // 修前是"读余额 → JS 里加 → .set(绝对值)"整字回写:两处都会丢更新
      //  · 管理员 A 调 +100 与管理员 B 调 −50 并发时,后写的那笔把前一笔整笔抹掉;
      //  · 「调整后余额不能为负」也是拿陈旧读数判的 —— 并发扣减能让它落到负数而无人察觉。
      // 现在:补行用 onConflictDoNothing(AGENTS 指定幂等惯用法),增减走 DB 侧表达式,
      // 「不能为负」写进 WHERE 条件 ⇒ 判定与变更之间没有窗口;0 行即"这一笔调不下去"。
      await db
        .insert(userMargins)
        .values({ userId, tokenQuantity: 0, frozenQuantity: 0 })
        .onConflictDoNothing({ target: userMargins.userId })
      const [adjusted] = await db
        .update(userMargins)
        .set({
          tokenQuantity: sql`${userMargins.tokenQuantity} + ${amount}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(userMargins.userId, userId),
            // numeric 列在 Drizzle 侧是 string ⇒ 比较式两侧都由 DB 求值,不做 JS 侧换算
            sql`${userMargins.tokenQuantity} + ${amount} >= 0`,
          ),
        )
        .returning({ tokenQuantity: userMargins.tokenQuantity })
      if (!adjusted) {
        return reply.status(400).send(error(400, '调整后余额不能为负'))
      }
      const newBalance = adjusted.tokenQuantity
      // 写入 token 流水（opType=5 管理员调整）
      const [flow] = await db
        .insert(tokenFlows)
        .values({
          userId,
          opType: 5,
          quantity: amount,
          balanceAfter: newBalance,
          remark: remark ?? '管理员调整',
          operatorId: request.userId!,
        })
        .returning()
      return reply.send(success({ flow, balance: newBalance }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '保证金调整失败'))
    }
  })

  // 资金审核列表（查询 withdrawalFlows + commissionFlows 联合统计）
  server.get('/admin/finance/fund/audit/list', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { status, page, pageSize } = z
      .object({
        status: z.coerce.number().optional(),
        page: z.coerce.number().optional().default(1),
        // P1 修复(2026-08-06): 分页 pageSize 补上限,防恶意大分页拖垮数据库
        pageSize: z.coerce.number().int().min(1).max(100).optional().default(20),
      })
      .parse(request.query)
    const conditions: SQL[] = []
    if (status !== undefined) conditions.push(eq(withdrawalFlows.status, status))
    const where = conditions.length ? and(...conditions) : sql`TRUE`
    const offset = (page - 1) * pageSize
    try {
      const list = await db
        .select()
        .from(withdrawalFlows)
        .where(where)
        .orderBy(desc(withdrawalFlows.createdAt))
        .limit(pageSize)
        .offset(offset)
      const totalRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(withdrawalFlows)
        .where(where)
      // 提现联合统计
      const withdrawalStats = await db
        .select({
          totalWithdrawal: sql<number>`COALESCE(SUM(${withdrawalFlows.originalAmount}), 0)::int`,
          pendingCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 0)::int`,
          processingCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 1)::int`,
          completedCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} = 2)::int`,
          // F-457:驳回/失败终态按"非 0/1/2"统计,覆盖现行 3 与旧版商城后台写入的 4,
          // 四类计数(0/1/2/其它)之和恒等于总数,不再因状态码分裂而缺项。
          rejectedCount: sql<number>`count(*) FILTER (WHERE ${withdrawalFlows.status} NOT IN (0, 1, 2))::int`,
        })
        .from(withdrawalFlows)
      // 佣金联合统计
      const commissionStats = await db
        .select({
          totalCommission: sql<number>`COALESCE(SUM(${commissionFlows.amount}), 0)::int`,
          commissionCount: sql<number>`count(*)::int`,
        })
        .from(commissionFlows)
        .where(eq(commissionFlows.status, 1))
      // 订单总额统计
      const orderStats = await db
        .select({
          totalOrderAmount: sql<number>`COALESCE(SUM(${orders.amount}), 0)::int`,
          orderCount: sql<number>`count(*)::int`,
        })
        .from(orders)
        .where(eq(orders.status, 'paid'))
      return reply.send(
        success({
          list,
          total: totalRows[0]?.count ?? 0,
          page,
          pageSize,
          stats: {
            withdrawal: withdrawalStats[0] ?? {},
            commission: commissionStats[0] ?? {},
            orders: orderStats[0] ?? {},
          },
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询资金审核列表失败'))
    }
  })

  // 资金审核操作（body: action: approve/reject; 更新 withdrawalFlows status）
  server.post('/admin/finance/fund/audit/:id', async (request, reply) => {
    await requireAdmin(request, reply)
    if (reply.sent) return
    const { id } = idParam.parse(request.params)
    const { action, remark } = z
      .object({ action: z.string(), remark: z.string().optional() })
      .parse(request.body)
    if (action !== 'approve' && action !== 'reject') {
      return reply.status(400).send(error(400, 'action 必须为 approve 或 reject'))
    }
    try {
      const existing = await db
        .select()
        .from(withdrawalFlows)
        .where(eq(withdrawalFlows.id, id))
        .limit(1)
      if (!existing[0]) return reply.status(404).send(error(404, '提现记录不存在'))
      if (action === 'approve') {
        const flow = existing[0]
        // P1 修复(2026-08-06): 审批只改 status 不回退冻结资金,导致 frozen 永久沉淀。
        // F-454: 状态迁移收敛为 processing(1)→completed(2) 这一次,且条件 UPDATE 带
        // status=1 原子闸。原先 status=currentStatus+1 允许人工两步推进(0→1→2),
        // 每一步都 frozen-=amount ⇒ 同一单二次释放冻结、挪用该用户其它待审单的冻结额。
        // 现无返回行(并发/已为 2)一律不再释放,返回 409;释放动作与迁移同事务。
        if (flow.status !== 1) {
          return reply.status(409).send(error(409, '提现记录状态已变更,无需重复审批'))
        }
        const row = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(withdrawalFlows)
            .set({
              status: 2,
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 1)))
            .returning()
          if (!updated) return undefined // 已被处理:不得再次释放冻结
          // flow.userId 可空(用户删除时 SET NULL),null 时无法更新余额,跳过
          if (flow.userId) {
            const [margin] = await tx
              .update(userMargins)
              .set({
                frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(userMargins.userId, flow.userId),
                  sql`${userMargins.frozenQuantity} >= ${flow.amount}`,
                ),
              )
              .returning()
            if (!margin) {
              // frozen 已被释放(如回调已处理),资金守恒不允许负数,整体回滚
              throw Object.assign(new Error('冻结资金不足,无法审批'), { statusCode: 400 })
            }
          }
          return updated
        })
        if (!row) return reply.status(409).send(error(409, '提现记录不存在或已被处理'))
        return reply.send(success(row))
      } else {
        const flow = existing[0]
        // P1 修复(2026-08-06): 驳回只改 status 不退还冻结,导致用户余额永久卡死。
        // 事务内:① 条件 UPDATE pending→rejected(防并发重复驳回) ② 解冻回退(frozen -= amount, token += amount)。
        const row = await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(withdrawalFlows)
            .set({
              status: 3,
              rejectReason: remark,
              processedAt: new Date(),
              updatedAt: new Date(),
            })
            .where(and(eq(withdrawalFlows.id, id), eq(withdrawalFlows.status, 0)))
            .returning()
          if (!updated) return undefined // 已被处理或不存在
          if (flow.userId) {
            const [margin] = await tx
              .update(userMargins)
              .set({
                tokenQuantity: sql`${userMargins.tokenQuantity} + ${flow.amount}`,
                frozenQuantity: sql`${userMargins.frozenQuantity} - ${flow.amount}`,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(userMargins.userId, flow.userId),
                  sql`${userMargins.frozenQuantity} >= ${flow.amount}`,
                ),
              )
              .returning()
            if (!margin) {
              throw Object.assign(new Error('冻结资金不足,无法驳回'), { statusCode: 400 })
            }
          }
          return updated
        })
        if (!row) return reply.status(400).send(error(400, '该记录已完成审批或不存在'))
        return reply.send(success(row))
      }
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '资金审核操作失败'))
    }
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
