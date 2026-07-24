/**
 * 资源上游同步中心 BullMQ Worker 消费者(2026-07-24 立)。
 *
 * 消费 registry-sync-queue 队列任务,调用适配器拉取上游数据,upsert 到 registry_items 表,
 * 并写入 registry_sync_logs 日志。
 *
 * 与 registry-queue.ts(生产者)配对:生产者入队 → 本 Worker 消费 → DB 落库。
 *
 * 缺口修复(2026-07-24):
 * - d1:幂等 + 重试去重(lockDuration=60s + maxStalledCount=1 + payload_hash 跳过未变更条目)
 * - d3:sync_log oldVersion 聚合(取第一个版本有变化的 oldVersion,不再恒为 null)
 * - d10:优雅关闭(SIGTERM/SIGINT,process.once 避免重复注册)+ 指标统计(挂到 server.registryWorkerStats)
 */
import type { FastifyInstance } from 'fastify'
import { Worker } from 'bullmq'
import { REGISTRY_SYNC_QUEUE_NAME, type RegistrySyncJobData } from '../plugins/registry-queue.js'
import {
  fetchAllRawItems,
  calculateHeatScore,
  calculateQualityScore,
  computePayloadHash,
} from '../services/registry-sync/index.js'
import {
  upsertRegistryItem,
  insertSyncLog,
  markWebhookTriggerProcessed,
} from '../db/registry-queries.js'

/** Worker 运行时指标(供 /api/registry/worker-stats 端点读取,简化版挂到 server 实例) */
export interface RegistryWorkerStats {
  processed: number
  failed: number
  lastProcessedAt: Date | null
}

