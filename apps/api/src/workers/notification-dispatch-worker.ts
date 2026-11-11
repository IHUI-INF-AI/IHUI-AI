// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { sql } from 'drizzle-orm'
import {
  createWorker,
  QUEUE_NAMES,
  type TargetedDispatchJobData,
  type Job,
} from '../plugins/queue.js'
import { sendEmail } from '../services/email-service.js'
import { renderNoticeEmail } from '../services/email-templates.js'
import { sendSmsMessage } from '../services/sms.js'
import { db } from '../db/index.js'

/**
 * Notification Dispatch Worker — 定向通知派发队列消费者。
 *
 * send-targeted 端点的 email/sms 异步派发:
 * - 调用 email-service / sms-service 发送
 * - 写入 notification_logs 记录结果
 *
 * in_app 渠道在端点同步处理(WebSocket 实时推送),不经过此队列。
 *
 * F-91(2026-11-11):失败不再一律"记一行 failed 后当成功返回"。
 * 可重试错误(网络/超时/限流/5xx)在日志落库后 **throw**,让 BullMQ 按队列默认的
 * attempts=3 + exponential backoff 重试并最终进 failed 集;不可重试错误(配置缺失、
 * 鉴权 401/403、收件人非法、模板错误)才落终态并正常 return,不空烧 3 次重试。
 */

/** 派发失败的处置分类:`retry` = 交给 BullMQ 重试,`fatal` = 终态不再重试。 */
export type DispatchErrorClass = 'retry' | 'fatal'

/**
 * 明确不可重试的错误特征(先于重试族判定):
 * 鉴权失败、收件人/手机号非法、配置缺失、SDK 未安装 —— 重试多少次结果都一样。
 *
 * 只收"确定终态"的特征;看不出来的文本一律交给 RETRY_ERROR_PATTERNS,最后按
 * 最坏情况重试(见 classifyDispatchError)。
 */
const FATAL_ERROR_PATTERNS: readonly RegExp[] = [
  /(?:^|[^0-9])(?:401|403)(?:[^0-9]|$)/,
  /unauthori[sz]ed|forbidden|auth(?:entication|orization)?\s*(?:failed|error|denied)/i,
  /invalid\s+(?:api\s*)?key|api[_ ]key\s+(?:missing|invalid)/i,
  /invalid\s+(?:e-?mail|address|recipient|phone|mobile|number|to)\b/i,
  /(?:无效|非法)(?:的)?(?:邮箱|邮件地址|手机号|号码|地址)/,
  /not[_ -]?configured|missing\s+(?:config|configuration|smtp|api\s*key)|nodemailer not installed|sdk_unavailable|缺少[^,。;!?]*配置|未配置/i,
]

/** 可重试族:网络断连、超时、限流、网关/服务端 5xx。 */
const RETRY_ERROR_PATTERNS: readonly RegExp[] = [
  /ECONNREFUSED|ECONNRESET|ECONNABORTED|EPIPE|ETIMEDOUT|ESOCKETTIMEDOUT|ENETUNREACH|EHOSTUNREACH|EAI_AGAIN|ENOTFOUND/i,
  /socket hang up|connection\s+(?:reset|refused|closed|aborted)/i,
  /time(?:d)?\s*out|timeout|aborted|temporar(?:ily|y)?/i,
  /rate.?limit|too many requests|throttl|business_limit|limit_control/i,
  /(?:^|[^0-9])(?:408|425|429|5\d\d)(?:[^0-9]|$)/,
]

/** 模板类错误(弱特征,放在重试族之后判):模板不存在/未过审/变量不匹配。 */
const TEMPLATE_ERROR_PATTERN =
  /(?:invalid|missing|unknown|not\s*found)\s+[^,;:]{0,20}template|template[^,;:]{0,20}(?:invalid|missing|not\s*found)|模板[^,。;!?]*(?:错误|无效|不存在|未配置|不匹配)/i

/**
 * 把发送失败信息分类成 `retry` / `fatal`(纯函数,零副作用)。
 *
 * 判据顺序:明确 fatal → 明确 retry → 模板 fatal → 默认 retry。
 * 默认取 retry 是保守方向:判不出来时宁可多试两次并最终进 failed 队列让运维看见,
 * 也不要把一次网关抖动当成永久失败静默丢弃(正是 F-91 的原始故障形态)。
 */
export function classifyDispatchError(message: string | null | undefined): DispatchErrorClass {
  const text = (message ?? '').trim()
  if (!text) return 'retry'
  if (FATAL_ERROR_PATTERNS.some((p) => p.test(text))) return 'fatal'
  if (RETRY_ERROR_PATTERNS.some((p) => p.test(text))) return 'retry'
  if (TEMPLATE_ERROR_PATTERN.test(text)) return 'fatal'
  return 'retry'
}

