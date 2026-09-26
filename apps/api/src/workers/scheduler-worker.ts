// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyInstance } from 'fastify'
import type { Worker } from 'bullmq'
import { redactSecrets } from '@ihui/shared'
import { createWorker } from '../plugins/queue.js'
import {
  SCHEDULER_QUEUE_NAME,
  SCHEDULED_JOBS,
  type ScheduledJobName,
} from '../plugins/scheduler.js'
import {
  autoCloseExpiredOrders,
  autoReconcileYesterday,
} from '../services/reconciliation-service.js'
import { DistributedLock } from '../utils/distributed-lock.js'
import { aggregateHeatStats } from '../services/heat-stats-service.js'
import { checkDailyAlerts } from '../services/alert-check-service.js'
import { archiveDailyData } from '../services/data-archive-service.js'
import { startExpirationMonitor } from '../services/expiration-monitor-service.js'
import { runFileCleanup } from '../services/cleanup-service.js'
import { cleanupExpiredUploadSessions } from '../services/upload-integrity.js'
import { expireVipMembers } from '../services/vip-expire-service.js'
import { autoCloseExpiredActivities } from '../services/activity-status-service.js'
import { calibrateCommissionSettlement } from '../services/commission-settle-service.js'
import {
  markInactiveAgents,
  cleanupOldHeatStats,
  cleanupOauthSessions,
} from '../services/scheduled-tasks-service.js'
import { pushAlert } from '../services/alert-notification-service.js'
import { scanAndChargeDueContracts } from '../services/subscription-service.js'
import {
  refreshWorkWechatToken,
  refreshWechatToken,
  refreshDingTalkToken,
} from '../services/token-refresh-service.js'
import {
  collectAllSources,
  processLlmBatch,
  translateTitles,
  computeTrendSignals,
  generateSnapshot,
  drainLlmBacklog,
} from '../services/ai-feed-service.js'
import { checkBudgetAlerts } from '../services/budget-alert-service.js'
import { scanAndRemindArrears } from '../services/edu-arrear-remind-service.js'
// O5(2026-09-21):llm_call_logs 到期原文清除(只清 prompt/response,计费/归因列保留)
import { purgeAllExpiredLlmCallLogRawText } from '../services/audit-log-service.js'

// ============================================================================
// 不可信外部文本 → 告警正文(AGENTS.md §5e:邮件是运维到人的**唯一**通道)
// ============================================================================
// 为什么必须有一层:本文件里 pushAlert 的 message 会被 alert-notification-service 原样
// 拼进 renderSystemAlertEmail 的正文,而它拼的是**上游资讯源返回的错误原文**
// (ai-feed-service 的 `e.message`,可能含上游响应体/URL/解析器转述)与**文件系统读回来的
// 文件名**。这些都不该未经长度上限约束地进到人收到的邮件里。
// 与本仓 monitoring/alertbridge/alert-webhook-bridge.cjs 同一条纪律:
// 「静默变短」比「变短」更糟 —— 截断必须在正文里点名丢了多少。

/**
 * 单条外部文本进告警正文的字符上限。
 * 取值理由:与 deploy/win/ihui-deploy.ps1:155 的「诊断串 >300 即截断」**同值**,
 * 本仓对"给人读的一行外部诊断"既有上限就是 300,不在这里拍第二个数。
 */
const ALERT_FIELD_MAX_CHARS = 300

/**
 * 整条告警 message 的字节上限。
 * 取值理由:与 alert-webhook-bridge.cjs 的 MAIL_BODY_MAX_BYTES(20,000 字节)**同值** ——
 * 两侧是同一条到人通道的两个生产者,尺子必须是一把,不得各定一档。
 */
const ALERT_MESSAGE_MAX_BYTES = 20_000

/** 截断说明自身占的字节预留:预留后追加说明,总长仍 ≤ 上限,上限才是真上限 */
const ALERT_MESSAGE_NOTICE_RESERVE_BYTES = 400

