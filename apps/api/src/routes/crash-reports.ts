/**
 * 崩溃上报路由 — 2026-08-06 新增(打通崩溃率链路)。
 *
 * 端点:
 *  - POST /crash-reports   记录崩溃事件(匿名可上报,可选登录带 userId)
 *
 * 设计:
 *  - 匿名可上报:客户端崩溃时未必持有有效 token,不能因 401 丢失上报
 *  - 轻量防刷:同 errorMessage 哈希 5 分钟内只记一条(内存 Map,上限 1000 条防膨胀)
 *  - 上报静默失败:recordCrash 内部吞错,崩溃上报永不阻断业务
 */

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { recordCrash, type CrashReportInput } from '../services/crash-report-service.js'

const crashBodySchema = z.object({
  platform: z.enum([
    'web',
    'desktop',
    'ios',
    'android',
    'mobile',
    'wechat-miniapp',
    'extension',
    'cli',
  ]),
  version: z.string().max(64).optional(),
  errorMessage: z.string().min(1).max(4000),
  stack: z.string().max(20000).optional(),
  route: z.string().max(512).optional(),
})

/** 防刷:同栈 5 分钟去重。key = sha256(errorMessage),value = 首次到达时间戳。 */
const DEDUP_WINDOW_MS = 5 * 60 * 1000
const DEDUP_MAX_ENTRIES = 1000
const crashDedupMap = new Map<string, number>()

function isDuplicate(errorMessage: string): boolean {
  const hash = createHash('sha256').update(errorMessage).digest('hex')
  const now = Date.now()
  // 清理过期条目,控制 Map 大小
  if (crashDedupMap.size >= DEDUP_MAX_ENTRIES) {
    for (const [k, ts] of crashDedupMap) {
      if (now - ts > DEDUP_WINDOW_MS) crashDedupMap.delete(k)
    }
    if (crashDedupMap.size >= DEDUP_MAX_ENTRIES) {
      // 仍满:删最旧一条,保持有界
      let oldestKey: string | null = null
      let oldestTs = Infinity
      for (const [k, ts] of crashDedupMap) {
        if (ts < oldestTs) {
          oldestTs = ts
          oldestKey = k
        }
      }
      if (oldestKey) crashDedupMap.delete(oldestKey)
    }
  }
  const firstAt = crashDedupMap.get(hash)
  if (firstAt !== undefined) {
    if (now - firstAt <= DEDUP_WINDOW_MS) return true
    crashDedupMap.delete(hash)
  }
  crashDedupMap.set(hash, now)
  return false
}

export const crashReportsRoutes: FastifyPluginAsync = async (server) => {
  // POST /crash-reports - 崩溃事件上报(匿名可上报)
  server.post('/crash-reports', async (request, reply) => {
    const parsed = crashBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }

    const { platform, version, errorMessage, stack, route } = parsed.data

    // 同栈 5 分钟去重(防客户端循环崩溃刷库)
    if (isDuplicate(errorMessage)) {
      return reply.send(success({ id: '', deduplicated: true }))
    }

    let userId: string | null = null
    try {
      await authenticate(request)
      userId = request.userId ?? null
    } catch {
      // 匿名崩溃上报:userId 保持 null
    }

    const input: CrashReportInput = {
      userId,
      platform,
      version: version ?? null,
      errorMessage,
      stack: stack ?? null,
      route: route ?? null,
    }
    const { id } = await recordCrash(input)
    return reply.send(success({ id, deduplicated: false }))
  })
}

export default crashReportsRoutes
