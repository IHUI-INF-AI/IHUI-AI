import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { requireAdmin } from '../plugins/require-permission.js'
import { success, error } from '../utils/response.js'
import {
  listCanaryConfigs,
  createCanary,
  getCanaryPercentage,
  type CanaryConfig,
} from '../services/canary-service.js'

const createSchema = z.object({
  name: z.string().min(1).max(100),
  percentage: z.number().int().min(0).max(100).default(1),
  target: z.string().max(200).optional(),
})

function mapToGrayRule(
  config: CanaryConfig & { id?: string; target?: string | null; status?: string },
) {
  const stage = config.currentStage ?? 'off'
  return {
    id: config.name,
    name: config.name,
    percentage: getCanaryPercentage(stage),
    target: (config as { target?: string | null }).target ?? null,
    isEnabled: config.isActive,
    currentStage: stage,
    status: (config as { status?: string }).status ?? 'active',
  }
}

export const adminGrayReleaseRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /gray-release — 灰度规则列表
  server.get('/gray-release', async (_request, reply) => {
    const configs = await listCanaryConfigs()
    const list = configs.map((c) =>
      mapToGrayRule(c as CanaryConfig & { id?: string; target?: string | null; status?: string }),
    )
    return reply.send(success({ list }))
  })

  // POST /gray-release — 创建灰度规则
  server.post('/gray-release', async (request, reply) => {
    const parsed = createSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { name, percentage, target } = parsed.data
    try {
      const stage =
        percentage >= 100
          ? 'full'
          : percentage >= 25
            ? 'canary_25pct'
            : percentage >= 5
              ? 'canary_5pct'
              : 'canary_1pct'
      const config = await createCanary(name, stage as 'full', 5, 30)
      if (target) {
        await db.execute(sql`UPDATE canary_configs SET target = ${target} WHERE name = ${name}`)
      }
      return reply.send(
        success(
          mapToGrayRule(
            config as CanaryConfig & { id?: string; target?: string | null; status?: string },
          ),
        ),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message || '创建失败'))
    }
  })

  // POST /gray-release/:id/toggle — 切换启用状态
  server.post('/gray-release/:id/toggle', async (request, reply) => {
    const { id } = request.params as { id: string }
    try {
      const rows = await db.execute(sql`
        UPDATE canary_configs
        SET is_active = NOT is_active, updated_at = now()
        WHERE name = ${id}
        RETURNING name, current_stage, target_stage, failure_threshold, cooldown_minutes,
                  auto_rollback, status, started_at, last_promoted_at, failure_count,
                  is_active, target
      `)
      const row = rows[0] as Record<string, unknown> | undefined
      if (!row) {
        return reply.status(404).send(error(404, '灰度规则不存在'))
      }
      return reply.send(
        success({
          id: row['name'],
          name: row['name'],
          percentage: getCanaryPercentage(
            row['current_stage'] as 'off' | 'canary_1pct' | 'canary_5pct' | 'canary_25pct' | 'full',
          ),
          target: row['target'] ?? null,
          isEnabled: row['is_active'],
          currentStage: row['current_stage'],
          status: row['status'],
        }),
      )
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message || '操作失败'))
    }
  })
}
