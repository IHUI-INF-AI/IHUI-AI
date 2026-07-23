import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findConfigList,
  findConfigById,
  findConfigByKey,
  createConfig,
  updateConfig,
  deleteConfigsBatch,
} from '../../db/admin-sys-queries.js'

// config_router (prefix=/config)
const configBodySchema = z.object({
  configId: z.number().int().optional(),
  configName: z.string().min(1).optional(),
  configKey: z.string().min(1).optional(),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
})

const createConfigBodySchema = z.object({
  configName: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.string().optional(),
  configType: z.string().optional(),
  remark: z.string().optional(),
})

export const configRoutes: FastifyPluginAsync = async (s) => {
  // GET /config/list - 参数列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findConfigList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      configName: parseStr(q.configName),
      configKey: parseStr(q.configKey),
      configType: parseStr(q.configType),
    })
    return reply.send(success({ list, total }))
  })

  // GET /config/configKey/:configKey - 按 key 取参数
  s.get('/configKey/:configKey', async (request, reply) => {
    const { configKey } = z.object({ configKey: z.string() }).parse(request.params)
    const data = await findConfigByKey(configKey)
    if (!data) {
      return reply.status(404).send(error(404, '参数配置不存在'))
    }
    return reply.send(success({ data }))
  })

  // GET /config/:configId - 配置详情
  s.get('/:configId', async (request, reply) => {
    const { configId } = z.object({ configId: z.string() }).parse(request.params)
    const id = Number(configId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findConfigById(id)
    if (!data) {
      return reply.status(404).send(error(404, '参数配置不存在'))
    }
    return reply.send(success({ data }))
  })

  // POST /config - 新增配置
  s.post('', async (request, reply) => {
    const parsed = createConfigBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const config = await createConfig({ ...parsed.data, createBy: request.userId })
    return reply.send(success({ config }))
  })

  // PUT /config - 修改配置
  s.put('', async (request, reply) => {
    const parsed = configBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { configId, ...data } = parsed.data
    if (!configId) {
      return reply.status(400).send(error(400, 'configId 不能为空'))
    }
    const config = await updateConfig(configId, { ...data, updateBy: request.userId })
    if (!config) {
      return reply.status(404).send(error(404, '参数配置不存在'))
    }
    return reply.send(success({ config }))
  })

  // DELETE /config/refreshCache - 刷新缓存
  s.delete('/refreshCache', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // DELETE /config/:configIds - 删除配置(逗号分隔)
  s.delete('/:configIds', async (request, reply) => {
    const { configIds } = z.object({ configIds: z.string() }).parse(request.params)
    const ids = configIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const deleted = await deleteConfigsBatch(ids)
    return reply.send(success({ deleted }))
  })
}