/** 一条待落库的 notification_logs 记录(与 INSERT 列一一对应)。 */
export interface DispatchLogRow {
  userId: string
  msgType: string
  title: string
  content: string
  channel: 'email' | 'sms'
  status: string
  errorMessage: string | null
}

/**
 * processDispatchJob 的外部依赖。抽成注入项只为让单测能无 DB/Redis 跑生产判据,
 * 生产默认路径(见 startNotificationDispatchWorker)直接传真实 sendEmail / sendSmsMessage / db。
 */
export interface DispatchDeps {
  sendEmail: typeof sendEmail
  sendSmsMessage: typeof sendSmsMessage
  insertLog: (row: DispatchLogRow) => Promise<void>
  /** 日志写入失败时的通知钩子(不影响抛错:原始失败仍会继续向上抛给 BullMQ)。 */
  onLogError?: (err: unknown, jobId?: string) => void
}

/**
 * 处理一条定向派发任务(F-91 抽出的可测纯逻辑,不直接持有 db/redis 句柄)。
 *
 * 返回 = 终态(sent / stub / 不可重试的 failed);抛出 = 可重试失败。
 * 抛错前必然已尝试写 notification_logs,运维补偿时有据可查。
 */
export async function processDispatchJob(
  job: { id?: string; data: TargetedDispatchJobData },
  deps: DispatchDeps,
): Promise<{ userId: string; channel: 'email' | 'sms'; status: string }> {
  const { userId, channel, email, phone, nickname, title, content, msgType } = job.data
  let status = 'sent'
  let errorMessage: string | null = null
  let errorClass: DispatchErrorClass | null = null

  try {
    if (channel === 'email') {
      const rendered = renderNoticeEmail({
        tag: 'SYSTEM // NOTICE',
        title,
        userName: nickname ?? undefined,
        content,
      })
      const result = await deps.sendEmail({
        to: email!,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      })
      if (result.sent) {
        status = 'sent'
      } else if (result.stub) {
        // stub = 该收件人路由无任何可用通道(本地/测试未配 SMTP 的预期状态),
        // 与 F-36 的 email worker 同口径:不重试,否则本地队列会对每封信无限重烧。
        status = 'stub'
      } else {
        status = 'failed'
        errorMessage = result.error ?? null
        errorClass = classifyDispatchError(errorMessage)
      }
    } else {
      const result = await deps.sendSmsMessage(phone!, content)
      if (!result.success) {
        status = 'failed'
        errorMessage = result.error ?? null
        errorClass = classifyDispatchError(errorMessage)
      }
    }
  } catch (e) {
    status = 'failed'
    errorMessage = (e as Error)?.message ?? String(e)
    errorClass = classifyDispatchError(errorMessage)
  }

  // F-91:先落日志、再决定抛不抛。重试与终态都写 status='failed' —— 表上并没有
  // 'retrying' 这个状态契约(统计口径按 status 聚合),用 error_message 前缀
  // `retry:` / `fatal:` 区分处置方式,运维可直接 LIKE 'retry:%' 统计网关抖动。
  // 适用 §「无论重试还是终态先落一行」:抛错发生在写库之后,补偿有据可查。
  try {
    await deps.insertLog({
      userId,
      msgType,
      title,
      content,
      channel,
      status,
      errorMessage: errorClass ? `${errorClass}: ${errorMessage ?? 'unknown'}` : errorMessage,
    })
  } catch (e) {
    // 日志写失败不得改变处置结论:可重试失败仍然要抛给 BullMQ。
    deps.onLogError?.(e, job.id)
  }

  if (errorClass === 'retry') {
    throw new Error(
      `notification dispatch failed (retryable): jobId=${job.id ?? 'unknown'} channel=${channel} ` +
        `userId=${userId} error=${errorMessage ?? 'unknown'}`,
    )
  }

  return { userId, channel, status }
}

export function startNotificationDispatchWorker(server: FastifyInstance): Worker {
  return createWorker<TargetedDispatchJobData>(
    server,
    QUEUE_NAMES.notificationDispatch,
    async (job: Job<TargetedDispatchJobData>) => {
      const result = await processDispatchJob(job, {
        sendEmail,
        sendSmsMessage,
        insertLog: async (row) => {
          await db.execute(sql`
            INSERT INTO notification_logs (user_id, type, title, content, channel, status, error_message, created_at)
            VALUES (${row.userId}::uuid, ${row.msgType}, ${row.title}, ${row.content}, ${row.channel}, ${row.status}, ${row.errorMessage}, NOW())
          `)
        },
        onLogError: (e, jobId) =>
          server.log.warn({ err: e, jobId }, 'notification_dispatch log insert failed'),
      })

      server.log.info(
        { jobId: job.id, userId: result.userId, channel: result.channel, status: result.status },
        'notification dispatch job processed',
      )
      return result
    },
  )
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
