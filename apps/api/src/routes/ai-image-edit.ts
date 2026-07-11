import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql, eq, desc, and } from 'drizzle-orm'
import { db } from '../db/index.js'
import { zhsUserAgentImage } from '@ihui/database'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'

// =============================================================================
// 通用工具
// =============================================================================

/** 带超时的 fetch,默认 60s（图片生成耗时较长）。 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = 60_000,
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

function parsePaging(q: { page?: string; pageSize?: string }): { page: number; pageSize: number } {
  const page = Math.max(1, Math.floor(Number(q.page) || 1))
  const pageSize = Math.min(100, Math.max(1, Math.floor(Number(q.pageSize) || 20)))
  return { page, pageSize }
}

// =============================================================================
// Zod schemas
// =============================================================================

const idParamSchema = z.object({ id: z.string().min(1) })

const doubaoEditSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  prompt: z.string().min(1, '编辑指令不能为空').max(2000),
  model: z.string().max(100).optional(),
  strength: z.number().min(0).max(1).optional(),
  size: z.string().max(32).optional(),
})

const doubaoInpaintSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  maskUrl: z.string().min(1, '蒙版图片地址不能为空'),
  prompt: z.string().min(1, '修复指令不能为空').max(2000),
  model: z.string().max(100).optional(),
})

const tongyiEditSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  prompt: z.string().min(1, '编辑指令不能为空').max(2000),
  model: z.string().max(100).optional(),
  n: z.number().int().min(1).max(4).optional(),
  size: z.string().max(32).optional(),
})

const tongyiTextToImageSchema = z.object({
  prompt: z.string().min(1, '提示词不能为空').max(2000),
  negativePrompt: z.string().max(1000).optional(),
  model: z.string().max(100).optional(),
  n: z.number().int().min(1).max(4).optional(),
  size: z.string().max(32).optional(),
  steps: z.number().int().min(1).max(100).optional(),
  seed: z.number().int().optional(),
})

const tongyiImageToImageSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  prompt: z.string().min(1, '编辑指令不能为空').max(2000),
  model: z.string().max(100).optional(),
  strength: z.number().min(0).max(1).optional(),
  n: z.number().int().min(1).max(4).optional(),
  size: z.string().max(32).optional(),
})

const tongyiStyleTransferSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  styleRefUrl: z.string().min(1, '风格参考图地址不能为空'),
  model: z.string().max(100).optional(),
})

const tongyiBackgroundGenerationSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空'),
  prompt: z.string().max(2000).optional(),
  model: z.string().max(100).optional(),
})

const tongyiVirtualTryOnSchema = z.object({
  personImageUrl: z.string().min(1, '人物图片地址不能为空'),
  topGarmentUrl: z.string().max(500).optional(),
  bottomGarmentUrl: z.string().max(500).optional(),
  model: z.string().max(100).optional(),
})

const userAgentImageCreateSchema = z.object({
  imageUrl: z.string().min(1, '图片地址不能为空').max(500),
  imageType: z.enum(['input', 'output']).default('input'),
  agentId: z.string().max(64).optional(),
  agentName: z.string().max(200).optional(),
  prompt: z.string().max(5000).optional(),
  model: z.string().max(50).optional(),
  taskId: z.string().max(100).optional(),
  status: z.number().int().min(0).max(2).default(1),
  cost: z.number().int().min(0).default(0),
  width: z.number().int().min(0).default(0),
  height: z.number().int().min(0).default(0),
  size: z.number().int().min(0).default(0),
})

const userAgentImageListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  imageType: z.enum(['input', 'output']).optional(),
  agentId: z.string().max(64).optional(),
})

/** 保存编辑历史到数据库。 */
async function saveHistory(opts: {
  userId: string
  vendor: string
  action: string
  inputImageUrl: string | null
  outputImageUrl: string | null
  prompt: string
  model: string | null
  status: string
  rawData: unknown
}): Promise<string> {
  try {
    const rows = await db.execute(
      sql`INSERT INTO ai_image_edit_history
          (user_id, vendor, action, input_image_url, output_image_url, prompt, model, status, raw_data, created_at, updated_at)
          VALUES (${opts.userId}, ${opts.vendor}, ${opts.action}, ${opts.inputImageUrl},
                  ${opts.outputImageUrl}, ${opts.prompt}, ${opts.model}, ${opts.status},
                  ${JSON.stringify(opts.rawData)}, NOW(), NOW())
          RETURNING id`,
    )
    return ((rows as Record<string, unknown>[])[0]?.id as string) ?? ''
  } catch {
    return ''
  }
}

