// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { requireAdmin } from '../../plugins/require-permission.js'
import {
  listUserAttributes,
  setUserAttribute,
  deleteUserAttribute,
  findUserIdsByAttribute,
  validateAttrKey,
  validateAttrValue,
} from '../../services/relay-user-attributes-service.js'

/**
 * /api/admin/relay/user-attributes 用户自定义属性(2026-09-17 立,补强 55)。
 *
 * 端点(requireAdmin):
 * 1. GET    /relay/user-attributes/:userId        — 某用户的全部属性
 * 2. PUT    /relay/user-attributes/:userId/:key   — 设置(覆盖)某个属性
 * 3. DELETE /relay/user-attributes/:userId/:key   — 删除某个属性
 * 4. GET    /relay/user-attributes/find?key=&value= — 按属性值反查 userId(运营筛选)
 *
 * key 约束 [a-z0-9_] 1-64 位;value 1-255 位。
 */
const keySchema = z.string().regex(/^[a-z0-9_]{1,64}$/, 'key 仅允许小写字母/数字/下划线,1-64 位')

const valueSchema = z.string().min(1).max(255)

const setValueBodySchema = z.object({ value: valueSchema })

const adminRelayUserAttributesRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  // 4. 反查(必须优先注册,避免被 /:userId 通配吃掉)
  server.get('/relay/user-attributes/find', async (request, reply) => {
    const q = z
      .object({
        key: keySchema,
        value: valueSchema,
        limit: z.coerce.number().int().min(1).max(1000).optional(),
      })
      .safeParse(request.query ?? {})
    if (!q.success) {
      return reply.status(400).send(error(400, q.error.issues[0]?.message ?? '参数不合法'))
    }
    try {
      const userIds = await findUserIdsByAttribute(q.data.key, q.data.value, q.data.limit ?? 200)
      return reply.send(success({ userIds, total: userIds.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询用户属性失败'))
    }
  })

  // 1. 列出用户属性
  server.get('/relay/user-attributes/:userId', async (request, reply) => {
    const p = request.params as { userId?: string }
    if (!p.userId) return reply.status(400).send(error(400, 'userId 必填'))
    try {
      const attrs = await listUserAttributes(p.userId)
      return reply.send(success({ attrs, total: attrs.length }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '查询用户属性失败'))
    }
  })

  // 2. 设置属性(覆盖写)
  server.put('/relay/user-attributes/:userId/:key', async (request, reply) => {
    const p = request.params as { userId?: string; key?: string }
    if (!p.userId || !p.key) return reply.status(400).send(error(400, 'userId 与 key 必填'))
    if (!validateAttrKey(p.key))
      return reply.status(400).send(error(400, 'key 仅允许小写字母/数字/下划线'))
    const parsed = setValueBodySchema.safeParse(request.body ?? {})
    if (!parsed.success || !validateAttrValue(parsed.data?.value ?? '')) {
      return reply.status(400).send(error(400, 'value 必填且不超过 255 字符'))
    }
    try {
      const row = await setUserAttribute({
        userId: p.userId,
        key: p.key,
        value: parsed.data.value,
        updatedBy: 'admin',
      })
      return reply.send(success(row))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '设置用户属性失败'))
    }
  })

  // 3. 删除属性
  server.delete('/relay/user-attributes/:userId/:key', async (request, reply) => {
    const p = request.params as { userId?: string; key?: string }
    if (!p.userId || !p.key) return reply.status(400).send(error(400, 'userId 与 key 必填'))
    try {
      const okDeleted = await deleteUserAttribute(p.userId, p.key)
      if (!okDeleted) return reply.status(404).send(error(404, '属性不存在'))
      return reply.send(success({ deleted: true }))
    } catch (e) {
      request.log.error(e)
      return reply.status(500).send(error(500, '删除用户属性失败'))
    }
  })
}

export default adminRelayUserAttributesRoutes
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
