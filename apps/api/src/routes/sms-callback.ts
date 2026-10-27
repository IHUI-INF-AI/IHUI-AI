// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 短信厂商回调(2026-10-26 立):腾讯云「短信下发状态通知」+「短信上行回调」。
 *
 * 端点(腾讯控制台分别填,或统一填 /tencent):
 *   POST /api/sms/callback/tencent          自动判别状态回执 / 上行回复
 *   POST /api/sms/callback/tencent/status   仅状态回执
 *   POST /api/sms/callback/tencent/reply    仅上行回复
 *
 * 安全边界(腾讯回调本身不带签名):
 *   1. 配了 SMS_CALLBACK_TOKEN ⇒ 必须带 `?key=` 或 `x-sms-callback-token` 头;
 *   2. 配了 SMS_CALLBACK_IP_ALLOWLIST ⇒ 来源 IP 必须在白名单;
 *   3. 两道都没配 ⇒ **直接拒绝(503)**。回调本身无签名,只凭"号码近期在本机发过"
 *      放行等于允许任何人伪造上行把任意用户拉黑、或伪造送达回执掩盖真实失败;
 *      运维必须至少配置其中一道闸,否则端点保持关闭。
 *
 * 响应:一律 200 + {"result":0}。处理失败才回 500,让腾讯按自身策略重试;
 * 不要回 4xx —— 腾讯把 4xx 当"永久失败"丢弃,回执就永久丢了。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { env } from 'node:process'
import { logger } from '../utils/logger.js'
import { tryConsumeWindows } from '../utils/window-counter.js'
import {
  addSmsUnsubscribe,
  isUnsubscribeReply,
  recordSmsInbound,
  updateSmsDeliveryReport,
} from '../services/sms-compliance.js'
import {
  classifyTencentCallback,
  coerceCallbackBody,
  isSmsCallbackAuthorized,
  judgeTencentReport,
  parseTencentCallback,
  type TencentCallbackKind,
} from '../services/sms-callback-parse.js'

function maskPhone(phone: string): string {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '***'
}

function readToken(request: FastifyRequest): string | undefined {
  const q = request.query as Record<string, unknown> | undefined
  const fromQuery = typeof q?.key === 'string' ? q.key : undefined
  if (fromQuery) return fromQuery
  const header = request.headers['x-sms-callback-token']
  return Array.isArray(header) ? header[0] : header
}

async function handleCallback(
  request: FastifyRequest,
  reply: FastifyReply,
  hint: TencentCallbackKind = 'unknown',
): Promise<void> {
  const expectedToken = env.SMS_CALLBACK_TOKEN
  const allowlist = env.SMS_CALLBACK_IP_ALLOWLIST
  const hasGate = Boolean(expectedToken || allowlist)

  // 无鉴权闸 = 端点关闭。腾讯会把 503 当可重试错误,配好闸后回执会补上来,
  // 而放行则意味着任何人都能替全站用户退订、或把失败回执改成送达。
  if (!hasGate) {
    logger.error('短信回调未配置 SMS_CALLBACK_TOKEN / SMS_CALLBACK_IP_ALLOWLIST ⇒ 拒绝处理')
    reply.status(503).send({ result: 1, errmsg: 'callback auth not configured' })
    return
  }

  if (
    !isSmsCallbackAuthorized({
      providedToken: readToken(request),
      expectedToken,
      ip: request.ip,
      allowlist,
    })
  ) {
    reply.status(403).send({ result: 1, errmsg: 'forbidden' })
    return
  }

  // 回调也可能被刷:同 IP 每分钟最多 300 条,超出回 429 让腾讯稍后重试。
  const blocked = await tryConsumeWindows([
    { key: `sms:cb:${request.ip}`, windowMs: 60_000, max: 300 },
  ])
  if (blocked > 0) {
    reply.status(429).send({ result: 1, errmsg: 'too many requests' })
    return
  }

  const raw = coerceCallbackBody(request.body)
  if (raw === null || raw === undefined) {
    reply.status(200).send({ result: 0 })
    return
  }

  const items = Array.isArray(raw) ? raw : [raw]
  let statusCount = 0
  let replyCount = 0
  let unsubscribeCount = 0

  for (const item of items) {
    const kind = hint === 'unknown' ? classifyTencentCallback(item) : hint
    const meta = parseTencentCallback(item)
    if (!meta) {
      logger.warn('短信回调缺少手机号 ⇒ 丢弃', { kind })
      continue
    }

    if (kind === 'status') {
      const verdict = judgeTencentReport(item)
      const matched = await updateSmsDeliveryReport({
        phone: meta.phone,
        requestId: meta.requestId,
        serialNo: meta.serialNo,
        delivered: verdict.delivered,
        reason: verdict.code,
      })
      statusCount += 1
      if (!matched) {
        logger.warn('短信状态回执未对上本地发送流水', {
          phone: maskPhone(meta.phone),
          requestId: meta.requestId,
          serialNo: meta.serialNo,
          code: verdict.code,
        })
      }
      continue
    }

    if (kind === 'reply') {
      const content = meta.content ?? ''
      await recordSmsInbound({ phone: meta.phone, content, raw: item })
      replyCount += 1
      if (isUnsubscribeReply(content)) {
        const ok = await addSmsUnsubscribe({
          phone: meta.phone,
          reason: '用户回复退订',
          rawContent: content,
          source: 'reply',
        })
        if (ok) unsubscribeCount += 1
      }
      continue
    }

    logger.warn('短信回调类型无法判别 ⇒ 丢弃', { phone: maskPhone(meta.phone) })
  }

  logger.info('短信回调已处理', { statusCount, replyCount, unsubscribeCount })
  reply.status(200).send({ result: 0 })
}

export const smsCallbackRoutes: FastifyPluginAsync = async (server) => {
  server.post('/tencent', (request, reply) => handleCallback(request, reply))
  server.post('/tencent/status', (request, reply) => handleCallback(request, reply, 'status'))
  server.post('/tencent/reply', (request, reply) => handleCallback(request, reply, 'reply'))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
