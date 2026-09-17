// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import {
  PLUGIN_TYPES,
  installPlugin,
  setPluginStatus,
  setPluginConfig,
  deletePlugin,
  listPlugins,
  getPlugin,
  validatePluginConfig,
  type PluginType,
} from '../../services/relay-plugins-service.js'

/**
 * /api/admin/relay/plugins 插件系统(2026-09-17 立,补强 59,对标竞品 /plugins)。
 *
 * 端点(requireAdmin):
 * 1. GET    /relay/plugins?status=       — 插件列表(status=enabled|disabled 过滤)
 * 2. POST   /relay/plugins               — 安装/覆盖(pluginKey 唯一,覆盖保留启停状态)
 * 3. POST   /relay/plugins/:id/enable    — 启用
 * 4. POST   /relay/plugins/:id/disable   — 停用
 * 5. PUT    /relay/plugins/:id/config    — 更新配置(按类型 schema 校验)
 * 6. DELETE /relay/plugins/:id           — 删除
 * 7. POST   /relay/plugins/validate      — 配置校验(不落库,供前端表单即时校验)
 *
 * 安全边界:声明式插件,零任意代码执行;plugin_type 必须是服务层已注册类型。
 */

const idParamSchema = z.object({ id: z.string().uuid('无效的 ID') })

const listQuerySchema = z.object({
  status: z.enum(['enabled', 'disabled']).optional(),
})

const installBodySchema = z.object({
  pluginKey: z.string().min(1).max(64),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  pluginType: z.enum(PLUGIN_TYPES),
  config: z.unknown(),
  priority: z.number().int().min(0).max(10000).optional(),
})

const configBodySchema = z.object({ config: z.unknown() })

const validateBodySchema = z.object({
  pluginType: z.enum(PLUGIN_TYPES),
  config: z.unknown(),
})

const adminRelayPluginsRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 7. 配置校验(必须先于 /:id 路由注册,避免被通配吃掉)
  server.post('/relay/plugins/validate', async (request, reply) => {
    const b = validateBodySchema.safeParse(request.body ?? {})
    if (!b.success) return reply.status(400).send(error(400, '参数不合法'))
    const r = validatePluginConfig(b.data.pluginType, b.data.config)
    return r.ok
      ? reply.send(success({ valid: true }))
      : reply.send(success({ valid: false, error: r.error }))
  })

  // 1. 插件列表
  server.get('/relay/plugins', async (request, reply) => {
    const q = listQuerySchema.safeParse(request.query ?? {})
    if (!q.success) return reply.status(400).send(error(400, '参数不合法'))
    const list = await listPlugins(q.data.status)
    return reply.send(success({ list, total: list.length }))
  })

  // 1b. 插件详情(单查;前端删除按钮的调用点行会被路由守门推断为 GET 详情,顺带补齐真实端点)
  server.get('/relay/plugins/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    const plugin = await getPlugin(p.data.id)
    if (!plugin) return reply.status(404).send(error(404, '插件不存在'))
    return reply.send(success({ plugin }))
  })

  // 2. 安装/覆盖
  server.post('/relay/plugins', async (request, reply) => {
    const b = installBodySchema.safeParse(request.body ?? {})
    if (!b.success)
      return reply.status(400).send(error(400, b.error.issues[0]?.message ?? '参数不合法'))
    try {
      const r = await installPlugin(
        { ...b.data, pluginType: b.data.pluginType as PluginType },
        request.userId!,
      )
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ plugin: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '安装插件失败'))
    }
  })

  // 3/4. 启用/停用
  // 3/4. 启用/停用(显式路由:参数段 :status 无法与前端字面段路由比对匹配)
  server.post('/relay/plugins/:id/enable', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    try {
      const r = await setPluginStatus(p.data.id, 'enabled')
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ plugin: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '启用插件失败'))
    }
  })

  server.post('/relay/plugins/:id/disable', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    try {
      const r = await setPluginStatus(p.data.id, 'disabled')
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ plugin: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '停用插件失败'))
    }
  })

  // 5. 更新配置
  server.put('/relay/plugins/:id/config', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    const b = configBodySchema.safeParse(request.body ?? {})
    if (!p.success || !b.success) return reply.status(400).send(error(400, '参数不合法'))
    try {
      const r = await setPluginConfig(p.data.id, b.data.config)
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ plugin: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '更新插件配置失败'))
    }
  })

  // 6. 删除
  server.delete('/relay/plugins/:id', async (request, reply) => {
    const p = idParamSchema.safeParse(request.params)
    if (!p.success) return reply.status(400).send(error(400, '参数不合法'))
    try {
      const r = await deletePlugin(p.data.id)
      if (!r.success) return reply.status(400).send(error(400, r.reason))
      return reply.send(success({ plugin: r.data }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除插件失败'))
    }
  })
}

export default adminRelayPluginsRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
