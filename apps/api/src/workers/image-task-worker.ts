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
  completeImageTask,
  failImageTask,
  getImageTask,
} from '../routes/v1-multimodal.js'

let scheduledTask: ScheduledTask | null = null
let running = false

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
      try {
        // 标记 processing(防重复消费)
        const fresh = await getImageTask(task.id)
        if (!fresh || fresh.status !== 'pending') continue
        const result = await forwardToChannel({
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
            await completeImageTask(task.id, urls)
            ok++
          } else {
            await failImageTask(task.id, '上游返回空产出')
            failed++
          }
        } else {
          await failImageTask(task.id, '上游渠道不可用或返回失败')
          failed++
        }
      } catch (e) {
        await failImageTask(task.id, e instanceof Error ? e.message : String(e)).catch(() => {})
        failed++
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
