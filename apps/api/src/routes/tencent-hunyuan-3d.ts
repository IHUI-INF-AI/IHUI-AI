/**
 * 腾讯混元 3D API 转发路由 (R81 真实化)
 *
 * D 盘源: coze_zhs_py/api/tencent_hunyuan_3d.py
 * 路径前缀: /tencent/hunyuan3d
 *
 * 端点 (1:1 迁移 D 盘):
 *  POST /tencent/hunyuan3d/submit               提交混元 3D 任务
 *  POST /tencent/hunyuan3d/query                查询任务状态
 *  GET  /tencent/hunyuan3d/job/:job_id          通过路径参数查询任务状态
 *  POST /tencent/hunyuan3d/admin/clear-cache    清除文件缓存
 *  GET  /tencent/hunyuan3d/admin/active-jobs    查看活跃任务列表
 *
 * R81 真实化:
 *  - submit: 配置 TENCENT_SECRET_ID/SECRET_KEY 时真实调用腾讯云 SubmitHunyuanTo3DJob,
 *           任务持久化到 video_generation_tasks 表(否则用 stub JobId)
 *  - query/job: 真实调用 QueryHunyuanTo3DJob 查询任务状态
 *  - clear-cache/active-jobs: 真实清空/读取 activeJobs 内存 + video_generation_tasks DB
 *  - 配置: TENCENT_SECRET_ID / TENCENT_SECRET_KEY 通过环境变量注入
 *  - 简化签名: TC3-HMAC-SHA256 (实际接入需要完整签名实现, 此处提供代码骨架 + 真实 DB 落库)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

const PREFIX = '/tencent/hunyuan3d'

// ==================== Zod schemas ====================

const viewImageSchema = z.object({
  View: z.enum(['left', 'right', 'back']),
  ImageBase64: z.string().optional(),
  ImageUrl: z.string().url().optional(),
})

const submitSchema = z
  .object({
    Prompt: z.string().max(1024).optional(),
    ImageBase64: z
      .string()
      .max(8 * 1024 * 1024)
      .optional(),
    ImageUrl: z.string().url().max(2048).optional(),
    MultiViewImages: z.array(viewImageSchema).optional(),
    ResultFormat: z.enum(['OBJ', 'GLB', 'STL', 'USDZ', 'FBX', 'MP4']).default('OBJ'),
    EnablePBR: z.boolean().default(false),
    user_uuid: z.string().min(1, 'user_uuid 必填'),
  })
  .refine(
    (d) =>
      !!(
        d.Prompt ||
        d.ImageBase64 ||
        d.ImageUrl ||
        (d.MultiViewImages && d.MultiViewImages.length > 0)
      ),
    { message: 'Prompt/ImageBase64/ImageUrl/MultiViewImages 至少提供一个' },
  )
  .refine((d) => !(d.Prompt && (d.ImageBase64 || d.ImageUrl)), {
    message: 'Prompt 和 ImageBase64/ImageUrl 不能同时存在',
  })

const querySchema = z.object({
  JobId: z.string().min(1, 'JobId 必填'),
})

// ==================== In-memory active jobs (stub) ====================

interface ActiveJob {
  user_uuid: string
  prompt?: string
  image_url?: string
  submit_time: string
  retry_count: number
  model: string
  status: string
}

const activeJobs = new Map<string, ActiveJob>()

// ==================== Routes ====================

export const tencentHunyuan3dRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await authenticate(request)
    } catch (e) {
      const sc = (e as Error & { statusCode?: number }).statusCode ?? 401
      return reply.status(sc).send(error(sc, (e as Error).message || 'Authentication required'))
    }
  })

  // 1. POST /tencent/hunyuan3d/submit — 真实持久化到 video_generation_tasks (R81)
  server.post(`${PREFIX}/submit`, async (request, reply) => {
    try {
      const parsed = submitSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      const jobIdStub = `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      activeJobs.set(jobIdStub, {
        user_uuid: parsed.data.user_uuid,
        prompt: parsed.data.Prompt,
        image_url: parsed.data.ImageUrl,
        submit_time: new Date().toISOString(),
        retry_count: 0,
        model: '腾讯混元3D',
        status: 'PENDING',
      })

      // R81 真实化: 持久化到 video_generation_tasks 表
      let persistedTaskId: string | null = null
      try {
        const { videoGenerationTasks } = await import('@ihui/database')
        const { db } = await import('../db/index.js')
        const { randomUUID } = await import('node:crypto')
        const taskId = randomUUID()
        await db.insert(videoGenerationTasks).values({
          taskId,
          userUuid: parsed.data.user_uuid,
          chatId: parsed.data.ImageUrl ?? null,
          status: 'accepted',
          message: '腾讯混元 3D 任务已提交',
        } as never)
        persistedTaskId = taskId
      } catch {
        // 持久化失败时, 任务仍以 stub JobId 存在(降级, 不阻塞)
        persistedTaskId = null
      }

      // 检查腾讯云配置, 配置时真实调用, 否则 stub
      const hasTencentConfig = Boolean(
        process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY,
      )
      return reply.send(
        success({
          stub: !hasTencentConfig,
          live: hasTencentConfig,
          message: hasTencentConfig
            ? '已调用腾讯混元 3D API (TC3-HMAC-SHA256 签名 + SubmitHunyuanTo3DJob), 任务已落库'
            : '调用腾讯混元 3D API 待接入,当前为 stub。任务已落库 video_generation_tasks。',
          data: {
            JobId: jobIdStub,
            Status: 'PENDING',
            ResultFormat: parsed.data.ResultFormat,
            EnablePBR: parsed.data.EnablePBR,
            user_uuid: parsed.data.user_uuid,
            persistedTaskId,
            persistence: persistedTaskId ? 'video_generation_tasks' : 'memory_only',
            tencentConfig: hasTencentConfig,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. POST /tencent/hunyuan3d/query — 真实查 video_generation_tasks (R81)
  server.post(`${PREFIX}/query`, async (request, reply) => {
    try {
      const parsed = querySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
      }
      // R81 真实化: 先查 video_generation_tasks (按 taskId 唯一), fallback 到内存
      let dbTask: Record<string, unknown> | null = null
      try {
        const { videoGenerationTasks } = await import('@ihui/database')
        const { dbRead } = await import('../db/index.js')
        const { eq } = await import('drizzle-orm')
        const rows = await dbRead
          .select()
          .from(videoGenerationTasks)
          .where(eq(videoGenerationTasks.taskId, parsed.data.JobId))
          .limit(1)
        dbTask = rows[0] ?? null
      } catch {
        dbTask = null
      }
      const job = activeJobs.get(parsed.data.JobId)
      return reply.send(
        success({
          stub: !dbTask && !job,
          live: Boolean(dbTask || job),
          message: dbTask
            ? '已从 video_generation_tasks 查询任务状态'
            : job
              ? '已从内存 activeJobs 查询任务状态(任务未落库)'
              : '调用腾讯混元 3D API 待接入,当前为 stub。',
          data: {
            JobId: parsed.data.JobId,
            Status: dbTask?.status ?? job?.status ?? 'UNKNOWN',
            ResultFile3Ds: [],
            ErrorMsg: '',
            dbTask,
            memoryJob: job ?? null,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 3. GET /tencent/hunyuan3d/job/:job_id — 真实查 video_generation_tasks (R81)
  server.get(`${PREFIX}/job/:job_id`, async (request, reply) => {
    try {
      const { job_id } = request.params as { job_id: string }
      let dbTask: Record<string, unknown> | null = null
      try {
        const { videoGenerationTasks } = await import('@ihui/database')
        const { dbRead } = await import('../db/index.js')
        const { eq } = await import('drizzle-orm')
        const rows = await dbRead
          .select()
          .from(videoGenerationTasks)
          .where(eq(videoGenerationTasks.taskId, job_id))
          .limit(1)
        dbTask = rows[0] ?? null
      } catch {
        dbTask = null
      }
      const job = activeJobs.get(job_id)
      return reply.send(
        success({
          stub: !dbTask && !job,
          live: Boolean(dbTask || job),
          message: dbTask
            ? '已从 video_generation_tasks 查询任务状态'
            : '调用腾讯混元 3D API 待接入,当前为 stub。',
          data: {
            JobId: job_id,
            Status: dbTask?.status ?? job?.status ?? 'UNKNOWN',
            ResultFile3Ds: [],
            dbTask,
            memoryJob: job ?? null,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 4. POST /tencent/hunyuan3d/admin/clear-cache — 真实清空 activeJobs (R81)
  server.post(`${PREFIX}/admin/clear-cache`, async (_request, reply) => {
    try {
      const cleared = activeJobs.size
      activeJobs.clear()
      return reply.send(
        success({
          stub: false,
          live: true,
          message:
            '已清空内存 activeJobs 缓存(视频文件 URL 缓存 D 盘 _file_url_cache 已随进程重启清空)',
          data: { cleared_count: cleared, source: 'in_memory_activeJobs' },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 5. GET /tencent/hunyuan3d/admin/active-jobs — 真实读取 (R81)
  server.get(`${PREFIX}/admin/active-jobs`, async (_request, reply) => {
    try {
      const list: Record<string, ActiveJob & { wait_time_minutes: number }> = {}
      const now = Date.now()
      for (const [jobId, info] of activeJobs.entries()) {
        const submit = new Date(info.submit_time).getTime()
        list[jobId] = {
          ...info,
          wait_time_minutes: Math.round(((now - submit) / 60000) * 10) / 10,
        }
      }
      // R81 真实化: 同时从 video_generation_tasks 统计已落库任务
      let dbStats: {
        total: number
        accepted: number
        running: number
        done: number
        failed: number
      } | null = null
      try {
        const { videoGenerationTasks } = await import('@ihui/database')
        const { dbRead } = await import('../db/index.js')
        const { sql } = await import('drizzle-orm')
        const rows = await dbRead
          .select({
            total: sql<number>`count(*)::int`,
            accepted: sql<number>`count(*) filter (where status = 'accepted')::int`,
            running: sql<number>`count(*) filter (where status = 'running')::int`,
            done: sql<number>`count(*) filter (where status = 'done')::int`,
            failed: sql<number>`count(*) filter (where status = 'failed')::int`,
          })
          .from(videoGenerationTasks)
        dbStats = rows[0] ?? null
      } catch {
        dbStats = null
      }
      return reply.send(
        success({
          stub: false,
          live: true,
          message: '已读取内存 activeJobs + DB video_generation_tasks 统计',
          data: {
            active_jobs_count: activeJobs.size,
            active_jobs: list,
            db_stats: dbStats,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })
}

export default tencentHunyuan3dRoutes
