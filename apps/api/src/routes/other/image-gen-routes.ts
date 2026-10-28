// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 图像生成(从 frontend-stub-other-routes.ts 拆分)。
 * GET /image-gen/favorites, GET /image-gen/gallery, GET /image-gen/history,
 * POST /image-gen/generate, GET /image-gen/templates
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { eq, and, desc, sql } from 'drizzle-orm'
import { success, error } from '../../utils/response.js'
import { db, dbRead } from '../../db/index.js'
import { aiGcContent, contentGenerationTemplates, imageGenFavorites } from '@ihui/database'
import { parsePagination } from './_shared.js'

export const imageGenRoutes: FastifyPluginAsync = async (server) => {
  // GET /image-gen/favorites — 当前用户收藏的 AI 生成图片列表
  server.get('/image-gen/favorites', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const [list, totalRows] = await Promise.all([
      dbRead
        .select({
          id: imageGenFavorites.id,
          prompt: imageGenFavorites.prompt,
          imageUrl: imageGenFavorites.imageUrl,
          createdAt: imageGenFavorites.createdAt,
        })
        .from(imageGenFavorites)
        .where(eq(imageGenFavorites.userId, request.userId!))
        .orderBy(desc(imageGenFavorites.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(imageGenFavorites)
        .where(eq(imageGenFavorites.userId, request.userId!)),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /image-gen/gallery — 公开图库(aiGcContent where gcType=image, status=1)
  server.get('/image-gen/gallery', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.gcType, 'image'), eq(aiGcContent.status, 1))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // GET /image-gen/history — 当前用户的图像生成历史
  server.get('/image-gen/history', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const where = and(eq(aiGcContent.userUuid, request.userId!), eq(aiGcContent.gcType, 'image'))
    const [list, totalRows] = await Promise.all([
      dbRead
        .select()
        .from(aiGcContent)
        .where(where)
        .orderBy(desc(aiGcContent.createdAt))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize),
      dbRead
        .select({ count: sql<number>`count(*)::int` })
        .from(aiGcContent)
        .where(where),
    ])
    return reply.send(
      success({ list, total: totalRows[0]?.count ?? 0, page: q.page, pageSize: q.pageSize }),
    )
  })

  // POST /image-gen/generate — 创建图像生成任务
  //
  // 契约收口(2026-10-18 机主拍板「先修契约 + 显式报未接通」,票面原话"两端发 {prompt,size}
  // 而后端只认 {content,agentId} ⇒ 该功能全端 400"):
  // ① **入参兼容两端现发形态**:web 的 image-gen 页与 RN 的 ImageGenCreateScreen 都发
  //    {prompt, size},旧 schema 把 content 定为必填 ⇒ 两端恒 400。现接受 prompt / content
  //    两形态(同给时 content 优先 —— 它是旧契约的权威字段,不让 prompt 顶掉它),
  //    并接住 size 与 imageUrl 两个透传键。**不新增生成能力**(§24):后端仍然只落一条
  //    生成记录,没有任何模型调用被接进来。
  // ② **响应侧同错的一半**:两端各自声明 GenResult{imageUrl} 并直接取 data.imageUrl。旧实现
  //    回 success({item}),端上拿到 undefined 当成功用(渲染空图 / 保存失败)。现在带可渲染
  //    imageUrl 的请求照旧落库并把 imageUrl 一并回该键;不带 imageUrl 的 = 生成链路没接通,
  //    按既有错误码表回 503 + CAPABILITY_UNAVAILABLE(该档语义"此刻没有实例/未就绪、允许退避
  //    重试"，与"未接通"正合;501 CAPABILITY_UNSUPPORTED 语义是"重试永远不可能成功",不适用)。
  //    失败方向刻意是"明确报未接通",绝不伪造 imageUrl 冒充成功。
  server.post('/image-gen/generate', async (request, reply) => {
    const GENERATE_UNREACHED_MESSAGE =
      '图像生成能力未接通：服务端当前仅登记生成记录，尚未接入出图链路'
    const body = z
      .object({
        content: z.string().min(1).max(5000).optional(),
        agentId: z.string().max(64).optional(),
        // 两端现发形态与透传键(size 仅透传,不参与判据)。空串按缺位处理,
        // 以免 "content:''" 顶掉非空 prompt 或产出无文案的生成记录。
        prompt: z.string().max(5000).optional(),
        size: z.string().max(32).optional(),
        imageUrl: z.string().max(2048).optional(),
      })
      .superRefine((d, ctx) => {
        const text = d.content?.trim() || d.prompt?.trim()
        if (!text)
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'content/prompt 至少需要一个非空值',
          })
      })
      .safeParse(request.body)
    if (!body.success)
      return reply.status(400).send(error(400, body.error.issues[0]?.message ?? '参数错误'))
    const content = (body.data.content?.trim() || body.data.prompt!.trim()).slice(0, 5000)
    const imageUrl = body.data.imageUrl?.trim()
    if (!imageUrl) {
      // 未接通 ⇒ 不落库(被拒的请求不得留下半截 aiGcContent 行),
      // message 原文透到端上(fetchApi 对非 2xx 取 body.message 优先),端上不再收到空 toast。
      return reply
        .status(503)
        .send({ ...error(503, GENERATE_UNREACHED_MESSAGE), errorCode: 'CAPABILITY_UNAVAILABLE' })
    }
    const [item] = await db
      .insert(aiGcContent)
      .values({
        userUuid: request.userId!,
        agentId: body.data.agentId ?? null,
        gcType: 'image',
        content,
        status: 1,
      })
      .returning()
    return reply.status(201).send(success({ item, imageUrl }))
  })

  // GET /image-gen/templates — 图像生成模板列表(contentGenerationTemplates)
  server.get('/image-gen/templates', async (_request, reply) => {
    const list = await dbRead
      .select()
      .from(contentGenerationTemplates)
      .where(eq(contentGenerationTemplates.status, 1))
      .orderBy(desc(contentGenerationTemplates.createdAt))
    return reply.send(success({ list }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