/**
 * 我们自己的错误类型 vs 上游原文。
 * 命中的是本仓 ai-feed-service 里那批固定前缀(`throw new Error(\`RSSHub ${url} 返回 ${status}\`)`
 * 那一族)、JS 错误类名、以及显式枚举的 Node 网络错误码;`unknown error` 是下面代码里
 * 我们自己写的字面量,一并算自有。
 * ⚠️ 这个区分**只决定标签,不决定处置**:两种都同样折行、剥控制字符、封顶截断。
 * ⚠️ 默认档是「上游原文」(更严的一侧):判不出来就不猜,宁可把自家诊断标成上游,
 *    也不把上游原文标成自有 —— 后者会让读信的人以为那段文本经过我们审核。
 */
const OWN_ERROR_SHAPE_RE =
  /^(?:(?:DailyHotApi|RSSHub|GitHub API|RSS XML|ModelScope Community|Toutiao HotBoard|fetch failed|unknown error)\b|[A-Z][A-Za-z0-9]*Error\b|ERR_[A-Z0-9_]+\b|ETIMEDOUT\b|ECONNREFUSED\b|ECONNRESET\b|ENOTFOUND\b|EAI_AGAIN\b|EPROTO\b|EHOSTUNREACH\b|ENETUNREACH\b|CERT_[A-Z_]+\b)/

/**
 * 外部文本归一化:剥 C0/C1 控制字符与零宽字符(§5c 的水印就靠 U+200B/2060 生存,
 * 放进正文等于允许外部文本在我们格式里藏不可见内容)→ 换行折成空格(一条外部错误
 * 只许占一行,不得凭空多造一行冒充另一条告警)→ 超档截断并点名丢弃字符数。
 */
const INVISIBLE_TEXT_RE = new RegExp(
  // 判据以 \uXXXX 的**转义文本**写进源文件,不留任何真实不可见字符:
  // 源文件里看不见的字符既骗过 code review 也骗过 grep —— 而本仓 §5c 的溯源水印
  // 正是靠 U+200B/200C/200D/2060 生存,它们是外部文本能用来藏东西的那一类字符。
  '[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f\\u200b-\\u200d\\u2060\\u2028\\u2029]',
  'g',
)

export function flattenUntrustedText(raw: unknown, maxChars: number = ALERT_FIELD_MAX_CHARS): string {
  const flat = String(raw ?? '')
    .replace(INVISIBLE_TEXT_RE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!flat) return ''
  // 脱敏必须在**截断之前**、且用共享层那一份实现(§3:端内不得再建第二套凭据正则):
  // 先截断再脱敏,会让落在 300 字符边界的凭据只被切掉一半而剩下可读片段;
  // 而"给人看的运维邮件"这一层,长度闸门不构成不把密钥寄出去的理由。
  const safe = redactSecrets(flat)
  if (safe.length <= maxChars) return safe
  return `${safe.slice(0, maxChars)}…[截断,已丢弃 ${safe.length - maxChars} 字符]`
}

/** 上游错误原文 → 带「自有诊断串 / 上游原文」标签的一行(归一化与封顶同上) */
export function untrustedErrorField(raw: unknown): string {
  const flat = flattenUntrustedText(raw)
  if (!flat) return '[上游原文] (无内容)'
  const kind = OWN_ERROR_SHAPE_RE.test(flat) ? '自有诊断串' : '上游原文'
  return `[${kind}] ${flat}`
}

/**
 * 整条告警正文的字节闸门(纯函数)。按码点累加,不按 UTF-16 索引切 ——
 * 切在代理对中间会产出坏字符,那等于把人要看的那半句也弄坏。
 */
export function capAlertMessage(text: string): string {
  const bytes = Buffer.byteLength(text, 'utf8')
  if (bytes <= ALERT_MESSAGE_MAX_BYTES) return text
  const budget = ALERT_MESSAGE_MAX_BYTES - ALERT_MESSAGE_NOTICE_RESERVE_BYTES
  let used = 0
  let cut = 0
  for (const ch of text) {
    const b = Buffer.byteLength(ch, 'utf8')
    if (used + b > budget) break
    used += b
    cut += ch.length
  }
  return (
    text.slice(0, cut) +
    `\n…[正文已达上限 ${ALERT_MESSAGE_MAX_BYTES} 字节,已丢弃 ${bytes - used} 字节;` +
    '被丢弃的明细不在本邮件内,请到告警面板/日志按 source 查看完整批次]'
  )
}


