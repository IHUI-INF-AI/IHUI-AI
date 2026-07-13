import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { requireAdmin } from '../plugins/require-permission.js'
import { authenticate } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import {
  createTranscodeJob,
  startTranscodeJob,
  getTranscodeJob,
  listTranscodeJobs,
  cancelTranscodeJob,
  deleteTranscodeJob,
  isFfmpegAvailable,
  type TranscodePreset,
} from '../services/transcode-service.js'

// =============================================================================
// Zod schemas
// =============================================================================

const createJobBodySchema = z.object({
  inputPath: z.string().min(1).max(1024),
  preset: z.enum(['video/mp4', 'video/hls', 'video/webm', 'audio/mp3', 'audio/aac', 'thumbnail']),
  outputName: z.string().min(1).max(200).optional(),
  resolution: z.enum(['480p', '720p', '1080p', '1440p', '2160p']).optional(),
  /** 是否立即开始转码，默认 true */
  autoStart: z.boolean().optional().default(true),
})

const jobIdParamSchema = z.object({ jobId: z.string().min(1) })

// =============================================================================
// 用户端路由（创建任务 + 查询自己的任务 + 下载）
// =============================================================================

export const transcodeRoutes: FastifyPluginAsync = async (server) => {
  // GET /transcode/health - 检查 ffmpeg 可用性
  server.get('/transcode/health', async (_request, reply) => {
    const available = await isFfmpegAvailable()
    return reply.send(success({ ffmpegAvailable: available }))
  })

  // POST /transcode/jobs - 创建转码任务
  server.post('/transcode/jobs', async (request, reply) => {
    await authenticate(request)
    const parsed = createJobBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { inputPath, preset, outputName, resolution, autoStart } = parsed.data
    try {
      const job = await createTranscodeJob({
        inputPath,
        preset: preset as TranscodePreset,
        outputName,
        resolution,
      })
      if (autoStart) {
        // 异步启动，不阻塞响应
        startTranscodeJob(job.id).catch((e) => {
          job.status = 'failed'
          job.error = (e as Error).message
        })
      }
      return reply.status(201).send(success({ job }))
    } catch (e) {
      return reply.status(400).send(error(400, (e as Error).message))
    }
  })

  // GET /transcode/jobs/:jobId - 查询任务状态
  server.get('/transcode/jobs/:jobId', async (request, reply) => {
    await authenticate(request)
    const { jobId } = jobIdParamSchema.parse(request.params)
    const job = getTranscodeJob(jobId)
    if (!job) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ job }))
  })

  // GET /transcode/jobs/:jobId/download - 下载转码结果
  server.get('/transcode/jobs/:jobId/download', async (request, reply) => {
    await authenticate(request)
    const { jobId } = jobIdParamSchema.parse(request.params)
    const job = getTranscodeJob(jobId)
    if (!job) return reply.status(404).send(error(404, '任务不存在'))
    if (job.status !== 'completed') {
      return reply.status(400).send(error(400, `任务未完成，当前状态: ${job.status}`))
    }
    try {
      const stats = await stat(job.outputPath)
      const filename = basename(job.outputPath)
      const stream = createReadStream(job.outputPath)
      return reply
        .header('Content-Type', 'application/octet-stream')
        .header('Content-Length', stats.size)
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(stream)
    } catch {
      return reply.status(404).send(error(404, '输出文件不存在'))
    }
  })

  // POST /transcode/jobs/:jobId/cancel - 取消任务
  server.post('/transcode/jobs/:jobId/cancel', async (request, reply) => {
    await authenticate(request)
    const { jobId } = jobIdParamSchema.parse(request.params)
    const job = await cancelTranscodeJob(jobId)
    if (!job) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ job }))
  })
}

// =============================================================================
// 管理员路由（任务列表 + 删除）
// =============================================================================

export const adminTranscodeRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // GET /transcode/jobs - 列出所有任务
  server.get('/transcode/jobs', async (_request, reply) => {
    const jobs = listTranscodeJobs()
    return reply.send(success({ jobs, total: jobs.length }))
  })

  // DELETE /transcode/jobs/:jobId - 删除任务（含输出文件）
  server.delete('/transcode/jobs/:jobId', async (request, reply) => {
    const { jobId } = jobIdParamSchema.parse(request.params)
    const deleted = await deleteTranscodeJob(jobId)
    if (!deleted) return reply.status(404).send(error(404, '任务不存在'))
    return reply.send(success({ deleted: true }))
  })
}
