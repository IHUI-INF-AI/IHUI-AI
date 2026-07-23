import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findDictTypeList,
  findDictTypeById,
  createDictType,
  updateDictType,
  deleteDictTypesBatch,
} from '../../db/admin-sys-queries.js'

// dict_type_router (prefix=/dict/type)
const dictTypeBodySchema = z.object({
  dictId: z.number().int().optional(),
  dictName: z.string().min(1).optional(),
  dictType: z.string().min(1).optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

export const dictTypeRoutes: FastifyPluginAsync = async (s) => {
  // GET /dict/type/list - 字典类型列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findDictTypeList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      dictName: parseStr(q.dictName),
      dictType: parseStr(q.dictType),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // GET /dict/type/optionselect - 字典类型下拉
  s.get('/optionselect', async (_request, reply) => {
    const { list } = await findDictTypeList({ pageSize: 1000 })
    return reply.send(success({ list }))
  })

  // GET /dict/type/:dictId - 字典类型详情
  s.get('/:dictId', async (request, reply) => {
    const { dictId } = z.object({ dictId: z.string() }).parse(request.params)
    const id = Number(dictId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findDictTypeById(id)
    if (!data) {
      return reply.status(404).send(error(404, '字典类型不存在'))
    }
    return reply.send(success({ data }))
  })

  // POST /dict/type - 新增字典类型
  s.post('', async (request, reply) => {
    const parsed = dictTypeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { dictId: _dictId, dictName, dictType: dt, ...rest } = parsed.data
    if (!dictName || !dt) {
      return reply.status(400).send(error(400, 'dictName 和 dictType 不能为空'))
    }
    const dictType = await createDictType({
      ...rest,
      dictName,
      dictType: dt,
      createBy: request.userId,
    })
    return reply.send(success({ dictType }))
  })

  // PUT /dict/type - 修改字典类型
  s.put('', async (request, reply) => {
    const parsed = dictTypeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { dictId, ...data } = parsed.data
    if (!dictId) {
      return reply.status(400).send(error(400, 'dictId 不能为空'))
    }
    const dictType = await updateDictType(dictId, { ...data, updateBy: request.userId })
    if (!dictType) {
      return reply.status(404).send(error(404, '字典类型不存在'))
    }
    return reply.send(success({ dictType }))
  })

  // DELETE /dict/type/refreshCache - 刷新缓存
  s.delete('/refreshCache', async (_request, reply) => {
    return reply.send(success({ success: true }))
  })

  // DELETE /dict/type/:dictIds - 删除字典类型(逗号分隔)
  s.delete('/:dictIds', async (request, reply) => {
    const { dictIds } = z.object({ dictIds: z.string() }).parse(request.params)
    const ids = dictIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const deleted = await deleteDictTypesBatch(ids)
    return reply.send(success({ deleted }))
  })
}
