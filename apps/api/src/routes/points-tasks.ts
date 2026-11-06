// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, gte, lt, inArray } from 'drizzle-orm'
import {
  userFollows,
  examRecords,
  userAuthInfo,
  users,
  pointTransactions,
  userPoints,
} from '@ihui/database'
import { db } from '../db/index.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { todayString, shiftDate } from '../utils/checkin-helpers.js'
import { bizDayStartUtcForKey } from '../utils/biz-day.js'
import {
  findTodaySignIn,
  findRecentSignInRecords,
  ensureUserPoints,
} from '../db/gamification-queries.js'
import { hasClaimedFirstShare } from '../db/point-queries.js'
import { earnPoints } from '../services/points-service.js'

/**
 * 积分任务中心(2026-08-26 立)
 *
 * 背景:mobile-rn TaskCenterScreen 此前调 GET /tasks(异步任务列表)与
 * POST /tasks/:id/claim(不存在),数据形状不匹配、领取 404——任务中心实际不可用。
 * 本路由提供真实的任务中心接口:
 *   GET  /api/points/tasks?type=daily|weekly|newbie — 任务列表(含实时进度与领取状态)
 *   POST /api/points/tasks/:code/claim              — 领取任务奖励(幂等,已领 409,未完成 400)
 *
 * 任务进度实时计算(签到/分享/关注/考试/实名/资料),奖励走 user_points 体系
 * (earnPoints),领取查重用 point_transactions.source='task' + description 周期键。
 */

const TASK_TYPE = ['daily', 'weekly', 'newbie'] as const
type TaskType = (typeof TASK_TYPE)[number]

interface TaskDef {
  code: string
  title: string
  description: string
  type: TaskType
  reward: number
  target: number
  actionUrl: string | null
}

/** 任务目录(常量;新增任务只需追加一条,进度与领取状态由后端统一计算) */
const TASK_DEFS: TaskDef[] = [
  // ---- 每日任务(按天重置,当天可领) ----
  {
    code: 'daily_signin',
    title: '每日签到',
    description: '完成每日签到,连续签到奖励更多',
    type: 'daily',
    reward: 10,
    target: 1,
    actionUrl: null,
  },
  {
    code: 'daily_share',
    title: '分享内容',
    description: '分享任意内容给好友,今日完成 1 次',
    type: 'daily',
    reward: 5,
    target: 1,
    actionUrl: null,
  },
  {
    code: 'daily_follow',
    title: '关注好友',
    description: '今日关注 1 位好友',
    type: 'daily',
    reward: 5,
    target: 1,
    actionUrl: null,
  },
  {
    code: 'daily_exam',
    title: '完成考试',
    description: '今日完成 1 场考试',
    type: 'daily',
    reward: 50,
    target: 1,
    actionUrl: null,
  },
  // ---- 每周任务(本周可领) ----
  {
    code: 'weekly_signin',
    title: '本周签到 3 天',
    description: '本周累计签到 3 天',
    type: 'weekly',
    reward: 30,
    target: 3,
    actionUrl: null,
  },
  {
    code: 'weekly_exam',
    title: '本周完成 3 场考试',
    description: '本周累计完成 3 场考试',
    type: 'weekly',
    reward: 100,
    target: 3,
    actionUrl: null,
  },
  // ---- 新手任务(终身一次) ----
  {
    code: 'newbie_profile',
    title: '完善个人资料',
    description: '设置昵称或头像,让好友认识你',
    type: 'newbie',
    reward: 20,
    target: 1,
    actionUrl: null,
  },
  {
    code: 'newbie_realname',
    title: '完成实名认证',
    description: '完成实名认证,解锁全部功能',
    type: 'newbie',
    reward: 30,
    target: 1,
    actionUrl: null,
  },
  {
    code: 'newbie_share',
    title: '首次分享',
    description: '首次分享内容给好友',
    type: 'newbie',
    reward: 5,
    target: 1,
    actionUrl: null,
  },
]

