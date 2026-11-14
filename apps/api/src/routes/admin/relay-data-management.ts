// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { dbRead, db } from '../../db/index.js'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { booleanStringSchemaOptional } from '../../utils/parse-boolean.js'

/**
 * /api/admin/relay/data-management 数据管理(2026-09-17 立,补强 56,对标竞品 /data-management)。
 *
 * 端点(requireAdmin):
 * 1. GET  /relay/data-management/stats   — 各可清理表的行数与最老记录时间
 * 2. POST /relay/data-management/cleanup — 按白名单表 + 保留天数清理
 *    body { table, keepDays, dryRun? } — dryRun=true 只返回将删除的行数
 *
 * 安全:表名走白名单映射(绝不拼接用户输入的表名);清理按 created_at <
 * now() - keepDays 天;单批上限 50000 行防长事务(超量可多次执行)。
 * 动态表名经 sql.identifier 参数化。execute 返回形态因驱动而异
 * (pg QueryResult.rows / neon-http RowList),用 firstRow/rowCount 统一取值。
 */
const CLEANABLE: Record<string, { table: string; desc: string }> = {
  llm_call_logs: { table: 'llm_call_logs', desc: '模型调用日志' },
  relay_alert_events: { table: 'relay_alert_events', desc: '告警事件流' },
  relay_prompt_audit_hits: { table: 'relay_prompt_audit_hits', desc: '提示词审计命中' },
  key_rate_window_counts: { table: 'key_rate_window_counts', desc: 'Key 限流窗口计数' },
  backup_jobs: { table: 'backup_jobs', desc: '备份作业记录' },
}

interface CountRow extends Record<string, unknown> {
  n?: number
}
interface StatsRow extends Record<string, unknown> {
  n?: number
  oldest?: string | null
}

/** 兼容 pg QueryResult({rows}) 与 neon-http RowList(数组)两种返回形态。 */
function firstRow<T extends Record<string, unknown>>(r: unknown): T | undefined {
  if (Array.isArray(r)) return r[0] as T | undefined
  const withRows = r as { rows?: T[] }
  return withRows.rows?.[0]
}

const cleanupSchema = z.object({
  table: z.string().refine((v) => v in CLEANABLE, 'table 不在可清理白名单'),
  keepDays: z.coerce.number().int().min(1).max(3650),
  // F-162:z.coerce.boolean() 把字符串 "false"/"0" 解析为 true ⇒ dryRun 误判、真实清理被当预览。
  // 改用严格布尔 schema(白名单解析,非法值失败),缺省视为 false。
  dryRun: booleanStringSchemaOptional.default(false),
})

const adminRelayDataManagementRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 各表统计(行数 + 最老记录时间)
  server.get('/relay/data-management/stats', async (request, reply) => {
    try {
      const tables = await Promise.all(
        Object.entries(CLEANABLE).map(async ([key, meta]) => {
          try {
            const result = await dbRead.execute(
              sql`SELECT count(*)::int AS n, to_char(min(created_at) AT TIME ZONE 'Asia/Shanghai', 'YYYY-MM-DD HH24:MI') AS oldest FROM ${sql.identifier(meta.table)}`,
            )
            const row = firstRow<StatsRow>(result)
            return {
              table: key,
              desc: meta.desc,
              rows: Number(row?.n ?? 0),
              oldest: row?.oldest ?? null,
            }
          } catch {
            return { table: key, desc: meta.desc, rows: -1, oldest: null }
          }
        }),
      )
      return reply.send(success({ tables, generatedAt: new Date().toISOString() }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询数据统计失败'))
    }
  })

  // 2. 按表+保留天数清理(dryRun 预览;单批上限 50000 行)
  server.post('/relay/data-management/cleanup', async (request, reply) => {
    const parsed = cleanupSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    const { table, keepDays, dryRun } = parsed.data
    const meta = CLEANABLE[table]
    if (!meta) return reply.status(400).send(error(400, 'table 不在可清理白名单'))
    try {
      const countResult = await dbRead.execute(
        sql`SELECT count(*)::int AS n FROM ${sql.identifier(meta.table)} WHERE created_at < now() - (${keepDays} || ' days')::interval`,
      )
      const wouldDelete = Number(firstRow<CountRow>(countResult)?.n ?? 0)
      if (dryRun || wouldDelete === 0) {
        return reply.send(success({ table, keepDays, wouldDelete, deleted: 0, dryRun }))
      }
      // F-162:原 SQL 为全表条件 DELETE(无 LIMIT),大表长事务、锁表与 WAL 膨胀,且不可回滚地一次删光历史。
      // 改为按 ctid 分批 DELETE(LIMIT 单批上限),循环到本批删空为止——单次请求最多删 BATCH 行,
      // 避免一次长事务锁表;超量可再次调用(与注释「单批上限 50000」自述对齐)。
      const BATCH = 50_000
      let deleted = 0
      for (;;) {
        const delResult = await db.execute(
          sql`WITH del AS (DELETE FROM ${sql.identifier(meta.table)} WHERE ctid IN (SELECT ctid FROM ${sql.identifier(meta.table)} WHERE created_at < now() - (${keepDays} || ' days')::interval LIMIT ${BATCH}) RETURNING 1) SELECT count(*)::int AS n FROM del`,
        )
        const batchDeleted = Number(firstRow<CountRow>(delResult)?.n ?? 0)
        deleted += batchDeleted
        if (batchDeleted < BATCH) break // 本批删空(不足 BATCH 行)⇒ 已无可清理行,退出
      }
      // F-162:日志模板原样未插值(审计恒为空),补齐占位符取值
      request.log.warn(`[data-management] 清理完成 table=${meta.table} keepDays=${keepDays} deleted=${deleted}`)
      return reply.send(success({ table, keepDays, wouldDelete, deleted, dryRun: false }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '清理失败'))
    }
  })
}

export default adminRelayDataManagementRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