/**
 * 启动定时任务 Worker（消费 scheduler 队列的 repeatable jobs）。
 *
 * 多实例部署时，BullMQ 保证每个 delayed job 只被一个 worker 抢占执行，
 * 因此同一时刻同一 cron 任务只在一个实例上运行。
 *
 * 任务分发：
 * - expired-order-cleanup: 调 autoCloseExpiredOrders 关闭超时未支付订单
 * - reconciliation-daily: 调 autoReconcileYesterday 做昨日支付对账
 * - heat-stats-hourly: 调 aggregateHeatStats 聚合 Agent 热度统计
 * - alert-check-daily: 调 checkDailyAlerts 扫描告警噪音与升级
 * - data-archive-daily: 调 archiveDailyData 归档过期历史数据
 * - expiration-monitor: 调 startExpirationMonitor 检测 Agent 过期记录并联动 Canary 回滚
 */
export function startSchedulerWorker(server: FastifyInstance): Worker {
  const worker = createWorker<Record<string, unknown>>(
    server,
    SCHEDULER_QUEUE_NAME,
    async (job) => {
      const name = job.name as ScheduledJobName
      server.log.info({ jobId: job.id, jobName: name }, 'scheduled job started')

      // 启动业务计时器，end() 时自动上报 business_job_duration_seconds
      const timer = server.startBizTimer(name)

      try {
        switch (name) {
          case 'expired-order-cleanup': {
            const result = await autoCloseExpiredOrders()
            server.log.info(
              {
                scanned: result.scanned,
                closed: result.closed.length,
                failed: result.failed.length,
              },
              'expired orders cleaned',
            )
            // 上报任务执行成功
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'reconciliation-daily': {
            const result = await autoReconcileYesterday()
            server.log.info(
              {
                date: result.date,
                alipayLocal: result.alipay.localCount,
                wechatLocal: result.wechat.localCount,
              },
              'daily reconciliation done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'heat-stats-hourly': {
            const result = await aggregateHeatStats()
            server.log.info(
              { dateStr: result.dateStr, agents: result.aggregatedAgents, hits: result.totalHits },
              'heat stats aggregated',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'alert-check-daily': {
            const result = await checkDailyAlerts()
            server.log.info(
              {
                checked: result.checked,
                resolved: result.resolved,
                escalated: result.escalated,
                backupIssues: result.backupIssues,
              },
              'daily alert check done',
            )
            if (result.escalated > 0) {
              try {
                if (result.backupIssues.length > 0) {
                  await pushAlert({
                    title: '数据库备份监控告警(缺失/空备份/过期)',
                    // backupIssues 里混着**文件系统 readdir 读回来的文件名**与一条
                    // `检查异常 ${err.message}`(alert-check-service.ts:107)—— 后者是异常原文,
                    // 与资讯源错误同属不可信外部文本,按同一把尺子逐条折行 + 封顶。
                    message: capAlertMessage(
                      result.backupIssues
                        .map((s) => `- ${flattenUntrustedText(s)}`)
                        .join('\n'),
                    ),
                    severity: 'critical',
                    source: 'alert-check-daily',
                    metadata: {
                      checked: result.checked,
                      resolved: result.resolved,
                      escalated: result.escalated,
                      backupIssues: result.backupIssues,
                    },
                  })
                } else {
                  await pushAlert({
                    title: '告警升级通知',
                    message: `最近 24h 错误数 ${result.checked} 超过阈值,需要人工介入`,
                    severity: 'critical',
                    source: 'alert-check-daily',
                    metadata: {
                      checked: result.checked,
                      resolved: result.resolved,
                      escalated: result.escalated,
                    },
                  })
                }
              } catch (err) {
                server.log.error({ err }, 'pushAlert failed in alert-check-daily')
              }
            }
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'data-archive-daily': {
            const result = await archiveDailyData()
            server.log.info(
              {
                auditLogs: result.auditLogsArchived,
                messages: result.messagesArchived,
                notifications: result.notificationsArchived,
                errors: result.errors.length,
              },
              'daily data archive done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'file-cleanup-hourly': {
            const result = await runFileCleanup()
            server.log.info(
              {
                scanned: result.scanned,
                deletedByAge: result.deletedByAge,
                deletedBySize: result.deletedBySize,
                totalDeleted: result.totalDeleted,
                errors: result.errors.length,
              },
              'file cleanup done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'expiration-monitor': {
            const result = await startExpirationMonitor()
            server.log.info(
              {
                checkedBuy: result.checkedAgentBuy,
                expiredBuy: result.expiredAgentBuy,
                checkedSettlement: result.checkedAgentSettlement,
                expiredSettlement: result.expiredAgentSettlement,
                failStreak: result.failStreak,
                canaryTriggered: result.canaryTriggered,
                healthy: result.healthy,
              },
              'expiration monitor done',
            )
            try {
              server.recordJobExecution(name, result.healthy ? 'success' : 'failed')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'vip-expire-daily': {
            const result = await expireVipMembers()
            server.log.info(
              {
                scanned: result.scanned,
                expiredVips: result.expiredVips,
                downgradedUsers: result.downgradedUsers,
                errors: result.errors.length,
              },
              'VIP expire daily done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'activity-status-hourly': {
            const result = await autoCloseExpiredActivities()
            server.log.info(
              {
                scanned: result.scanned,
                endedActivities: result.endedActivities,
                errors: result.errors.length,
              },
              'activity status hourly done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'commission-settle-daily': {
            const result = await calibrateCommissionSettlement()
            server.log.info(
              {
                scanned: result.scanned,
                missedOrders: result.missedOrders,
                createdFlows: result.createdFlows,
                errors: result.errors.length,
              },
              'commission settle daily done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'mark-inactive-agents': {
            const result = await markInactiveAgents()
            server.log.info(
              { scanned: result.scanned, updated: result.updated },
              'mark inactive agents done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'cleanup-old-heat': {
            const result = await cleanupOldHeatStats()
            server.log.info({ deleted: result.deleted }, 'old heat stats cleaned')
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'oauth-session-cleanup': {
            const result = await cleanupOauthSessions()
            server.log.info({ deleted: result.deleted }, 'expired oauth sessions cleaned')
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'subscription-recurring-charge': {
            const result = await scanAndChargeDueContracts()
            server.log.info(
              {
                scanned: result.scanned,
                charged: result.charged,
                failed: result.failed,
                skipped: result.skipped,
                trialExtended: result.trialExtended,
              },
              'subscription recurring charge done',
            )
            // 8.3.1: 上报扣款明细到 Prometheus
            try {
              server.recordRecurringCharge({
                scanned: result.scanned,
                charged: result.charged,
                failed: result.failed,
                skipped: result.skipped,
                trialExtended: result.trialExtended,
              })
            } catch (err) {
              server.log.warn({ err }, 'recordRecurringCharge failed (non-fatal)')
            }
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'workwechat-token-refresh': {
            const result = await refreshWorkWechatToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'workwechat token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'wechat-token-refresh': {
            const result = await refreshWechatToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'wechat token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'dingtalk-token-refresh': {
            const result = await refreshDingTalkToken()
            server.log.info(
              {
                provider: result.provider,
                refreshed: result.refreshed,
                expiresAt: result.expiresAt,
                reason: result.reason,
              },
              'dingtalk token refresh done',
            )
            try {
              server.recordJobExecution(name, result.reason ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'ai-feed-collect': {
            const result = await collectAllSources()
            const failed = result.details.filter((d) => d.status === 'error')
            server.log.info(
              {
                fetchedSources: result.fetchedSources,
                totalItems: result.totalItems,
                detailsCount: result.details.length,
                failedSources: failed.length,
              },
              'ai-feed-collect done',
            )
            // P0 修复：采集存在失败源时主动告警，避免"靠人发现故障"。
            // 一旦某源连续失败需人工介入调整；全量或超半数失败按 critical 升级。
            if (failed.length > 0) {
              const ratio = failed.length / Math.max(result.fetchedSources || failed.length, 1)
              const severity =
                ratio >= 0.5 || failed.length === result.fetchedSources ? 'critical' : 'warning'
              const failedList = failed
                .map(
                  (d) =>
                    `- ${flattenUntrustedText(d.sourceCode) || '(未知源)'} → ${untrustedErrorField(d.error ?? 'unknown error')}`,
                )
                .join('\n')
              try {
                await pushAlert({
                  title: `AI 资讯采集失败告警（${failed.length}/${result.fetchedSources} 源失败）`,
                  message: capAlertMessage(
                    `本轮采集共 ${result.totalItems} 条，${result.fetchedSources} 源，其中 ${failed.length} 源失败：\n${failedList}`,
                  ),
                  severity,
                  source: 'ai-feed-collect',
                  metadata: {
                    totalItems: result.totalItems,
                    fetchedSources: result.fetchedSources,
                    failedCount: failed.length,
                    failedSources: failed.map((d) => d.sourceCode),
                  },
                })
              } catch (err) {
                server.log.error({ err }, 'pushAlert failed in ai-feed-collect')
              }
            }
            try {
              server.recordJobExecution(name, failed.length > 0 ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'ai-feed-process': {
            // 1. 先生成当日快照(computeTrendSignals 依赖快照数据,必须先执行)
            //    快照是纯 SQL upsert,几秒完成,串行等待不影响整体耗时
            const snapRes = await generateSnapshot().catch((err) => {
              server.log.error({ err }, 'generateSnapshot failed in ai-feed-process')
              return { insertedRows: 0 }
            })
            // 2. 三个子任务并行执行,各自独立 catch 防止一个失败拖垮全部
            //    computeTrendSignals 用刚生成的快照计算趋势(需 ≥2 天快照才有趋势)
            //    LLM 批大小走 ai-feed-service 的可配置默认值(LLM_CATEGORY_BATCH_SIZE=200 /
            //    LLM_TRANSLATE_BATCH_SIZE=100);LLM_BATCH_ENABLED=false 时二者内部直接返回 0。
            const [llmRes, transRes, trendRes] = await Promise.all([
              processLlmBatch().catch((err) => {
                server.log.error({ err }, 'processLlmBatch failed in ai-feed-process')
                return { processedItems: 0, failed: 0, details: String(err) }
              }),
              translateTitles().catch((err) => {
                server.log.error({ err }, 'translateTitles failed in ai-feed-process')
                return { processedItems: 0, failed: 0, details: String(err) }
              }),
              computeTrendSignals().catch((err) => {
                server.log.error({ err }, 'computeTrendSignals failed in ai-feed-process')
                return { processedItems: 0 }
              }),
            ])
            server.log.info(
              {
                snapshotRows: snapRes.insertedRows,
                llmProcessed: llmRes.processedItems,
                translated: transRes.processedItems,
                trendItems: trendRes.processedItems,
              },
              'ai-feed-process done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return { snapshot: snapRes, llm: llmRes, translate: transRes, trend: trendRes }
          }
          case 'ai-feed-drain': {
            // 互斥锁:同一时间全局只允许一个 drain 在跑。BullMQ worker 并发默认 5,
            // 多个 drain(repeat + 手动 accel)会同时处理 → 各自并发调 LLM 叠加,
            // 极易打爆 ai-service/litellm 的并发上限(默认 8),触发 502 风暴、
            // 翻译成功率 <10%。取不到锁的直接跳过本次(下一轮 repeat 再补)。
            const locker = new DistributedLock(server.redis)
            const drainLock = await locker.tryLock('ai-feed-drain:mutex', 'scheduler-worker', {
              ttlMs: 60 * 60 * 1000, // 单次 drain 最多约 1h,不续约,超时自动释放
            })
            if (!drainLock) {
              server.log.info(
                { jobId: job.id, jobName: name },
                'ai-feed-drain skipped: another drain running',
              )
              return { skipped: true, reason: 'another-drain-running' }
            }
            // 存量 LLM 积压抽干(错峰加速):多轮小批量 + 轮间 sleep,
            // 持续抽干缺英文标题/缺分类的存量条目。受 LLM_BATCH_ENABLED 控制,
            // 批大小/轮数/错峰间隔均可由环境变量覆盖。
            const result = await drainLlmBacklog()
              .catch((err) => {
                server.log.error({ err }, 'drainLlmBacklog failed in ai-feed-drain')
                return {
                  llmProcessed: 0,
                  translated: 0,
                  classifiedFailed: 0,
                  translateFailed: 0,
                  iterations: 0,
                  llmBacklogCleared: false,
                  translateBacklogCleared: false,
                  remainingNoLlm: -1,
                  remainingNoEn: -1,
                  zeroProgress: true,
                }
              })
              .finally(async () => {
                await locker.release(drainLock.name, drainLock.token).catch(() => false)
              })
            server.log.info(
              {
                llmProcessed: result.llmProcessed,
                translated: result.translated,
                classifiedFailed: result.classifiedFailed,
                translateFailed: result.translateFailed,
                iterations: result.iterations,
                llmBacklogCleared: result.llmBacklogCleared,
                translateBacklogCleared: result.translateBacklogCleared,
                remainingNoEn: result.remainingNoEn,
                remainingNoLlm: result.remainingNoLlm,
                zeroProgress: result.zeroProgress,
              },
              'ai-feed-drain done',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'budget-alert-check': {
            const result = await checkBudgetAlerts(server)
            server.log.info(
              {
                scanned: result.scanned,
                warning: result.warningCount,
                critical: result.criticalCount,
                errors: result.errors.length,
              },
              'budget alert check done',
            )
            try {
              server.recordJobExecution(name, result.errors.length > 0 ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'edu-arrear-remind-daily': {
            const result = await scanAndRemindArrears()
            server.log.info(
              {
                scanned: result.scanned,
                reminded: result.reminded,
                skippedToday: result.skippedToday,
                notifyFailed: result.notifyFailed,
                wxSent: result.wxSent,
                wxFailed: result.wxFailed,
              },
              'edu arrear remind done',
            )
            try {
              server.recordJobExecution(name, result.notifyFailed > 0 ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'llm-call-log-purge-daily': {
            // O5 原文留存:循环清除到期/按 key 关闭的 llm_call_logs 原文直到无到期行。
            // 函数内部已降级(DB 异常返回 purged=0 不抛出),这里不需要 try。
            const result = await purgeAllExpiredLlmCallLogRawText()
            server.log.info(
              { purged: result.purged, hasMore: result.hasMore, defaultDays: result.policy.defaultDays },
              'llm_call_logs raw-text purge done',
            )
            try {
              server.recordJobExecution(name, result.hasMore ? 'failed' : 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          case 'upload-session-reap-hourly': {
            // A9R12-G1 ③:过期分片会话回收(删 upload_sessions 行 + uploads/chunks/<uuid>/)。
            // cleanupExpiredUploadSessions 只按本表 uuid 形态删目录,不会整片删 uploads/。
            const result = await cleanupExpiredUploadSessions()
            server.log.info(
              {
                sessions: result.sessions,
                dirs: result.dirs,
                dirsRejected: result.dirsRejected,
              },
              'expired upload sessions reaped',
            )
            try {
              server.recordJobExecution(name, 'success')
            } catch {
              /* 指标采集失败不影响业务 */
            }
            return result
          }
          default:
            server.log.warn({ jobName: name }, 'unknown scheduled job')
            try {
              server.recordJobExecution(name, 'unknown')
            } catch {
              /* 指标采集失败不影响业务 */
            }
        }
      } catch (err) {
        // 上报任务执行失败
        try {
          server.recordJobExecution(name, 'failed')
        } catch {
          /* 指标采集失败不影响业务 */
        }
        throw err
      } finally {
        // 结束计时并上报耗时
        timer.end()
      }
    },
  )

  server.log.info(
    { count: SCHEDULED_JOBS.length, names: SCHEDULED_JOBS.map((j) => j.name) },
    'scheduler worker started',
  )
  return worker
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
