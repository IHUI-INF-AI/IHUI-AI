/**
 * P1-4 分类同步 API 5 端点（迁移自 coze_zhs_py/api/category_sync_api.py）
 *
 * 端点清单：
 *   1. POST /api/category-sync/pull     从远程拉取分类
 *   2. POST /api/category-sync/push     推送本地分类到远程
 *   3. GET  /api/category-sync/status   同步状态
 *   4. POST /api/category-sync/resolve  解决冲突
 *   5. GET  /api/category-sync/history  同步历史
 *
 * 实现：in-memory Map（进程级单例，简化实现，后续可换 DB / Redis）。
 * 鉴权：requireAdmin（roleId >= 1，与 admin 路由一致）。
 * 路径：绝对路径字面量注册，确保 scripts/check-api-routes.mjs 静态扫描可识别。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { requireAdmin } from '../plugins/require-permission.js'
import { success } from '../utils/response.js'
import { generateTrackingId } from '../utils/crypto-random.js'

// =============================================================================
// In-memory sync state + history（进程级单例）
// =============================================================================

type SyncDirection = 'pull' | 'push'
type SyncStatus = 'pending' | 'running' | 'success' | 'failed' | 'conflict'
type OverallStatus = 'idle' | 'running' | 'success' | 'failed'

interface SyncRecord {
  id: string
  direction: SyncDirection
  status: SyncStatus
  startedAt: string
  finishedAt: string
  total: number
  processed: number
  conflicts: number
  message: string
  remoteUrl?: string
}

interface ConflictItem {
  key: string
  localValue: unknown
  remoteValue: unknown
  resolution: 'local' | 'remote' | 'manual'
  detectedAt: string
}

const syncRecords = new Map<string, SyncRecord>()
const pendingConflicts: ConflictItem[] = []
let lastSyncStatus: OverallStatus = 'idle'

function genId(prefix: string): string {
  // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成同步 ID
  return generateTrackingId(prefix)
}

function nowIso(): string {
  return new Date().toISOString()
}

// =============================================================================
// Zod schemas
// =============================================================================

const pullBodySchema = z.object({
  remoteUrl: z.string().url().optional(),
  filter: z.string().max(200).optional(),
})

const pushBodySchema = z.object({
  remoteUrl: z.string().url().optional(),
  keys: z.array(z.string().min(1).max(128)).max(100).optional(),
})

const resolveBodySchema = z.object({
  conflicts: z
    .array(
      z.object({
        key: z.string().min(1).max(128),
        resolution: z.enum(['local', 'remote', 'manual']),
      }),
    )
    .min(1)
    .max(100),
})

const historyQuerySchema = z.object({
  page: z.string().optional(),
  pageSize: z.string().optional(),
  direction: z.enum(['pull', 'push']).optional(),
})

function toPositiveInt(v: string | undefined, fallback: number): number {
  if (!v) return fallback
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

// =============================================================================
// Routes plugin
// =============================================================================

export const categorySyncRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 3. GET /api/category-sync/status - 同步状态
  server.get('/api/category-sync/status', async (_req, reply) => {
    const records = Array.from(syncRecords.values()).sort((a, b) =>
      a.startedAt < b.startedAt ? 1 : -1,
    )
    const last = records[0]
    return reply.send(
      success({
        status: lastSyncStatus,
        lastSyncAt: last?.finishedAt ?? null,
        lastDirection: last?.direction ?? null,
        lastStatus: last?.status ?? null,
        totalRecords: syncRecords.size,
        pendingConflicts: pendingConflicts.length,
      }),
    )
  })

  // 5. GET /api/category-sync/history - 同步历史
  server.get('/api/category-sync/history', async (request, reply) => {
    const q = historyQuerySchema.parse(request.query)
    let records = Array.from(syncRecords.values()).sort((a, b) =>
      a.startedAt < b.startedAt ? 1 : -1,
    )
    if (q.direction) {
      records = records.filter((r) => r.direction === q.direction)
    }
    const page = toPositiveInt(q.page, 1)
    const pageSize = toPositiveInt(q.pageSize, 20)
    const start = (page - 1) * pageSize
    const items = records.slice(start, start + pageSize)
    return reply.send(
      success({
        items,
        total: records.length,
        page,
        pageSize,
      }),
    )
  })

  // 1. POST /api/category-sync/pull - 从远程拉取分类
  server.post('/api/category-sync/pull', async (request, reply) => {
    const body = pullBodySchema.parse(request.body ?? {})
    const id = genId('sync_pull')
    const startedAt = nowIso()
    // 简化实现：实际场景应调用远程 API + onConflictDoNothing 入库
    const record: SyncRecord = {
      id,
      direction: 'pull',
      status: 'success',
      startedAt,
      finishedAt: nowIso(),
      total: 0,
      processed: 0,
      conflicts: 0,
      message: body.remoteUrl ? `从 ${body.remoteUrl} 拉取完成` : '拉取完成',
      remoteUrl: body.remoteUrl,
    }
    syncRecords.set(id, record)
    lastSyncStatus = 'success'
    return reply.send(success(record))
  })

  // 2. POST /api/category-sync/push - 推送本地分类到远程
  server.post('/api/category-sync/push', async (request, reply) => {
    const body = pushBodySchema.parse(request.body ?? {})
    const id = genId('sync_push')
    const startedAt = nowIso()
    const count = body.keys?.length ?? 0
    // 简化实现：实际场景应批量 POST 到远程 + 处理冲突
    const record: SyncRecord = {
      id,
      direction: 'push',
      status: 'success',
      startedAt,
      finishedAt: nowIso(),
      total: count,
      processed: count,
      conflicts: 0,
      message: body.remoteUrl ? `推送到 ${body.remoteUrl} 完成` : '推送完成',
      remoteUrl: body.remoteUrl,
    }
    syncRecords.set(id, record)
    lastSyncStatus = 'success'
    return reply.send(success(record))
  })

  // 4. POST /api/category-sync/resolve - 解决冲突
  server.post('/api/category-sync/resolve', async (request, reply) => {
    const body = resolveBodySchema.parse(request.body ?? {})
    const resolvedKeys: string[] = []
    for (const item of body.conflicts) {
      const idx = pendingConflicts.findIndex((c) => c.key === item.key)
      if (idx === -1) continue
      const conflict = pendingConflicts[idx]
      if (!conflict) continue
      conflict.resolution = item.resolution
      resolvedKeys.push(conflict.key)
      pendingConflicts.splice(idx, 1)
    }
    return reply.send(
      success({
        resolved: resolvedKeys.length,
        resolvedKeys,
        remaining: pendingConflicts.length,
      }),
    )
  })
}
