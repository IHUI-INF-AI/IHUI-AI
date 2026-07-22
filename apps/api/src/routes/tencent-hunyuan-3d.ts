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
 *  - 签名: TC3-HMAC-SHA256 (接入 services/vendor-auth-strategies.ts 的 TencentTc3AuthStrategy, 真实调用腾讯云 SubmitHunyuanTo3DJob)
 */
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { generateTrackingId } from '../utils/crypto-random.js'

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

// ==================== Tencent QueryHunyuanTo3DJob helper ====================

/**
 * 腾讯云 QueryHunyuanTo3DJob 响应类型 (字段均为可选, 腾讯不同状态返回字段不同)。
 * 与 submit 端点的响应字段对称 (JobId/Status/ErrorMsg), 额外含 ResultFile3Ds。
 */
interface TencentQueryResponse {
  JobId?: string
  Status?: string
  ResultFile3Ds?: unknown
  ErrorMsg?: string
  RequestId?: string
  [key: string]: unknown
}

/**
 * 调用腾讯云 QueryHunyuanTo3DJob 查询任务状态。
 *
 * 守卫 (跳过腾讯调用):
 *  - 未配置 TENCENT_SECRET_ID/KEY → 返回 null
 *  - JobId 以 `stub_` 开头 → 返回 null (本地 stub, 腾讯不认识)
 *
 * 降级 (失败时返回 null, 由 caller 降级到 DB+内存查询):
 *  - 任何失败 (网络/签名/超时/JSON 解析等) → 返回 null
 *
 * 响应解包:
 *  - 腾讯云响应通常包裹在 `Response` 字段中, 取 `raw.Response ?? raw`
 */
