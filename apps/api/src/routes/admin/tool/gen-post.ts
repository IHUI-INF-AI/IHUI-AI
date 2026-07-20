/**
 * /api/admin/tool/gen 路由(POST):根据 type + name + fields 生成代码字符串。
 */
import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../../utils/response.js'
import { generate, GEN_TYPES } from '../../../services/code-generator.js'
import { requireAdmin } from '../../../plugins/require-permission.js'

const fieldSchema = z.object({
  name: z.string().min(1).max(64).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/),
  type: z.enum(['string', 'number', 'boolean', 'date']),
  label: z.string().max(64).optional(),
  required: z.boolean().optional(),
})

const genBodySchema = z.object({
  type: z.enum(GEN_TYPES as [string, ...string[]]),
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/, 'name 必须以字母开头,仅含字母数字下划线短横线'),
  fields: z.array(fieldSchema).min(1).max(20),
  options: z
    .object({
      withSearch: z.boolean().optional(),
      withPagination: z.boolean().optional(),
      withActions: z.boolean().optional(),
    })
    .optional(),
})

const genPostRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', requireAdmin)

  server.post('/tool/gen', async (request, reply) => {
    const parsed = genBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const result = generate({
      type: parsed.data.type as 'list' | 'page' | 'detail' | 'dialog',
      name: parsed.data.name,
      fields: parsed.data.fields,
      options: parsed.data.options,
    })
    return reply.send(success(result))
  })
}

export default genPostRoutes