const taskByCode = new Map(TASK_DEFS.map((t) => [t.code, t]))

// ---------------------------------------------------------------------------
// 周期键:daily 按天、weekly 按本周一、newbie 终身
// ---------------------------------------------------------------------------
function periodKey(def: TaskDef, today: string): string {
  if (def.type === 'daily') return `task:${def.code}:${today}`
  if (def.type === 'weekly') return `task:${def.code}:${weekStartOf(today)}`
  return `task:${def.code}`
}

/** 本周一(UTC,周一为一周起点) */
function weekStartOf(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  const day = d.getUTCDay() // 0=周日
  const offset = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

/** 今天 0 点 / 明天 0 点(Date,用于 timestamp 区间比较) */
export function dayBounds(today: string): { from: Date; to: Date } {
  return {
    from: bizDayStartUtcForKey(today),
    to: bizDayStartUtcForKey(shiftDate(today, 1)),
  }
}

// ---------------------------------------------------------------------------
// 实时进度计算
// ---------------------------------------------------------------------------
interface TaskProgressCtx {
  todaySignIn: boolean
  weekSignInDays: number
  shareClaimed: boolean
  todayFollow: number
  todayExam: number
  weekExam: number
  authApproved: boolean
  profileDone: boolean
}

async function computeProgressCtx(userId: string, today: string): Promise<TaskProgressCtx> {
  const { from, to } = dayBounds(today)
  const weekStart = weekStartOf(today)
  const tomorrow = shiftDate(today, 1)

  const [
    todaySignInRec,
    weekSignIns,
    shareClaimed,
    followCnt,
    examCnt,
    weekExamCnt,
    authRec,
    userRec,
  ] = await Promise.all([
    findTodaySignIn(userId, today),
    findRecentSignInRecords(userId, weekStart, tomorrow),
    hasClaimedFirstShare(userId),
    db.$count(
      userFollows,
      and(
        eq(userFollows.followerId, userId),
        gte(userFollows.createdAt, from),
        lt(userFollows.createdAt, to),
      ),
    ),
    db.$count(
      examRecords,
      and(
        eq(examRecords.userId, userId),
        gte(examRecords.submittedAt, from),
        lt(examRecords.submittedAt, to),
      ),
    ),
    db.$count(
      examRecords,
      and(
        eq(examRecords.userId, userId),
        gte(examRecords.submittedAt, new Date(weekStart + 'T00:00:00Z')),
        lt(examRecords.submittedAt, to),
      ),
    ),
    db
      .select({ authStatus: userAuthInfo.authStatus })
      .from(userAuthInfo)
      .where(eq(userAuthInfo.userUuid, userId))
      .limit(1),
    db
      .select({ nickname: users.nickname, avatar: users.avatar })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  ])

  return {
    todaySignIn: !!todaySignInRec,
    weekSignInDays: weekSignIns.length,
    shareClaimed,
    todayFollow: followCnt,
    todayExam: examCnt,
    weekExam: weekExamCnt,
    authApproved: authRec[0]?.authStatus === 'approved',
    profileDone: !!userRec[0] && (!!userRec[0].nickname || !!userRec[0].avatar),
  }
}

function progressOf(def: TaskDef, ctx: TaskProgressCtx): number {
  switch (def.code) {
    case 'daily_signin':
      return ctx.todaySignIn ? 1 : 0
    case 'daily_share':
      return ctx.shareClaimed ? 1 : 0
    case 'daily_follow':
      return Math.min(def.target, ctx.todayFollow)
    case 'daily_exam':
      return Math.min(def.target, ctx.todayExam)
    case 'weekly_signin':
      return Math.min(def.target, ctx.weekSignInDays)
    case 'weekly_exam':
      return Math.min(def.target, ctx.weekExam)
    case 'newbie_profile':
      return ctx.profileDone ? 1 : 0
    case 'newbie_realname':
      return ctx.authApproved ? 1 : 0
    case 'newbie_share':
      return ctx.shareClaimed ? 1 : 0
    default:
      return 0
  }
}

// ---------------------------------------------------------------------------
// 领取查重:source='task' 的流水里按 description 匹配周期键
// ---------------------------------------------------------------------------
/** 精确按周期键查重:不再拉取固定 200 条窗口(流水超窗即可重复领取的旧根因)。 */
async function loadClaimedKeys(userId: string, keys: string[]): Promise<Set<string>> {
  if (keys.length === 0) return new Set<string>()
  const rows = await db
    .select({ description: pointTransactions.description })
    .from(pointTransactions)
    .where(
      and(
        eq(pointTransactions.userId, userId),
        eq(pointTransactions.source, 'task'),
        inArray(pointTransactions.description, keys),
      ),
    )
  return new Set(rows.map((r) => r.description).filter((d): d is string => !!d))
}

// ---------------------------------------------------------------------------
// 路由
// ---------------------------------------------------------------------------
const listQuerySchema = z.object({
  type: z.enum(TASK_TYPE).optional(),
})

const claimParamsSchema = z.object({
  code: z.string().min(1).max(64),
})

export const pointsTasksRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const statusCode = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(statusCode).send(error(statusCode, (e as Error).message || '请先登录'))
    }
  })

  // GET /api/points/tasks — 任务列表(含进度与领取状态)
  server.get('/points/tasks', async (request, reply) => {
    const userId = request.userId!
    const parsed = listQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const today = todayString()
    const keys = TASK_DEFS.map((def) => periodKey(def, today))
    const [ctx, claimedKeys] = await Promise.all([
      computeProgressCtx(userId, today),
      loadClaimedKeys(userId, keys),
    ])

    const list = TASK_DEFS.filter((d) => !parsed.data.type || d.type === parsed.data.type).map(
      (def) => {
        const progress = progressOf(def, ctx)
        const completed = progress >= def.target
        const claimed = claimedKeys.has(periodKey(def, today))
        return {
          id: def.code,
          title: def.title,
          description: def.description,
          type: def.type,
          reward: def.reward,
          progress,
          target: def.target,
          completed,
          claimed,
          actionUrl: def.actionUrl,
        }
      },
    )
    return reply.send(success({ list }))
  })

  // POST /api/points/tasks/:code/claim — 领取任务奖励(幂等)
  server.post<{ Params: z.infer<typeof claimParamsSchema> }>(
    '/points/tasks/:code/claim',
    async (request, reply) => {
      const userId = request.userId!
      const parsed = claimParamsSchema.safeParse(request.params)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const def = taskByCode.get(parsed.data.code)
      if (!def) {
        return reply.status(404).send(error(404, '任务不存在'))
      }
      const today = todayString()
      const key = periodKey(def, today)
      const ctx = await computeProgressCtx(userId, today)
      if (progressOf(def, ctx) < def.target) {
        return reply.status(400).send(error(400, '任务尚未完成'))
      }
      // 单事务 + 用户积分行锁:把「精确查重 → 发放」串行化,并发双击不会双倍发放。
      // 查重按 description 精确匹配,不再受 200 条窗口限制;DB 层唯一约束待迁移侧补。
      // ensureUserPoints 在事务外先确保积分行存在,FOR UPDATE 才有可锁之行。
      await ensureUserPoints(userId)
      const result = await db.transaction(async (tx) => {
        await tx
          .select({ userId: userPoints.userId })
          .from(userPoints)
          .where(eq(userPoints.userId, userId))
          .for('update')
        const claimed = await tx
          .select({ id: pointTransactions.id })
          .from(pointTransactions)
          .where(
            and(
              eq(pointTransactions.userId, userId),
              eq(pointTransactions.source, 'task'),
              eq(pointTransactions.description, key),
            ),
          )
          .limit(1)
        if (claimed.length > 0) return null
        return earnPoints(userId, def.reward, 'task', key, undefined, tx)
      })
      if (!result) {
        return reply.status(409).send(error(409, '该任务本期已领取'))
      }
      return reply.send(success({ points: result.points, reward: def.reward }))
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
