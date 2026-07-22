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

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error, parseOrThrow } from '../utils/response.js'

/** ai-service 基础 URL(默认 http://localhost:3003) */
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:3003'

const screenshotSchema = z.object({
  url: z.string().url('Invalid URL'),
  width: z.number().int().min(320).max(3840).optional().default(1280),
  height: z.number().int().min(240).max(2160).optional().default(720),
  fullPage: z.boolean().optional().default(false),
  waitUntil: z.enum(['none', 'dom', 'load', 'networkidle']).optional().default('load'),
  timeout: z.number().int().min(1000).max(60000).optional().default(15000),
})

const probeSchema = z.object({
  url: z.string().url('Invalid URL'),
})

export const browserRoutes: FastifyPluginAsync = async (server) => {
  // -------------------------------------------------------------------------
  // POST /screenshot - 对指定 URL 截图(转发到 ai-service)
  // -------------------------------------------------------------------------
  server.post('/screenshot', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
    const req = parseOrThrow(screenshotSchema, request.body)

    try {
      const resp = await fetch(`${AI_SERVICE_URL}/api/screenshot/take`, {
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
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status} ${text.slice(0, 200)}`))
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
        return reply.send(error(500, json.message || '截图失败'))
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
      const resp = await fetch(`${AI_SERVICE_URL}/api/screenshot/probe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: req.url }),
      })

      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply.status(502).send(error(502, `ai-service 调用失败: ${resp.status} ${text.slice(0, 200)}`))
      }

      const json = (await resp.json()) as {
        code: number
        message: string
        data: { url: string; can_embed: boolean } | null
      }

      if (json.code !== 0 || !json.data) {
        return reply.send(error(500, json.message || '探测失败'))
      }

      return reply.send(success({ url: json.data.url, canEmbed: json.data.can_embed }))
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return reply.status(502).send(error(502, `ai-service 连接失败: ${msg.slice(0, 200)}`))
    }
  })
}
