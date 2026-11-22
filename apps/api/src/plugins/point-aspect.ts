// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance, FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import fp from 'fastify-plugin'
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { eduPointChannels, eduPoints } from '@ihui/database'
import { increasePoints, type PointOperationInput } from '../db/point-queries.js'

interface PointRule {
  channelCode: string
  pointCode: string
  amount: number
  remark: string
  /** 仅该状态码视为「首次成功」。缺省按 200/201 兼容旧规则。 */
  requireStatus?: number
}

const POINT_RULES: { match: (method: string, url: string) => PointRule | null } = {
  match(method: string, url: string): PointRule | null {
    const m = method.toUpperCase()
    const path = url.split('?')[0] ?? ''

    if (m === 'POST' && /^\/api\/follows\/[a-f0-9-]{36}$/i.test(path)) {
      // F-205:重复关注应返回 200(幂等 no-op),只有首次建立关系(201)才发积分,
      // 否则同一对用户反复 POST 可无限刷 +5。
      return {
        channelCode: 'social',
        pointCode: 'follow',
        amount: 5,
        remark: '关注奖励',
        requireStatus: 201,
      }
    }
    if (m === 'POST' && path === '/api/checkin') {
      return { channelCode: 'sign', pointCode: 'signin', amount: 10, remark: '签到奖励' }
    }
    if (m === 'POST' && path === '/api/exam/submit-answers') {
      return { channelCode: 'exam', pointCode: 'exam_complete', amount: 50, remark: '完成考试奖励' }
    }
    return null
  },
}

async function resolveRule(rule: PointRule): Promise<{
  channelId: string
  pointId: string
} | null> {
  const [channel, point] = await Promise.all([
    db
      .select({ id: eduPointChannels.id })
      .from(eduPointChannels)
      .where(eq(eduPointChannels.code, rule.channelCode))
      .limit(1),
    db
      .select({ id: eduPoints.id })
      .from(eduPoints)
      .where(eq(eduPoints.code, rule.pointCode))
      .limit(1),
  ])
  if (!channel[0] || !point[0]) return null
  return { channelId: channel[0].id, pointId: point[0].id }
}

/**
 * 行为触发积分奖励(等价 Java PointAspect)。
 *
 * onResponse 钩子:拦截 POST /api/follows/:userId(+5)、/api/checkin(+10)、
 * /api/exam/submit-answers(+50),响应成功(200/201)时调用 increasePoints。
 * 积分规则通过 channel.code + point.code 查表解析,失败不阻塞主请求。
 *
 * F-37:失败不再静默吞掉。本插件按设计**不得抛错/阻塞主请求**(onResponse 已在业务
 * 响应之后),因此失败语义定为:短退避有界重试 → 仍失败写结构化 error 日志(含
 * userId/pointCode/amount/reason/attempts)→ 进进程内待补偿队列,下次任意规则触发时
 * 重放。仓库内无积分失败队列表,不为此新建表(只补偿 + 对账日志)。
 */

/** 单次触发最多尝试次数(首次 + 1 次重试)。 */
const RETRY_ATTEMPTS = 2
/** 重试退避(短,且只在 setImmediate 的异步分支里等待,不影响主请求)。 */
const RETRY_BACKOFF_MS = 50
/** 进程内待补偿队列上界,防止 DB 长期不可用时无限增长。 */
const MAX_PENDING_RETRIES = 50

interface PendingPointOp {
  input: PointOperationInput
  /** 发起该笔积分的业务操作名(point.code),用于对账。 */
  operation: string
}

/** 失败待补偿操作(进程内、有界;不是持久队列,重启即失,靠 error 日志对账)。 */
const pendingPointOps: PendingPointOp[] = []

/** 测试面:观察/清空进程内待补偿队列(不参与业务判定)。 */
export const __test__ = {
  pendingPointOps,
  resetPending(): void {
    pendingPointOps.length = 0
  },
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorReason(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 重放上次失败的操作;单次尝试 + 保留队列(不再叠加退避,避免拖慢后续触发)。 */
async function drainPendingPoints(server: FastifyInstance): Promise<void> {
  if (pendingPointOps.length === 0) return
  const batch = pendingPointOps.splice(0, pendingPointOps.length)
  for (const item of batch) {
    try {
      await increasePoints(item.input)
      server.log.info(
        {
          userId: item.input.memberId,
          operation: item.operation,
          points: item.input.amount,
        },
        'point-aspect: pending points compensated',
      )
    } catch (e) {
      server.log.error(
        {
          userId: item.input.memberId,
          operation: item.operation,
          points: item.input.amount,
          reason: errorReason(e),
          err: e,
        },
        'point-aspect: pending points compensation failed, keep queued',
      )
      if (pendingPointOps.length >= MAX_PENDING_RETRIES) pendingPointOps.shift()
      pendingPointOps.push(item)
    }
  }
}

/** 有界重试发放;返回 true 表示成功。 */
async function grantWithRetry(
  server: FastifyInstance,
  rule: PointRule,
  input: PointOperationInput,
): Promise<boolean> {
  let lastError: unknown
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      await increasePoints(input)
      return true
    } catch (e) {
      lastError = e
      if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BACKOFF_MS)
    }
  }
  server.log.error(
    {
      userId: input.memberId,
      operation: rule.pointCode,
      channelCode: rule.channelCode,
      pointCode: rule.pointCode,
      points: input.amount,
      attempts: RETRY_ATTEMPTS,
      reason: errorReason(lastError),
      err: lastError,
    },
    'point-aspect: increasePoints failed after retries, queued for compensation',
  )
  return false
}

const pointAspectPlugin: FastifyPluginAsync = async (server: FastifyInstance) => {
  server.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const method = request.method.toUpperCase()
    const url = request.url.split('?')[0] ?? ''
    const rule = POINT_RULES.match(method, url)
    if (!rule) return

    if (rule.requireStatus !== undefined) {
      if (reply.statusCode !== rule.requireStatus) return
    } else if (reply.statusCode !== 200 && reply.statusCode !== 201) {
      return
    }

    const userId = request.userId ?? request.jwtPayload?.userId
    if (!userId) return

    setImmediate(() => {
      ;(async () => {
        // F-37:先补偿此前失败的积分,再发放本次
        await drainPendingPoints(server)

        const resolved = await resolveRule(rule)
        if (!resolved) {
          server.log.warn(
            { channelCode: rule.channelCode, pointCode: rule.pointCode },
            'point-aspect: rule channel/point not found, skip',
          )
          return
        }
        const input: PointOperationInput = {
          memberId: userId,
          channelId: resolved.channelId,
          pointId: resolved.pointId,
          amount: rule.amount,
          remark: rule.remark,
        }
        const ok = await grantWithRetry(server, rule, input)
        if (!ok) {
          if (pendingPointOps.length >= MAX_PENDING_RETRIES) pendingPointOps.shift()
          pendingPointOps.push({ input, operation: rule.pointCode })
        }
      })().catch((e) => {
        // 兜底也必须留痕:绝不静默吞错,但也不冒泡到主请求
        server.log.error({ err: e }, 'point-aspect: unexpected failure in point aspect')
      })
    })
  })
}

export default fp(pointAspectPlugin, {
  name: 'point-aspect',
  fastify: '5.x',
})
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
