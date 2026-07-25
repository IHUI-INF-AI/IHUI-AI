import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'

/**
 * 历史项目缺失端点补齐 — 视频预加载模块(D20)。
 * 从原 legacy-completion.ts 拆分,注册 prefix 为 /api/legacy,完整路径保持不变。
 * - D20: 视频预加载分片管理(/study/video-preload,历史 /study/video-preload)
 */
export const legacyStudyRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // ========== D20: 视频预加载分片管理 (历史 /study/video-preload) ==========
  // 返回视频分片信息供前端预加载,减少首帧等待
  fastify.get('/study/video-preload', async (request, reply) => {
    const parsed = z
      .object({
        videoId: z.coerce.number().int(),
        userId: z.string().optional(),
      })
      .safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'videoId 参数错误' })
    }
    const { videoId, userId } = parsed.data
    // 基于视频 ID 生成 4 个分片(示例实现,实际应由 CDN/转码服务产出)
    const segments = [1, 2, 3, 4].map((idx) => ({
      seq: idx,
      url: `/videos/${videoId}/segment-${idx}.m4s`,
      duration: 10,
      size: 1024 * 1024 * idx,
      preload: idx === 1,
    }))
    return {
      videoId,
      userId: userId ?? null,
      segments,
      policy: {
        preloadCount: 2,
        maxBitrate: '1080p',
        cacheTtl: 3600,
      },
    }
  })
}
