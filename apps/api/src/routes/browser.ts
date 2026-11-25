// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 浏览器降级路由(2026-07-22 立,P1 WorkPanel iframe 降级)
 *
 * 设计:
 *  - 前端 iframe 加载失败时,X-Frame-Options 禁止嵌入 → 调本路由
 *  - api 层转发到 ai-service Playwright 截图引擎(端口 8000)
 *  - 返回 { code: 0, message, data: ScreenshotResponse }
 *
 * 端点:
 *  - POST /screenshot   对指定 URL 截图(返回 base64 + 元数据)
 *  - POST /probe        探测 URL 是否可 iframe 嵌入
 */

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error, parseOrThrow } from '../utils/response.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

/**
 * ai-service 基础 URL(默认见 ../constants.ts 的 DEFAULT_AI_SERVICE_URL;
 * 2026-10-21 由 localhost 改 127.0.0.1 —— 本机 localhost 解析优先 IPv6 ::1,
 * 而 ai-service 只听 IPv4)
 */
// AI_SERVICE_URL 局部常量已由 aiServiceFetch(config.AI_SERVICE_URL) 取代(2026-09-13 jwt_auth 鉴权修复)

const screenshotSchema = z.object({
  url: z.url({ error: 'Invalid URL' }),
  width: z.number().int().min(320).max(3840).optional().default(1280),
  height: z.number().int().min(240).max(2160).optional().default(720),
  fullPage: z.boolean().optional().default(false),
  waitUntil: z.enum(['none', 'dom', 'load', 'networkidle']).optional().default('load'),
  timeout: z.number().int().min(1000).max(60000).optional().default(15000),
})

const probeSchema = z.object({
  url: z.url({ error: 'Invalid URL' }),
})

export const browserRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /screenshot - 对指定 URL 截图(转发到 ai-service)
  // -------------------------------------------------------------------------
  server.post('/screenshot', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const req = parseOrThrow(screenshotSchema, request.body)

    try {
      const resp = await aiServiceFetch(request, '/api/screenshot/take', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: req.url,
          width: req.width,
          height: req.height,
          full_page: req.fullPage,
          wait_until: req.waitUntil,
          timeout: req.timeout,
        }),
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `ai-service 调用失败: ${resp.status} ${text.slice(0, 200)}`))
      }

      const json = (await resp.json()) as {
        code: number
        message: string
        data: {
          screenshot: string
          title: string
          url: string
          can_embed: boolean
          captured_at: number
        } | null
      }

      if (json.code !== 0 || !json.data) {
        return reply.status(502).send(error(502, json.message || '截图失败'))
      }

      // 转换为 camelCase 契约(与 packages/types ScreenshotResponse 一致)
      const data = {
        screenshot: json.data.screenshot,
        title: json.data.title,
        url: json.data.url,
        canEmbed: json.data.can_embed,
        capturedAt: json.data.captured_at,
      }
      return reply.send(success(data))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(502).send(error(502, `ai-service 连接失败: ${msg.slice(0, 200)}`))
    }
  })

  // -------------------------------------------------------------------------
  // POST /probe - 探测 URL 是否可 iframe 嵌入(转发到 ai-service)
  // -------------------------------------------------------------------------
  server.post('/probe', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const req = parseOrThrow(probeSchema, request.body)

    try {
      const resp = await aiServiceFetch(request, '/api/screenshot/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: req.url }),
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `ai-service 调用失败: ${resp.status} ${text.slice(0, 200)}`))
      }

      const json = (await resp.json()) as {
        code: number
        message: string
        data: { url: string; can_embed: boolean } | null
      }

      if (json.code !== 0 || !json.data) {
        return reply.status(502).send(error(502, json.message || '探测失败'))
      }

      return reply.send(success({ url: json.data.url, canEmbed: json.data.can_embed }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(502).send(error(502, `ai-service 连接失败: ${msg.slice(0, 200)}`))
    }
  })

  // -------------------------------------------------------------------------
  // /task-templates - 画中画监看模板 CRUD(转发到 ai-service)
  // 2026-11-26:模板接口注册在 ai-service(FastAPI) /api/browser/task-templates,
  // 生产公网 /api/* 由 api-router 直接打到 api-service，不经 Next rewrites；
  // 因此必须在 api-service 这一层补同源转发，否则桌面端编辑器恒 404。
  // -------------------------------------------------------------------------
  server.get('/task-templates', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const resp = await aiServiceFetch(request, '/api/browser/task-templates', { method: 'GET' })
    return forwardTemplateResponse(resp, reply, '模板目录读取失败')
  })

  server.post('/task-templates', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const resp = await aiServiceFetch(request, '/api/browser/task-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body ?? {}),
    })
    return forwardTemplateResponse(resp, reply, '模板保存失败')
  })

  server.delete('/task-templates/:templateId', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const templateId = (request.params as { templateId: string }).templateId
    const resp = await aiServiceFetch(
      request,
      `/api/browser/task-templates/${encodeURIComponent(templateId)}`,
      { method: 'DELETE' },
    )
    return forwardTemplateResponse(resp, reply, '模板删除失败')
  })
}

/**
 * 模板 CRUD 的公共转发出口：ai-service 已经返回 `{code,message,data}` 信封，
 * 成功时原样透传，失败时保留上游状态码与信封，前端 fetchApi 才能拿到同一契约。
 */
async function forwardTemplateResponse(
  resp: Response,
  reply: FastifyReply,
  fallbackMessage: string,
) {
  const json = (await resp.json().catch(() => null)) as Record<string, unknown> | null
  if (!resp.ok) {
    return reply.status(resp.status).send(json ?? error(resp.status, fallbackMessage))
  }
  return reply.send(json ?? error(502, fallbackMessage))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
