// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

// __PROVENANCE_HEAD_1__
// __PROVENANCE_HEAD_2__
// __PROVENANCE_HEAD_3__

/**
 * 异步图片任务 Worker(2026-09-17 立,补强 60 收官)。
 *
 * 消费 relay_prompt_audit 之外的异步图片任务:轮询 Redis 中 status='pending'
 * 的任务 → 调用 forwardToChannel 走真实上游生图 → completeImageTask/failImageTask。
 *
 * 调度:node-cron 每 30 秒扫描一次(单实例内串行,避免并发打爆上游);
 * Redis 不可用降级进程内 Map 同样被扫到。
 *
 * 计费:走 forwardToChannel 内置的既有计费链路(与同步端点一致,无额外逻辑)。
 */
import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../utils/logger.js'
import { forwardToChannel } from '../services/relay-upstream-forwarder.js'
import {
  listPendingImageTasks,
  claimImageTask,
  completeImageTask,
  failImageTask,
} from '../routes/v1-multimodal.js'

let scheduledTask: ScheduledTask | null = null
let running = false

// F-493:上游生图调用必须有硬超时。此前无 AbortSignal ⇒ 渠道挂起(建连成功但不回响应)时
// 整轮 await 永不返回,`running` 卡在 true,后续每 30s 的扫描全被挡掉,该实例所有 pending
// 任务永久积压。超时按失败处理(落 failed + 释放租约),迟到响应直接丢弃,不再写成功结果。
const DEFAULT_IMAGE_TASK_TIMEOUT_MS = 120_000

/** 单次上游生图超时(ms)。测试/排障可用 IMAGE_TASK_TIMEOUT_MS 收紧。 */
function imageTaskTimeoutMs(): number {
  const raw = Number(process.env.IMAGE_TASK_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_IMAGE_TASK_TIMEOUT_MS
}

/**
 * 带超时的上游生图调用:超时即 abort 并 reject(由调用方按失败落库),
 * 晚到的上游响应不再回到调用方,因此不会覆盖已落定的 failed 状态。
 */
async function forwardImageWithTimeout(
  req: Parameters<typeof forwardToChannel>[0],
): Promise<Awaited<ReturnType<typeof forwardToChannel>>> {
  const timeoutMs = imageTaskTimeoutMs()
  const controller = new AbortController()
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      forwardToChannel({ ...req, signal: controller.signal }),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new Error(`上游生图超时(${timeoutMs}ms)`))
        }, timeoutMs)
        timer.unref()
      }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 单次扫描:取 pending 任务,逐个调上游生图并推进状态。 */
export async function processImageTasks(): Promise<{
  processed: number
  ok: number
  failed: number
}> {
  if (running) return { processed: 0, ok: 0, failed: 0 }
  running = true
  let ok = 0
  let failed = 0
  try {
    const pending = await listPendingImageTasks()
    if (pending.length === 0) return { processed: 0, ok: 0, failed: 0 }
    logger.info(`[image-worker] 发现 ${pending.length} 个 pending 任务`)
    for (const task of pending) {
      // 抢占租约:SET NX + 状态 CAS 在 Redis 内原子完成,重复投递 / 多副本并发时
      // 只有一个 worker 拿到令牌,其余直接跳过,不会重复调上游、重复计费(F-48/F-492)。
      const claimToken = await claimImageTask(task.id)
      if (!claimToken) {
        logger.debug('[image-worker] 任务已被其他 worker 认领,跳过', { taskId: task.id })
        continue
      }
      try {
        const result = await forwardImageWithTimeout({
          model: task.model,
          endpoint: 'images',
          stream: false,
          bodyOverride: { model: task.model, prompt: task.prompt },
          userId: task.userId ?? undefined,
          affinityKey: undefined,
        })
        if (result && result.ok) {
          const upstream = (await result.response.json().catch(() => null)) as {
            data?: Array<{ url?: string; b64_json?: string }>
          } | null
          const arr = Array.isArray(upstream?.data) ? upstream.data : []
          const urls = arr
            .map((d) =>
              typeof d.url === 'string'
                ? d.url
                : d.b64_json
                  ? `data:image/png;base64,${d.b64_json}`
                  : '',
            )
            .filter((u) => u !== '')
          if (urls.length > 0) {
            // 带归属条件写回:租约已过期并被他人重新认领时拒绝落地,不覆写他人结果。
            if (await completeImageTask(task.id, urls, claimToken)) ok++
            else
              logger.warn('[image-worker] 完成写回被拒(租约已易主),结果丢弃', { taskId: task.id })
          } else {
            if (await failImageTask(task.id, '上游返回空产出', claimToken)) failed++
            else
              logger.warn('[image-worker] 失败写回被拒(租约已易主),结果丢弃', { taskId: task.id })
          }
        } else {
          if (await failImageTask(task.id, '上游渠道不可用或返回失败', claimToken)) failed++
          else logger.warn('[image-worker] 失败写回被拒(租约已易主),结果丢弃', { taskId: task.id })
        }
      } catch (e) {
        // 失败释放租约(仅令牌匹配才释放),任务不再卡在 processing,可被重新认领重试。
        const released = await failImageTask(
          task.id,
          e instanceof Error ? e.message : String(e),
          claimToken,
        ).catch(() => false)
        if (released) failed++
        else logger.warn('[image-worker] 失败写回被拒(租约已易主),结果丢弃', { taskId: task.id })
        logger.warn('[image-worker] 任务处理异常', {
          err: e instanceof Error ? e.message : String(e),
        })
      }
    }
    return { processed: pending.length, ok, failed }
  } finally {
    running = false
  }
}

export function startImageTaskWorker(): void {
  if (scheduledTask) return
  scheduledTask = cron.schedule(
    '*/30 * * * * *',
    async () => {
      try {
        await processImageTasks()
      } catch (e) {
        logger.error('[image-worker] 扫描异常', { err: e instanceof Error ? e.message : String(e) })
      }
    },
    { timezone: 'Asia/Shanghai' },
  )
  logger.info('[image-worker] scheduler started (every 30s)')
}

export function stopImageTaskWorker(): void {
  if (scheduledTask) {
    scheduledTask.stop()
    scheduledTask = null
    logger.info('[image-worker] scheduler stopped')
  }
}

// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
