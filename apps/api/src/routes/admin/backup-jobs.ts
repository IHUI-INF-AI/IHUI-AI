// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * /api/admin/backup-jobs 备份作业管理端点(2026-09-16 立,补强 V)。
 *
 * 端点清单(全部 requireAdmin):
 * 1. GET    /backup-jobs                — 作业列表(默认 50)
 * 2. POST   /backup-jobs                — 立即执行备份(body { name })
 * 3. DELETE /backup-jobs/:id            — 删除作业(记录+产物文件,限 backupDir 内)
 * 4. GET    /backup-jobs/settings       — 读单行配置
 * 5. PATCH  /backup-jobs/settings       — 改配置(enabled/cronExpr/keepCount/backupDir),自动重载 cron
 *
 * 注册由主会话接线到 routes/index.ts(prefix /api/admin)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import { idParamSchema } from './_shared.js'
import {
  listBackupJobs,
  runBackupNow,
  deleteBackupJob,
  getBackupSettings,
  updateBackupSettings,
} from '../../services/backup-jobs-service.js'
import { restartBackupCron } from '../../jobs/backup-jobs-cron.js'

const NAME_RE = /^[A-Za-z0-9_-]{1,64}$/

const createBodySchema = z.object({
  name: z.string().regex(NAME_RE, 'name 仅允许字母/数字/下划线/连字符,1-64 位(防注入)'),
})

const settingsPatchSchema = z.object({
  enabled: z.coerce.boolean().optional(),
  cronExpr: z
    .string()
    .max(32)
    .refine((v) => /^[\d*,\-/\s]+$/.test(v), 'cronExpr 含非法字符')
    .optional(),
  keepCount: z.coerce.number().int().min(1).max(365).optional(),
  backupDir: z
    .string()
    .max(500)
    .refine((v) => !v.includes('..'), 'backupDir 非法')
    .optional(),
})

const adminBackupJobsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 1. 作业列表
  server.get('/backup-jobs', async (request, reply) => {
    try {
      const q = z
        .object({ limit: z.coerce.number().int().min(1).max(200).optional() })
        .safeParse(request.query ?? {})
      const limit = q.success ? (q.data.limit ?? 50) : 50
      const list = await listBackupJobs(limit)
      return reply.send(success({ list, total: list.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询备份作业失败'))
    }
  })

  // 2. 立即执行备份
  server.post('/backup-jobs', async (request, reply) => {
    const parsed = createBodySchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const job = await runBackupNow(parsed.data.name, 'manual', 'admin')
      if (!job) return reply.status(500).send(error(500, '备份执行失败(见服务日志)'))
      return reply.send(success(job))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '备份执行失败'))
    }
  })

  // 3. 删除作业(记录+产物)
  server.delete('/backup-jobs/:id', async (request, reply) => {
    const idParsed = idParamSchema.safeParse(request.params)
    if (!idParsed.success) return reply.status(400).send(error(400, '作业 id 不合法'))
    try {
      const r = await deleteBackupJob(idParsed.data.id)
      if (!r.deleted) return reply.status(404).send(error(404, '作业不存在'))
      return reply.send(success(r))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除备份作业失败'))
    }
  })

  // 4. 读配置
  server.get('/backup-jobs/settings', async (request, reply) => {
    try {
      const settings = await getBackupSettings()
      return reply.send(success(settings))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询备份配置失败'))
    }
  })

  // 5. 改配置(自动重载 cron 表达式)
  server.patch('/backup-jobs/settings', async (request, reply) => {
    const parsed = settingsPatchSchema.safeParse(request.body ?? {})
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const settings = await updateBackupSettings(parsed.data)
      await restartBackupCron()
      return reply.send(success(settings))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新备份配置失败'))
    }
  })
}

/** node:path 延迟引用(供 settingsPatchSchema 的 backupDir 校验)。 */
function _unusedPathImport(): void {
  void 0
}
void _unusedPathImport

export default adminBackupJobsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
