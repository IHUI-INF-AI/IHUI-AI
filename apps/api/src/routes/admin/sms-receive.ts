// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/sms-receive 路由(管理员短信接码,对接 d1jiema 平台,2026-10-08 立)。
 *
 * 全部走 POST + JSON body:中文参数(keyWord/province)在 URL 上必须编码,
 * JSON body 规避该问题;服务层内部由 URLSearchParams 统一编码。
 *
 * 端点:
 *   POST /balance  查余额
 *   POST /phone    取号(keyWord 建议/phone 指定/province/cardType 可选)
 *   POST /message  取码(轮询端点;pending 表示尚未收到,不算错误)
 *   POST /release  释放号码
 *   POST /block    拉黑号码
 *   POST /send     发送短信(不能向个人手机号发送,发垃圾信息平台封号)
 *   GET  /used     查询历史(平台限频 1 次/分钟 → 本路由内存限频 60s)
 *   GET  /related-msgs  平台网页版「号码相关短信」全局时间线(免费;
 *                  自动筛新号热度过滤数据源,近期被高频流转的超热门号跳过)
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../../plugins/require-permission.js'
import { success, error } from '../../utils/response.js'
import {
  D1jiemaError,
  getBalance,
  getPhone,
  getMsg,
  releasePhone,
  blockPhone,
  sendSms,
  queryUsedDetailed,
  getRelatedMsgs,
  extractPlatform,
  extractVerifyCode,
  classifySmsUsage,
} from '../../services/d1jiema-service.js'
import {
  recordSmsReceived,
  getPhoneHistory,
  getPhoneHistoryCount,
  getPhoneHistoryPlatformStats,
  snapshotRelatedMsgs,
  getRelatedUnionCount,
  snapshotUsedRecords,
  getUsedUnionCount,
  getUsedUnionItems,
} from '../../db/sms-receive-queries.js'

// 平台取号返回的是脱敏号(如 193****6470),回传类端点(message/release/block/phone-history/send)
// 必须放行 *;发短信的目标号码 toPhone 是真实全号,保持纯数字
const phoneSchema = z
  .string()
  .regex(/^[\d*]{5,20}$/, '手机号格式不正确(5-20 位数字,支持平台脱敏号)')
const toPhoneSchema = z.string().regex(/^\d{5,20}$/, '目标手机号格式不正确(5-20 位纯数字)')

const getPhoneBodySchema = z.object({
  keyWord: z
    .transform((v) => (typeof v === 'string' ? v.trim() : v))
    .pipe(z.string().min(1, '关键词不能为空').max(64, '关键词最多 64 字符').optional()),
  phone: phoneSchema.optional(),
  province: z.string().trim().max(32).optional(),
  cardType: z.enum(['实卡', '虚卡', '全部']).optional(),
})

const messageBodySchema = z.object({
  phone: phoneSchema,
  keyWord: z.string().trim().min(1, '关键词不能为空').max(64, '关键词最多 64 字符'),
})

const phoneOnlyBodySchema = z.object({ phone: phoneSchema })

const phoneOnlyQuerySchema = z.object({ phone: phoneSchema })
const usedUnionQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
})

const sendBodySchema = z.object({
  phone: phoneSchema,
  toPhone: toPhoneSchema,
  content: z.string().trim().min(1, '内容不能为空').max(500, '内容最多 500 字符'),
})

// queryUsed 平台限频 1 次/分钟 → 进程内存 60s 冷却(单副本足够,防管理页连点打爆平台限频)
const QUERY_USED_COOLDOWN_MS = 60_000
let lastQueryUsedAt = 0

/** D1jiemaError → 502 平台错误;其余 → 500 */
function toErrorResponse(e: unknown) {
  if (e instanceof D1jiemaError) {
    return { status: 502, body: error(502, e.message) }
  }
  return { status: 500, body: error(500, '服务器内部错误') }
}

const smsReceiveRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)
  // 跳过全局响应脱敏(与 member-users 同款模式,admin 可信上下文):
  // phone 是本功能核心工作数据,取号/轮询/释放/拉黑全靠它原样回传平台。
  // 全局 response-sanitizer 会把 phone 键打成 191****xxxx(保前3后4),
  // 前端拿脱敏号轮询 getMsg 会被平台拒收(ERROR:手机号格式错误 → 502),
  // 自动换号链路因此瘫痪 —— 2026-10-08 排查实证,勿删。
  server.addHook('onRequest', async (request) => {
    request.skipResponseSanitization = true
  })

  // POST /balance - 查询接码平台余额
  server.post('/sms-receive/balance', async (_request, reply) => {
    try {
      const balance = await getBalance()
      return reply.send(success({ balance }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // POST /phone - 取号(随机或指定号码)
  server.post('/sms-receive/phone', async (request, reply) => {
    const parsed = getPhoneBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const phone = await getPhone(parsed.data)
      return reply.send(success({ phone }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // POST /message - 取码(前端 5s 轮询;pending=尚未收到)。received 时落台账并附平台/用途判定
  server.post('/sms-receive/message', async (request, reply) => {
    const parsed = messageBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { phone, keyWord } = parsed.data
    try {
      const result = await getMsg(phone, keyWord)
      if (result.status === 'received') {
        const platform = extractPlatform(result.raw)
        const usageKind = classifySmsUsage(result.raw)
        // await 但内部吞错:台账写入失败不影响取码响应
        await recordSmsReceived({
          phone,
          keyword: keyWord,
          platform,
          usageKind,
          smsCode: result.code ?? extractVerifyCode(result.raw),
          smsRaw: result.raw,
        })
        return reply.send(success({ ...result, platform, usageKind }))
      }
      return reply.send(success(result))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // GET /phone-history - 某号码的本地接码台账(回答"该号接过哪些平台的码/是否已注册过")
  server.get('/sms-receive/phone-history', async (request, reply) => {
    const parsed = phoneOnlyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      // items 截断最近 20 条;total 是全量条数(本机累计使用次数,不受 24h/100 条限制);
      // platformStats 是「平台 × 用途」全量计数(2026-10-09 机主要求:分平台显示登录/注册具体数)
      const [items, total, platformStats] = await Promise.all([
        getPhoneHistory(parsed.data.phone, 20),
        getPhoneHistoryCount(parsed.data.phone),
        getPhoneHistoryPlatformStats(parsed.data.phone),
      ])
      return reply.send(success({ items, total, platformStats }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // POST /release - 释放号码(平台备注:失败跳过即可,勿重复释放)
  server.post('/sms-receive/release', async (request, reply) => {
    const parsed = phoneOnlyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await releasePhone(parsed.data.phone)
      return reply.send(success({ ok: true, result }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // POST /block - 拉黑号码
  server.post('/sms-receive/block', async (request, reply) => {
    const parsed = phoneOnlyBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await blockPhone(parsed.data.phone)
      return reply.send(success({ ok: true, result }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // POST /send - 发送短信(仅 1069 等非个人号码;垃圾信息平台封号,风险自担)
  server.post('/sms-receive/send', async (request, reply) => {
    const parsed = sendBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const result = await sendSms(parsed.data.phone, parsed.data.toPhone, parsed.data.content)
      return reply.send(success({ ok: true, result }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // GET /used - 历史记录(平台限频 1 次/分钟;本地 60s 冷却,超频返回 429)
  // 2026-10-09 快照累积:每次查询把流水逐条抄进本地 sms_used_snapshots(幂等去重),
  // totalUnion=跨快照并集总数,随时间单调增长 —— 攻破平台 24h+100 条上限。
  // 快照/并集 fail-open:写库失败只降级(totalUnion=null),绝不阻断平台查询。
  server.get('/sms-receive/used', async (request, reply) => {
    const now = Date.now()
    const elapsed = now - lastQueryUsedAt
    if (elapsed < QUERY_USED_COOLDOWN_MS) {
      const retryAfter = Math.ceil((QUERY_USED_COOLDOWN_MS - elapsed) / 1000)
      return reply
        .status(429)
        .send(error(429, `查询过于频繁(平台限频 1 次/分钟),请 ${retryAfter}s 后重试`))
    }
    lastQueryUsedAt = now
    try {
      const items = await queryUsedDetailed()
      let totalUnion: number | null = null
      try {
        await snapshotUsedRecords(items)
        totalUnion = await getUsedUnionCount()
      } catch (e) {
        request.log.warn({ err: e }, 'used 快照累积失败(降级旧口径)')
      }
      return reply.send(success({ items, totalUnion }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // GET /used-union - 快照累积流水(纯本地库读,无平台调用无限频):
  // items=按入库时间倒序最近 limit 条,total=全量条数。攻破 24h+100 条的读出口。
  server.get('/sms-receive/used-union', async (request, reply) => {
    const parsed = usedUnionQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const [items, total] = await Promise.all([
        getUsedUnionItems(parsed.data.limit),
        getUsedUnionCount(),
      ])
      return reply.send(success({ items, total }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })

  // GET /related-msgs - 平台网页版「号码相关短信」全局时间线(免费、全局号码维度):
  // 该号码在平台被所有买家收码的记录(时间+标记,内容打码)。自动筛新号取号后先查,
  // 近期被高频流转的超热门号已被他人注册过目标平台的概率更高 → 前端拉黑换号(免费)。
  // 2026-10-09 快照累积:平台只回最近 12 条滚动窗口(服务端硬截断),每次查询把窗口
  // 逐条抄进本地 sms_related_snapshots(幂等去重),totalUnion=跨快照并集总数,
  // 随时间单调增长 —— 唯一能超越平台 12 条上限的全局热度口径。快照/并集 fail-open:
  // 写库失败只降级为旧口径(union=null),绝不阻断平台查询主流程。
  server.get('/sms-receive/related-msgs', async (request, reply) => {
    const parsed = phoneOnlyQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    try {
      const items = await getRelatedMsgs(parsed.data.phone)
      let totalUnion: number | null = null
      try {
        await snapshotRelatedMsgs(parsed.data.phone, items)
        totalUnion = await getRelatedUnionCount(parsed.data.phone)
      } catch (e) {
        request.log.warn({ err: e }, 'related-msgs 快照累积失败(降级旧口径)')
      }
      return reply.send(success({ items, totalUnion }))
    } catch (e) {
      const r = toErrorResponse(e)
      return reply.status(r.status).send(r.body)
    }
  })
}

export default smsReceiveRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
