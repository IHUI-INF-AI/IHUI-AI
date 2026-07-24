/**
 * 资源上游同步中心 BullMQ Worker 消费者(2026-07-24 立)。
 *
 * 消费 registry-sync-queue 队列任务,调用适配器拉取上游数据,upsert 到 registry_items 表,
 * 并写入 registry_sync_logs 日志。
 *
 * 与 registry-queue.ts(生产者)配对:生产者入队 → 本 Worker 消费 → DB 落库。
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

export function startRegistrySyncWorker(server: FastifyInstance): Worker {
  const connection = server.redisForQueue
  if (!connection) {
    server.log.warn('registry-sync-worker: Redis 不适用,Worker 未启动')
    return {} as Worker
  }

  const worker = new Worker<RegistrySyncJobData>(
    REGISTRY_SYNC_QUEUE_NAME,
    async (job) => {
      const startedAt = new Date()
      // 问题1:解构 triggerId 用于回写;问题3:解构 force 透传至 SyncOptions
      const { sourceType, source, force, triggerId } = job.data
      const githubToken = process.env.GITHUB_TOKEN
      const customRegistryUrl = process.env.IHUI_CUSTOM_REGISTRY_URL

      server.log.info(
        { jobId: job.id, sourceType, source, force, triggerId },
        'registry-sync: 开始处理同步任务',
      )

      // 问题4:fetchAllRawItems 整体失败时写 sync_log 兜底,再 rethrow 让 BullMQ failed 也能捕获
      let items
      try {
        // force 透传至 SyncOptions,适配器可按需消费(index.ts 不在修改清单,适配器层跳过缓存逻辑暂不实现)
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
      // 问题2:聚合 newVersion 写 sync_log 变更字段(payloadHash 用 computePayloadHash 整体计算,无需单条 hash)
      let newVersion: string | null = null

      for (const raw of items) {
        try {
          const heat = calculateHeatScore(raw)
          const quality = calculateQualityScore(raw)
          await upsertRegistryItem(raw, heat, quality)
          synced++
          if (raw.version) newVersion = raw.version
        } catch (err) {
          failed++
          server.log.warn(
            { sourceId: raw.sourceId, err: err instanceof Error ? err.message : String(err) },
            'registry-sync: upsert 失败',
          )
        }
      }

      // 问题5:三态判定 — skipped(空结果)/ fail(全部失败)/ success(有成功)
      const status: 'success' | 'fail' | 'skipped' =
        failed > 0 ? (synced > 0 ? 'success' : 'fail') : (items.length === 0 ? 'skipped' : 'success')

      // 问题2:payloadHash 用 computePayloadHash 对所有 items 的 payload 整体计算;oldVersion 暂传 null
      const payloadHash = items.length > 0
        ? await computePayloadHash({ items: items.map((i) => i.payload) })
        : null

      await insertSyncLog({
        sourceType: sourceType ?? 'mcp',
        sourceName: source ?? 'all',
        status,
        errorMessage: failed > 0 ? `${failed} 个条目 upsert 失败` : null,
        payloadHash,
        oldVersion: null,
        newVersion,
        durationMs: Date.now() - startedAt.getTime(),
        startedAt,
        finishedAt: new Date(),
      })

      // 问题1:webhook trigger 状态回写 — 成功时标记 processed
      if (triggerId) {
        try {
          await markWebhookTriggerProcessed(
            triggerId,
            'processed',
            `同步完成: synced=${synced} failed=${failed}`,
          )
        } catch (err) {
          server.log.warn(
            { triggerId, err: err instanceof Error ? err.message : String(err) },
            'registry-sync: 回写 webhook trigger processed 失败',
          )
        }
      }

      server.log.info(
        { jobId: job.id, synced, failed, total: items.length, durationMs: Date.now() - startedAt.getTime() },
        'registry-sync: 同步任务完成',
      )

      return { synced, failed, total: items.length }
    },
    { connection, concurrency: 1 },
  )

  worker.on('failed', (job, err) => {
    server.log.error(
      { jobId: job?.id, err: err.message },
      'registry-sync: 同步任务异常',
    )
    // 问题1:webhook trigger 状态回写 — 失败时标记 failed
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

  return worker
}