async function queryTencentJob(jobId: string): Promise<TencentQueryResponse | null> {
  const hasTencentConfig = Boolean(process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY)
  if (!hasTencentConfig) return null
  if (jobId.startsWith('stub-')) return null

  try {
    const { authStrategyFactory } = await import('../services/vendor-auth-strategies.js')
    const strategy = authStrategyFactory.getStrategy('tencent_tc3')
    const requestBody = { JobId: jobId }
    const authResult = strategy.buildHeaders(
      {
        // hasTencentConfig 已校验存在,此处 ?? '' 仅满足 TS 类型(运行时不会触发空值)
        key: process.env.TENCENT_SECRET_ID ?? '',
        secret: process.env.TENCENT_SECRET_KEY ?? '',
      },
      {
        method: 'POST',
        url: 'https://ai3d.tencentcloudapi.com/',
        body: requestBody,
        config: {
          service: 'ai3d',
          host: 'ai3d.tencentcloudapi.com',
          version: '2025-05-13',
          region: 'ap-guangzhou',
          action: 'QueryHunyuanTo3DJob',
        },
      },
    )
    const tencentRes = await fetch('https://ai3d.tencentcloudapi.com/', {
      method: 'POST',
      headers: authResult.headers,
      body: authResult.body,
    })
    const raw = (await tencentRes.json()) as TencentQueryResponse & {
      Response?: TencentQueryResponse
    }
    // 腾讯云响应通常包裹在 Response 字段中, 取 Response ?? raw
    return raw.Response ?? raw
  } catch {
    // 腾讯调用失败 (网络/签名/超时/JSON 解析等), 降级到 DB+内存查询
    return null
  }
}

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
      // 2026-07-21 安全审计加固:用 CSPRNG 替换 Math.random 生成任务 ID
      // 风险:Math.random 可预测 → 攻击者可枚举其他用户的 3D 任务 ID
      const jobIdStub = generateTrackingId('stub')
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

      // 真实调用腾讯云 SubmitHunyuanTo3DJob (TC3-HMAC-SHA256 签名)
      // 失败时降级到 stub JobId, 不阻塞端点
      let tencentResponse: { JobId?: string; Status?: string; ErrorMsg?: string } | null = null
      let finalJobId: string = jobIdStub
      if (hasTencentConfig) {
        try {
          const { authStrategyFactory } = await import('../services/vendor-auth-strategies.js')
          const strategy = authStrategyFactory.getStrategy('tencent_tc3')
          // 剥离 user_uuid (非腾讯 API 字段), 仅传腾讯 API 规范字段
          const tencentRequestBody = {
            Prompt: parsed.data.Prompt,
            ImageBase64: parsed.data.ImageBase64,
            ImageUrl: parsed.data.ImageUrl,
            MultiViewImages: parsed.data.MultiViewImages,
            ResultFormat: parsed.data.ResultFormat,
            EnablePBR: parsed.data.EnablePBR,
          }
          const authResult = strategy.buildHeaders(
            {
              // hasTencentConfig 已校验存在,此处 ?? '' 仅满足 TS 类型(运行时不会触发空值)
              key: process.env.TENCENT_SECRET_ID ?? '',
              secret: process.env.TENCENT_SECRET_KEY ?? '',
            },
            {
              method: 'POST',
              url: 'https://ai3d.tencentcloudapi.com/',
              body: tencentRequestBody,
              config: {
                service: 'ai3d',
                host: 'ai3d.tencentcloudapi.com',
                version: '2025-05-13',
                region: 'ap-guangzhou',
                action: 'SubmitHunyuanTo3DJob',
              },
            },
          )
          const tencentRes = await fetch('https://ai3d.tencentcloudapi.com/', {
            method: 'POST',
            headers: authResult.headers,
            body: authResult.body,
          })
          tencentResponse = (await tencentRes.json()) as {
            JobId?: string
            Status?: string
            ErrorMsg?: string
          }
          // 腾讯返回真实 JobId 时, 用真实 JobId 替换 stub
          if (tencentResponse?.JobId) {
            const stubEntry = activeJobs.get(jobIdStub)
            if (stubEntry) {
              activeJobs.delete(jobIdStub)
              activeJobs.set(tencentResponse.JobId, {
                ...stubEntry,
                status: tencentResponse.Status ?? 'PENDING',
              })
            }
            finalJobId = tencentResponse.JobId
          }
        } catch {
          // 腾讯调用失败 (网络/签名/超时等), 降级到 stub JobId
          tencentResponse = null
        }
      }

      const message = hasTencentConfig
        ? tencentResponse?.JobId
          ? '已调用腾讯混元 3D API (TC3-HMAC-SHA256 签名 + SubmitHunyuanTo3DJob), 任务已落库'
          : '腾讯混元 3D API 调用失败, 降级 stub。任务已落库 video_generation_tasks。'
        : '调用腾讯混元 3D API 待接入 (未配置 TENCENT_SECRET_ID/KEY), 当前为 stub。任务已落库 video_generation_tasks。'

      return reply.send(
        success({
          stub: !hasTencentConfig || !tencentResponse?.JobId,
          live: hasTencentConfig && !!tencentResponse?.JobId,
          message,
          data: {
            JobId: finalJobId,
            Status: tencentResponse?.Status ?? 'PENDING',
            ResultFormat: parsed.data.ResultFormat,
            EnablePBR: parsed.data.EnablePBR,
            user_uuid: parsed.data.user_uuid,
            persistedTaskId,
            persistence: persistedTaskId ? 'video_generation_tasks' : 'memory_only',
            tencentConfig: hasTencentConfig,
            tencent_response: tencentResponse,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 2. POST /tencent/hunyuan3d/query — 真实查 video_generation_tasks + 腾讯 QueryHunyuanTo3DJob (R81)
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

      // R81: hasTencentConfig=true 且 JobId 非 stub 时, 真实调用腾讯 QueryHunyuanTo3DJob
      // 失败时 queryTencentJob 返回 null, 降级到 DB+内存查询
      const tencentResponse = await queryTencentJob(parsed.data.JobId)
      // 腾讯返回时, 用腾讯的 Status/ResultFile3Ds/ErrorMsg 覆盖 DB/内存状态
      const status =
        tencentResponse?.Status ??
        (dbTask?.status as string | undefined) ??
        job?.status ??
        'UNKNOWN'
      const resultFile3Ds = tencentResponse?.ResultFile3Ds ?? []
      const errorMsg = tencentResponse?.ErrorMsg ?? ''

      const hasTencentConfig = Boolean(
        process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY,
      )
      const isStubJobId = parsed.data.JobId.startsWith('stub-')
      const tencentAttempted = hasTencentConfig && !isStubJobId

      return reply.send(
        success({
          stub: !dbTask && !job && !tencentResponse,
          live: Boolean(dbTask || job || tencentResponse),
          message: tencentResponse
            ? '已调用腾讯 QueryHunyuanTo3DJob, 状态以腾讯返回为准'
            : dbTask
              ? '已从 video_generation_tasks 查询任务状态'
              : job
                ? '已从内存 activeJobs 查询任务状态(任务未落库)'
                : tencentAttempted
                  ? '腾讯 QueryHunyuanTo3DJob 调用失败, 降级到 DB+内存查询(均无记录)'
                  : '未配置腾讯凭证或 JobId 为 stub, 仅查 DB+内存(均无记录)',
          data: {
            JobId: parsed.data.JobId,
            Status: status,
            ResultFile3Ds: resultFile3Ds,
            ErrorMsg: errorMsg,
            dbTask,
            memoryJob: job ?? null,
            tencent_response: tencentResponse,
          },
        }),
      )
    } catch (e) {
      return reply.status(500).send(error(500, (e as Error).message))
    }
  })

  // 3. GET /tencent/hunyuan3d/job/:job_id — 真实查 video_generation_tasks + 腾讯 QueryHunyuanTo3DJob (R81)
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

      // R81: 与 query 端点对称, 用 job_id 路径参数作为 JobId 真实调用腾讯 QueryHunyuanTo3DJob
      // 失败时 queryTencentJob 返回 null, 降级到 DB+内存查询
      const tencentResponse = await queryTencentJob(job_id)
      // 腾讯返回时, 用腾讯的 Status/ResultFile3Ds/ErrorMsg 覆盖 DB/内存状态
      const status =
        tencentResponse?.Status ??
        (dbTask?.status as string | undefined) ??
        job?.status ??
        'UNKNOWN'
      const resultFile3Ds = tencentResponse?.ResultFile3Ds ?? []
      const errorMsg = tencentResponse?.ErrorMsg ?? ''

      const hasTencentConfig = Boolean(
        process.env.TENCENT_SECRET_ID && process.env.TENCENT_SECRET_KEY,
      )
      const isStubJobId = job_id.startsWith('stub_')
      const tencentAttempted = hasTencentConfig && !isStubJobId

      return reply.send(
        success({
          stub: !dbTask && !job && !tencentResponse,
          live: Boolean(dbTask || job || tencentResponse),
          message: tencentResponse
            ? '已调用腾讯 QueryHunyuanTo3DJob, 状态以腾讯返回为准'
            : dbTask
              ? '已从 video_generation_tasks 查询任务状态'
              : job
                ? '已从内存 activeJobs 查询任务状态(任务未落库)'
                : tencentAttempted
                  ? '腾讯 QueryHunyuanTo3DJob 调用失败, 降级到 DB+内存查询(均无记录)'
                  : '未配置腾讯凭证或 JobId 为 stub, 仅查 DB+内存(均无记录)',
          data: {
            JobId: job_id,
            Status: status,
            ResultFile3Ds: resultFile3Ds,
            ErrorMsg: errorMsg,
            dbTask,
            memoryJob: job ?? null,
            tencent_response: tencentResponse,
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