export function startRegistrySyncWorker(server: FastifyInstance): Worker {
  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('registry-sync-worker: Redis 不适用,Worker 未启动')
    return {} as Worker
  }

  // d10:指标统计(挂到 server 实例,供 worker-stats 端点读取)
  const stats: RegistryWorkerStats = {
    processed: 0,
    failed: 0,
    lastProcessedAt: null,
  }
  ;(server as any).registryWorkerStats = stats

  const worker = new Worker<RegistrySyncJobData>(
    REGISTRY_SYNC_QUEUE_NAME,
    async (job) => {
      const startedAt = new Date()
      const { sourceType, source, force, triggerId } = job.data
      const githubToken = process.env.GITHUB_TOKEN
      const customRegistryUrl = process.env.IHUI_CUSTOM_REGISTRY_URL

      // d1:重试检测(job 未配 attempts,attemptsMade 恒为 0;防御性日志,供未来启用重试时排查)
      const isRetry = job.attemptsMade > 0
      if (isRetry) {
        server.log.warn(
          { jobId: job.id, attemptsMade: job.attemptsMade },
          'registry-sync: 重试任务,启用幂等检查',
        )
      }

      server.log.info(
        { jobId: job.id, sourceType, source, force, triggerId, attemptsMade: job.attemptsMade },
        'registry-sync: 开始处理同步任务',
      )

      // fetchAllRawItems 整体失败时写 sync_log 兜底,再 rethrow 让 BullMQ failed 也能捕获
      let items
      try {
        items = await fetchAllRawItems(
          sourceType ?? undefined,
          source ?? undefined,
          { githubToken, customRegistryUrl, force },
        )
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        await insertSyncLog({
          sourceType: sourceType ?? 'mcp',
          sourceName: source ?? 'all',
          status: 'fail',
          errorMessage: `fetchAllRawItems 失败: ${errMsg}`,
          durationMs: Date.now() - startedAt.getTime(),
          startedAt,
          finishedAt: new Date(),
        })
        throw err
      }

      let synced = 0
      let failed = 0
      let skipped = 0
      // d2:聚合 newVersion(取第一个非空) + oldVersion(取第一个版本有变化的)
      let newVersion: string | null = null
      let oldVersion: string | null = null

      for (const raw of items) {
        try {
          const heat = calculateHeatScore(raw)
          const quality = calculateQualityScore(raw)
          const result = await upsertRegistryItem(raw, heat, quality)
          // d1:幂等检查 — 非 force 且未变更(inserted=false 且 oldVersion === raw.version)记为 skipped
          if (!force && !result.inserted && result.oldVersion === raw.version) {
            skipped++
          } else {
            synced++
          }
          if (raw.version && !newVersion) newVersion = raw.version
          // d2:收集 oldVersion(取第一个版本有变化的,即 oldVersion !== raw.version)
          if (result.oldVersion && result.oldVersion !== raw.version && !oldVersion) {
            oldVersion = result.oldVersion
          }
        } catch (err) {
          failed++
          server.log.warn(
            { sourceId: raw.sourceId, err: err instanceof Error ? err.message : String(err) },
            'registry-sync: upsert 失败',
          )
        }
      }

      // 三态判定 — skipped(空结果)/ fail(全部失败)/ success(有成功)
      const status: 'success' | 'fail' | 'skipped' =
        failed > 0 ? (synced > 0 ? 'success' : 'fail') : (items.length === 0 ? 'skipped' : 'success')

      const payloadHash = items.length > 0
        ? await computePayloadHash({ items: items.map((i) => i.payload) })
        : null

      await insertSyncLog({
        sourceType: sourceType ?? 'mcp',
        sourceName: source ?? 'all',
        status,
        errorMessage: failed > 0 ? `${failed} 个条目 upsert 失败` : null,
        payloadHash,
        oldVersion,
        newVersion,
        durationMs: Date.now() - startedAt.getTime(),
        startedAt,
        finishedAt: new Date(),
      })

      // webhook trigger 状态回写 — 成功时标记 processed
      // 注:job 未配 attempts,failed 事件即最终失败,无需检查是否已被前次重试标记
      if (triggerId) {
        try {
          await markWebhookTriggerProcessed(
            triggerId,
            'processed',
            `同步完成: synced=${synced} failed=${failed} skipped=${skipped}`,
          )
        } catch (err) {
          server.log.warn(
            { triggerId, err: err instanceof Error ? err.message : String(err) },
            'registry-sync: 回写 webhook trigger processed 失败',
          )
        }
      }

      server.log.info(
        { jobId: job.id, synced, failed, skipped, total: items.length, durationMs: Date.now() - startedAt.getTime() },
        'registry-sync: 同步任务完成',
      )

      return { synced, failed, skipped, total: items.length }
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 60000,    // d1:60s,避免长任务被判定 stalled
      maxStalledCount: 1,     // d1:最多 stall 1 次后判定失败,避免无限重试
    },
  )

  worker.on('completed', () => {
    stats.processed++
    stats.lastProcessedAt = new Date()
  })
  worker.on('failed', (job, err) => {
    stats.failed++
    server.log.error(
      { jobId: job?.id, err: err.message },
      'registry-sync: 同步任务异常',
    )
    // webhook trigger 状态回写 — 失败时标记 failed
    const triggerId = job?.data?.triggerId
    if (triggerId) {
      markWebhookTriggerProcessed(triggerId, 'failed', err.message).catch((e) => {
        server.log.warn(
          { triggerId, err: e instanceof Error ? e.message : String(e) },
          'registry-sync: 回写 webhook trigger failed 失败',
        )
      })
    }
  })

  // d10:优雅关闭 — process.once 避免重复注册(worker 理论上只创建一次,防御性编程)
  const gracefulShutdown = async (signal: string) => {
    server.log.info({ signal }, 'registry-sync: 收到关闭信号,正在优雅关闭 worker...')
    try {
      await worker.close()
      server.log.info('registry-sync: worker 已优雅关闭')
    } catch (err) {
      server.log.error(
        { err: err instanceof Error ? err.message : String(err) },
        'registry-sync: worker 关闭失败',
      )
    }
  }
  process.once('SIGTERM', () => void gracefulShutdown('SIGTERM'))
  process.once('SIGINT', () => void gracefulShutdown('SIGINT'))

  return worker
}