// =============================================================================
// 路由
// =============================================================================

export const aiImageEditRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /ai-image/doubao/edit - 豆包图片编辑
  // -------------------------------------------------------------------------
  server.post('/ai-image/doubao/edit', async (request, reply) => {
    await authenticate(request)
    const parsed = doubaoEditSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, prompt, model, strength, size } = parsed.data
    const apiKey = process.env.DOUBAO_API_KEY
    const useModel = model ?? 'doubao-image-edit-2.0'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '豆包图片编辑服务未配置（需设置 DOUBAO_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout('https://ark.cn-beijing.volces.com/api/v3/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useModel,
          image: imageUrl,
          prompt,
          strength: strength ?? 0.5,
          size: size ?? '1024x1024',
        }),
      })

      if (!resp.ok) {
        return reply.status(502).send(error(502, '豆包图片编辑服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      const outputImageUrl = (result.data as { url?: string }[])?.[0]?.url ?? ''
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'doubao',
        action: 'edit',
        inputImageUrl: imageUrl,
        outputImageUrl,
        prompt,
        model: useModel,
        status: 'success',
        rawData: result,
      })
      return reply.send(
        success({
          imageUrl: outputImageUrl,
          prompt,
          model: useModel,
          status: 'success',
          historyId,
          raw: result,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '豆包图片编辑失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/doubao/inpaint - 豆包图片修复
  // -------------------------------------------------------------------------
  server.post('/ai-image/doubao/inpaint', async (request, reply) => {
    await authenticate(request)
    const parsed = doubaoInpaintSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, maskUrl, prompt, model } = parsed.data
    const apiKey = process.env.DOUBAO_API_KEY
    const useModel = model ?? 'doubao-image-edit-2.0'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '豆包图片修复服务未配置（需设置 DOUBAO_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout('https://ark.cn-beijing.volces.com/api/v3/images/edits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: useModel,
          image: imageUrl,
          mask: maskUrl,
          prompt,
        }),
      })

      if (!resp.ok) {
        return reply.status(502).send(error(502, '豆包图片修复服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      const outputImageUrl = (result.data as { url?: string }[])?.[0]?.url ?? ''
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'doubao',
        action: 'inpaint',
        inputImageUrl: imageUrl,
        outputImageUrl,
        prompt,
        model: useModel,
        status: 'success',
        rawData: result,
      })
      return reply.send(
        success({
          imageUrl: outputImageUrl,
          prompt,
          model: useModel,
          status: 'success',
          historyId,
          raw: result,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '豆包图片修复失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/edit - 通义图片编辑
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/edit', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiEditSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, prompt, model, n, size } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-v1'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义图片编辑服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: {
              image_url: imageUrl,
              prompt,
            },
            parameters: {
              n: n ?? 1,
              size: size ?? '1024*1024',
            },
          }),
        },
      )

      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义图片编辑服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      const outputImages = ((result.output as { images?: { url?: string }[] })?.images ?? []).map(
        (img) => img.url ?? '',
      )
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'edit',
        inputImageUrl: imageUrl,
        outputImageUrl: outputImages[0] ?? '',
        prompt,
        model: useModel,
        status: 'success',
        rawData: result,
      })
      return reply.send(
        success({
          images: outputImages,
          prompt,
          model: useModel,
          status: 'success',
          historyId,
          raw: result,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义图片编辑失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/text-to-image - 通义文生图
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/text-to-image', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiTextToImageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { prompt, negativePrompt, model, n, size, steps, seed } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-v1'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义文生图服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: {
              prompt,
              negative_prompt: negativePrompt,
            },
            parameters: {
              n: n ?? 1,
              size: size ?? '1024*1024',
              steps: steps ?? 20,
              seed: seed,
            },
          }),
        },
      )

      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义文生图服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      const taskId = (result.output as { task_id?: string })?.task_id
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'text-to-image',
        inputImageUrl: null,
        outputImageUrl: null,
        prompt,
        model: useModel,
        status: 'pending',
        rawData: result,
      })
      return reply.send(
        success({
          taskId,
          prompt,
          model: useModel,
          status: 'pending',
          historyId,
          raw: result,
          message: '任务已提交,请通过 taskId 轮询查询结果',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义文生图失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/image-to-image - 通义图生图
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/image-to-image', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiImageToImageSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, prompt, model, strength, n, size } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-v1'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义图生图服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: {
              image_url: imageUrl,
              prompt,
            },
            parameters: {
              n: n ?? 1,
              size: size ?? '1024*1024',
              strength: strength ?? 0.5,
            },
          }),
        },
      )

      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义图生图服务调用失败'))
      }

      const result = (await resp.json()) as Record<string, unknown>
      const taskId = (result.output as { task_id?: string })?.task_id
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'image-to-image',
        inputImageUrl: imageUrl,
        outputImageUrl: null,
        prompt,
        model: useModel,
        status: 'pending',
        rawData: result,
      })
      return reply.send(
        success({
          taskId,
          prompt,
          model: useModel,
          status: 'pending',
          historyId,
          raw: result,
          message: '任务已提交,请通过 taskId 轮询查询结果',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义图生图失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/history - 编辑历史列表
  // -------------------------------------------------------------------------
  server.get('/ai-image/history', async (request, reply) => {
    await authenticate(request)
    const q = request.query as {
      page?: string
      pageSize?: string
      vendor?: string
      action?: string
      status?: string
    }
    const { page, pageSize } = parsePaging(q)
    const offset = (page - 1) * pageSize
    const conds = [sql`"user_id" = ${request.userId!}`]
    if (q.vendor) conds.push(sql`"vendor" = ${q.vendor}`)
    if (q.action) conds.push(sql`"action" = ${q.action}`)
    if (q.status) conds.push(sql`"status" = ${q.status}`)
    const where = sql`WHERE ${sql.join(conds, sql` AND `)}`
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, vendor, action, input_image_url, output_image_url,
                   prompt, model, status, created_at, updated_at
            FROM ai_image_edit_history
            ${where}
            ORDER BY "created_at" DESC
            LIMIT ${pageSize} OFFSET ${offset}`,
      )
      const countRows = await db.execute(
        sql`SELECT count(*)::int AS count FROM ai_image_edit_history ${where}`,
      )
      const total = (countRows[0] as { count?: number } | undefined)?.count ?? 0
      return reply.send(
        success({
          list: rows as Record<string, unknown>[],
          total,
          page,
          pageSize,
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询编辑历史失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/history/:id - 编辑详情
  // -------------------------------------------------------------------------
  server.get('/ai-image/history/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db.execute(
        sql`SELECT id, user_id, vendor, action, input_image_url, output_image_url,
                   prompt, model, status, raw_data, created_at, updated_at
            FROM ai_image_edit_history
            WHERE "id"::text = ${id} AND "user_id" = ${request.userId!}
            LIMIT 1`,
      )
      const row = (rows as Record<string, unknown>[])[0]
      if (!row) return reply.status(404).send(error(404, '编辑历史不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询编辑详情失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /ai-image/history/:id - 删除历史
  // -------------------------------------------------------------------------
  server.delete('/ai-image/history/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = idParamSchema.safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db.execute(
        sql`DELETE FROM ai_image_edit_history
            WHERE "id"::text = ${id} AND "user_id" = ${request.userId!}
            RETURNING id`,
      )
      if ((rows as Record<string, unknown>[]).length === 0) {
        return reply.status(404).send(error(404, '编辑历史不存在'))
      }
      return reply.send(success({ id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除编辑历史失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/doubao/models - 豆包可用模型列表
  // -------------------------------------------------------------------------
  server.get('/ai-image/doubao/models', async (request, reply) => {
    await authenticate(request)
    return reply.send(
      success([
        {
          id: 'doubao-seededit-3-0-i2i-250628',
          name: '豆包SeedEdit 3.0 (图生图)',
          type: 'image-edit',
        },
        {
          id: 'doubao-seedream-3-0-t2i-250415',
          name: '豆包SeeDream 3.0 (文生图)',
          type: 'image-generate',
        },
        {
          id: 'doubao-image-edit-2.0',
          name: '豆包图像编辑 2.0',
          type: 'image-edit',
        },
        { id: 'doubao-pro', name: '豆包Pro', type: 'chat' },
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/tongyi/models - 通义可用模型列表
  // -------------------------------------------------------------------------
  server.get('/ai-image/tongyi/models', async (request, reply) => {
    await authenticate(request)
    return reply.send(
      success([
        { id: 'qwen-image', name: '通义千问文生图', type: 'text-to-image' },
        { id: 'qwen-image-edit', name: '通义千问图编辑', type: 'image-edit' },
        { id: 'wanx-v1', name: '通义万相v1', type: 'text-to-image' },
        {
          id: 'wanx2.1-t2i-turbo',
          name: '通义万相2.1加速版',
          type: 'text-to-image',
        },
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/tongyi/image2image/models - 通义图生图可用模型列表
  // -------------------------------------------------------------------------
  server.get('/ai-image/tongyi/image2image/models', async (request, reply) => {
    await authenticate(request)
    return reply.send(
      success([
        {
          id: 'wanx2.1-imageedit',
          name: '通义万相2.1图编辑',
          type: 'image-to-image',
        },
        {
          id: 'wanx-style-transfer',
          name: '通义风格迁移',
          type: 'style-transfer',
        },
        {
          id: 'wanx-background-generation-v2',
          name: '通义背景生成v2',
          type: 'background',
        },
        {
          id: 'wanx-virtual-try-on-v1',
          name: '通义虚拟试衣v1',
          type: 'virtual-try-on',
        },
      ]),
    )
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/style-transfer - 通义风格迁移
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/style-transfer', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiStyleTransferSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, styleRefUrl, model } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-style-transfer'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义风格迁移服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/style-transfer',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: {
              image_url: imageUrl,
              style_ref_url: styleRefUrl,
            },
          }),
        },
      )
      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义风格迁移服务调用失败'))
      }
      const result = (await resp.json()) as Record<string, unknown>
      const taskId = (result.output as { task_id?: string })?.task_id
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'style-transfer',
        inputImageUrl: imageUrl,
        outputImageUrl: null,
        prompt: `style-ref: ${styleRefUrl}`,
        model: useModel,
        status: 'pending',
        rawData: result,
      })
      return reply.send(
        success({
          taskId,
          model: useModel,
          status: 'pending',
          historyId,
          raw: result,
          message: '任务已提交,请通过 taskId 轮询查询结果',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义风格迁移失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/background-generation - 通义背景生成
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/background-generation', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiBackgroundGenerationSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { imageUrl, prompt, model } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-background-generation-v2'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义背景生成服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/background-generation',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: {
              image_url: imageUrl,
              prompt: prompt ?? '',
            },
          }),
        },
      )
      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义背景生成服务调用失败'))
      }
      const result = (await resp.json()) as Record<string, unknown>
      const taskId = (result.output as { task_id?: string })?.task_id
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'background-generation',
        inputImageUrl: imageUrl,
        outputImageUrl: null,
        prompt: prompt ?? '',
        model: useModel,
        status: 'pending',
        rawData: result,
      })
      return reply.send(
        success({
          taskId,
          model: useModel,
          status: 'pending',
          historyId,
          raw: result,
          message: '任务已提交,请通过 taskId 轮询查询结果',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义背景生成失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/tongyi/virtual-try-on - 通义虚拟试衣
  // -------------------------------------------------------------------------
  server.post('/ai-image/tongyi/virtual-try-on', async (request, reply) => {
    await authenticate(request)
    const parsed = tongyiVirtualTryOnSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { personImageUrl, topGarmentUrl, bottomGarmentUrl, model } = parsed.data
    const apiKey = process.env.DASHSCOPE_API_KEY
    const useModel = model ?? 'wanx-virtual-try-on-v1'

    if (!apiKey) {
      return reply
        .status(503)
        .send(error(503, '通义虚拟试衣服务未配置（需设置 DASHSCOPE_API_KEY 环境变量）'))
    }

    try {
      const inputData: Record<string, string> = { person_image_url: personImageUrl }
      if (topGarmentUrl) inputData.top_garment_url = topGarmentUrl
      if (bottomGarmentUrl) inputData.bottom_garment_url = bottomGarmentUrl

      const resp = await fetchWithTimeout(
        'https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/virtual-try-on',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
            'X-DashScope-Async': 'enable',
          },
          body: JSON.stringify({
            model: useModel,
            input: inputData,
          }),
        },
      )
      if (!resp.ok) {
        return reply.status(502).send(error(502, '通义虚拟试衣服务调用失败'))
      }
      const result = (await resp.json()) as Record<string, unknown>
      const taskId = (result.output as { task_id?: string })?.task_id
      const historyId = await saveHistory({
        userId: request.userId!,
        vendor: 'tongyi',
        action: 'virtual-try-on',
        inputImageUrl: personImageUrl,
        outputImageUrl: null,
        prompt: `top: ${topGarmentUrl ?? ''}; bottom: ${bottomGarmentUrl ?? ''}`,
        model: useModel,
        status: 'pending',
        rawData: result,
      })
      return reply.send(
        success({
          taskId,
          model: useModel,
          status: 'pending',
          historyId,
          raw: result,
          message: '任务已提交,请通过 taskId 轮询查询结果',
        }),
      )
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '通义虚拟试衣失败'))
    }
  })

  // -------------------------------------------------------------------------
  // POST /ai-image/user-agent - 记录用户图片交互
  // -------------------------------------------------------------------------
  server.post('/ai-image/user-agent', async (request, reply) => {
    await authenticate(request)
    const parsed = userAgentImageCreateSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const {
      imageUrl,
      imageType,
      agentId,
      agentName,
      prompt,
      model,
      taskId,
      status,
      cost,
      width,
      height,
      size,
    } = parsed.data
    try {
      const [inserted] = await db
        .insert(zhsUserAgentImage)
        .values({
          userUuid: request.userId!,
          userId: request.userId,
          userName: '匿名用户',
          agentId: agentId ?? null,
          agentName: agentName ?? null,
          imageUrl,
          imageType,
          prompt: prompt ?? null,
          model: model ?? null,
          taskId: taskId ?? null,
          status,
          cost,
          width: width,
          height: height,
          size: size,
        })
        .returning({ id: zhsUserAgentImage.id })
      if (!inserted) {
        return reply.status(500).send(error(500, '记录图片交互失败'))
      }
      return reply.send(success({ id: inserted.id }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '记录图片交互失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/user-agent/list - 用户图片交互列表
  // -------------------------------------------------------------------------
  server.get('/ai-image/user-agent/list', async (request, reply) => {
    await authenticate(request)
    const parsed = userAgentImageListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { page, pageSize, imageType, agentId } = parsed.data
    const offset = (page - 1) * pageSize
    const conds = [eq(zhsUserAgentImage.userUuid, request.userId!)]
    if (imageType) conds.push(eq(zhsUserAgentImage.imageType, imageType))
    if (agentId) conds.push(eq(zhsUserAgentImage.agentId, agentId))
    try {
      const items = await db
        .select({
          id: zhsUserAgentImage.id,
          imageUrl: zhsUserAgentImage.imageUrl,
          imageType: zhsUserAgentImage.imageType,
          agentId: zhsUserAgentImage.agentId,
          agentName: zhsUserAgentImage.agentName,
          prompt: zhsUserAgentImage.prompt,
          model: zhsUserAgentImage.model,
          taskId: zhsUserAgentImage.taskId,
          status: zhsUserAgentImage.status,
          cost: zhsUserAgentImage.cost,
          width: zhsUserAgentImage.width,
          height: zhsUserAgentImage.height,
          size: zhsUserAgentImage.size,
          createTime: zhsUserAgentImage.createTime,
        })
        .from(zhsUserAgentImage)
        .where(and(...conds))
        .orderBy(desc(zhsUserAgentImage.id))
        .limit(pageSize)
        .offset(offset)
      const countRows = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(zhsUserAgentImage)
        .where(and(...conds))
      const total = countRows[0]?.count ?? 0
      return reply.send(success({ list: items, total, page, pageSize }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询图片交互列表失败'))
    }
  })

  // -------------------------------------------------------------------------
  // GET /ai-image/user-agent/:id - 图片交互详情
  // -------------------------------------------------------------------------
  server.get('/ai-image/user-agent/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object({ id: z.coerce.number().int().min(1) }).safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db
        .select()
        .from(zhsUserAgentImage)
        .where(eq(zhsUserAgentImage.id, id))
        .limit(1)
      const row = rows[0]
      if (!row) return reply.status(404).send(error(404, '图片记录不存在'))
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询图片交互详情失败'))
    }
  })

  // -------------------------------------------------------------------------
  // DELETE /ai-image/user-agent/:id - 删除图片交互记录
  // -------------------------------------------------------------------------
  server.delete('/ai-image/user-agent/:id', async (request, reply) => {
    await authenticate(request)
    const parsed = z.object({ id: z.coerce.number().int().min(1) }).safeParse(request.params)
    if (!parsed.success) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const { id } = parsed.data
    try {
      const rows = await db
        .delete(zhsUserAgentImage)
        .where(and(eq(zhsUserAgentImage.id, id), eq(zhsUserAgentImage.userUuid, request.userId!)))
        .returning({ id: zhsUserAgentImage.id })
      if (rows.length === 0) {
        return reply.status(404).send(error(404, '图片记录不存在或无权删除'))
      }
      return reply.send(success({ id, deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除图片交互记录失败'))
    }
  })
}
