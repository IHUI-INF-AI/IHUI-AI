/**
 * MCP /mcp/*(3 个端点)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../../utils/response.js'
import { config } from '../../config/index.js'
import { findMcpServers, findMcpServerById } from '../../db/mcp-queries.js'
import { createAnalyticsEvent } from '../../db/analytics-queries.js'
import { parsePagination, parseIdParam } from './_shared.js'

const mcpRoutes: FastifyPluginAsync = async (server) => {
  server.get('/mcp', async (request, reply) => {
    const q = parsePagination(request, reply)
    if (!q) return
    const result = await findMcpServers({
      page: q.page,
      pageSize: q.pageSize,
      search: q.search,
    })
    return reply.send(
      success({ list: result.list, total: result.total, page: q.page, pageSize: q.pageSize }),
    )
  })

  server.get('/mcp/:id', async (request, reply) => {
    const id = parseIdParam(request, reply)
    if (id === null) return
    const mcp = await findMcpServerById(id)
    if (!mcp) return reply.status(404).send(error(404, 'MCP 服务不存在'))
    return reply.send(success({ mcp }))
  })

  server.post('/mcp/invoke', async (request, reply) => {
    const body =
      (request.body as {
        serverId?: string
        projectId?: string
        tool?: string
        toolName?: string
        args?: unknown
      } | null) ?? {}
    const serverId = body.serverId ?? body.projectId
    const toolName = body.tool ?? body.toolName
    if (!serverId) return reply.status(400).send(error(400, '缺少 serverId'))
    if (!toolName) return reply.status(400).send(error(400, '缺少 toolName'))

    await createAnalyticsEvent({
      userId: request.userId,
      event: 'mcp_invoke',
      properties: { serverId, tool: toolName, args: body.args },
      ip: request.ip,
      userAgent: (request.headers['user-agent'] as string | undefined) ?? null,
    })

    try {
      const resp = await fetch(`${config.AI_SERVICE_URL}/api/mcp/tools/call`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.headers.authorization
            ? { Authorization: request.headers.authorization }
            : {}),
        },
        body: JSON.stringify({ name: toolName, arguments: body.args ?? {} }),
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        return reply
          .status(502)
          .send(error(502, `MCP 服务调用失败: ${resp.status} ${text.slice(0, 200)}`))
      }
      const data = await resp.json().catch(() => ({}))
      return reply.send(success({ result: data }))
    } catch (e) {
      const msg = (e as Error).name === 'AbortError' ? '请求超时' : (e as Error).message
      return reply.status(502).send(error(502, `MCP 服务不可用: ${msg}`))
    }
  })
}

export default mcpRoutes
