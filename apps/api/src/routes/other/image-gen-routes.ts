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
import { callVendor, recordUsage, VENDORS } from '../ai-vendors/_shared.js'

/** Agnes 图像端点支持的尺寸档(1K/2K/3K/4K);其余形态(如 1024x1024)不透传,避免上游 400。 */
const AGNES_SIZE_TIERS = new Set(['1K', '2K', '3K', '4K'])

/** 从 OpenAI images 协议响应里取可渲染地址:优先 data[0].url,次选 b64_json 转 data URL。 */
function pickGeneratedImageUrl(raw: unknown): string | undefined {
  const first = (raw as { data?: Array<{ url?: string; b64_json?: string }> } | null)?.data?.[0]
  const url = typeof first?.url === 'string' ? first.url.trim() : ''
  if (url) return url
  const b64 = typeof first?.b64_json === 'string' ? first.b64_json.trim() : ''
  if (b64) return `data:image/png;base64,${b64}`
  return undefined
}

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
  //    并接住 size、imageUrl、model 三个透传键。
  // ② **响应侧同错的一半**:两端各自声明 GenResult{imageUrl} 并直接取 data.imageUrl。曾经
  //    回 success({item}),端上拿到 undefined 当成功用(渲染空图 / 保存失败)。现在恒定回
  //    可渲染的 imageUrl。
  // ③ **出图能力已接通(2026-11-21)**:无现成 imageUrl 的请求会真调 Agnes
  //    /v1/images/generations(当前唯一无需新凭据即可出图的通道,见 ai-vendors/_shared.ts 的
  //    VENDORS.agnes);上游失败回 502,不伪造地址。此前的 503 CAPABILITY_UNAVAILABLE
  //    "未接通"档已撤销 —— 现在只剩"上游真失败"这一种 5xx。
  server.post('/image-gen/generate', async (request, reply) => {
    const body = z
      .object({
        content: z.string().min(1).max(5000).optional(),
        agentId: z.string().max(64).optional(),
        // 两端现发形态与透传键(size 仅透传,不参与判据)。空串按缺位处理,
        // 以免 "content:''" 顶掉非空 prompt 或产出无文案的生成记录。
        prompt: z.string().max(5000).optional(),
        size: z.string().max(32).optional(),
        imageUrl: z.string().max(2048).optional(),
        // 选择器里选中的图像模型(2026-11-21 接通出图链路时新增);
        // 缺位走 agnes 默认档,非 agnes-image 家族一律回落到默认,不把对话模型名送去画图。
        model: z.string().max(96).optional(),
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
    const explicitImageUrl = body.data.imageUrl?.trim()

    // 出图链路(2026-11-21 接通):没给现成 imageUrl ⇒ 真调到 Agnes /v1/images/generations。
    // 现状唯一无需新 key 就能出图的通道就是 agnes(provider 健康 ok,keyEnv=AGNES_API_KEY);
    // 其余厂商要新配凭据,未接通前不静默回落。失败一律显式 5xx,绝不伪造 imageUrl 冒充成功。
    // 显式点名了非 agnes 的图像模型 ⇒ 明确 400,不静默用 agnes 顶替(否则用户以为出的是自己选的模型)。
    let imageUrl = explicitImageUrl
    if (!imageUrl) {
      const requestedModel = body.data.model?.trim() ?? ''
      if (requestedModel && !requestedModel.startsWith('agnes-image-')) {
        return reply
          .status(400)
          .send(
            error(
              400,
              `图像模型「${requestedModel}」当前没有接通的生成通道;可用: agnes-image-2.5-flash / agnes-image-2.1-flash`,
            ),
          )
      }
      const model = requestedModel || 'agnes-image-2.5-flash'
      const size = body.data.size?.trim()
      const payload = {
        model,
        prompt: content,
        ...(size && AGNES_SIZE_TIERS.has(size) ? { size } : {}),
      }
      const raw = await callVendor(
        'agnes',
        `${VENDORS.agnes!.baseUrl}/images/generations`,
        reply,
        { method: 'POST', body: JSON.stringify(payload) },
        90_000,
      )
      if (raw === null) return
      const upstreamError = (raw as { error?: { message?: string } | string }).error
      if (upstreamError) {
        const msg =
          typeof upstreamError === 'string'
            ? upstreamError
            : upstreamError.message || JSON.stringify(upstreamError)
        return reply.status(502).send(error(502, `图像生成失败: ${msg.slice(0, 300)}`))
      }
      const generated = pickGeneratedImageUrl(raw)
      if (!generated) {
        return reply.status(502).send(error(502, '图像生成失败: 上游未返回可渲染的图片地址'))
      }
      imageUrl = generated
      recordUsage(request.userId!, 'agnes')
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
