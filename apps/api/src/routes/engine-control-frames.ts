// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 引擎控制帧代理(2026-11-06 立)。
 *
 * 控制帧 `get_context_usage` / `stop_task` / `seed_read_state` 的实现在 ai-service
 * 的引擎 JSON-RPC(`POST /api/engine/rpc`);Web/桌面/移动端只认主 API 基址,
 * 本层把同一组方法透传到 AI_SERVICE_URL,鉴权与 ai-service 保持同一会话语义。
 *
 * **方法白名单,不是任意 RPC 转发**:
 *   - thread.contextUsage  → get_context_usage
 *   - thread.interrupt     → stop_task
 *   - thread.seedReadState → seed_read_state
 * 不在白名单的方法一律 400,不把网关变成 ai-service 的通用代理(§0.9 最小面)。
 *
 * 失败形态可区分:方法非法 ⇒ 400(本层);上游非 2xx ⇒ 如实透出状态码 + 上游 error;
 * 连不上 ai-service ⇒ 502。JSON-RPC 层错误(HTTP 200 + error 包络)原样回传,
 * 由客户端按 error.code/message 判定 —— 本层不改写引擎语义。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../utils/response.js'
import { authenticate } from '../plugins/auth.js'
import { aiServiceFetch } from '../utils/ai-service-fetch.js'

const ALLOWED_ENGINE_METHODS = new Set([
  'thread.contextUsage',
  'thread.interrupt',
  'thread.seedReadState',
])

const engineControlFrameRoutes: FastifyPluginAsync = async (server) => {
  server.post('/engine/rpc', async (request, reply) => {
    await authenticate(request)
    const body = request.body
    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      return reply.status(400).send(error(400, '请求体须为 JSON-RPC 对象'))
    }
    const method = (body as { method?: unknown }).method
    if (typeof method !== 'string' || !ALLOWED_ENGINE_METHODS.has(method)) {
      return reply.status(400).send(error(400, `不允许的引擎方法: ${String(method)}`))
    }
    try {
      const resp = await aiServiceFetch(request, '/api/engine/rpc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const raw = await resp.text()
      let payload: unknown = raw
      try {
        payload = JSON.parse(raw)
      } catch {
        // 保留原始 text
      }
      if (!resp.ok) {
        const detail =
          payload !== null && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error: unknown }).error)
            : null
        return reply
          .status(resp.status)
          .send(error(resp.status, detail ?? `引擎调用失败: ${method}`))
      }
      return reply.send(success(payload))
    } catch (e) {
      request.log.error(e)
      return reply.status(502).send(error(502, '引擎服务暂不可用'))
    }
  })
}

export default engineControlFrameRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
