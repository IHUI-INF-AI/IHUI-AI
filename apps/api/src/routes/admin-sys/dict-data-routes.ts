import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findDictDataList,
  findDictDataById,
  findDictDataByType,
  createDictData,
  updateDictData,
  deleteDictDataBatch,
} from '../../db/admin-sys-queries.js'

// dict_data_router (prefix=/dict/data)
const dictDataBodySchema = z.object({
  dictCode: z.number().int().optional(),
  dictSort: z.number().int().optional(),
  dictLabel: z.string().min(1).optional(),
  dictValue: z.string().min(1).optional(),
  dictType: z.string().min(1).optional(),
  cssClass: z.string().optional(),
  listClass: z.string().optional(),
  isDefault: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

const createDictDataBodySchema = z.object({
  dictSort: z.number().int().optional(),
  dictLabel: z.string().min(1),
  dictValue: z.string().min(1),
  dictType: z.string().min(1),
  cssClass: z.string().optional(),
  listClass: z.string().optional(),
  isDefault: z.string().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

export const dictDataRoutes: FastifyPluginAsync = async (s) => {
  // GET /dict/data/list - 字典数据列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findDictDataList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      dictType: parseStr(q.dictType),
      dictLabel: parseStr(q.dictLabel),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // GET /dict/data/type/:dictType - 按 type 取字典数据
  s.get('/type/:dictType', async (request, reply) => {
    const { dictType } = z.object({ dictType: z.string() }).parse(request.params)
    const list = await findDictDataByType(dictType)
    return reply.send(success({ dictType, list }))
  })

  // POST /dict/data - 新增字典数据
  s.post('', async (request, reply) => {
    const parsed = createDictDataBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const dictData = await createDictData({ ...parsed.data, createBy: request.userId })
    return reply.send(success({ dictData }))
  })

  // GET /dict/data/:dictCode - 字典数据详情
  s.get('/:dictCode', async (request, reply) => {
    const { dictCode } = z.object({ dictCode: z.string() }).parse(request.params)
    const id = Number(dictCode)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findDictDataById(id)
    if (!data) {
      return reply.status(404).send(error(404, '字典数据不存在'))
    }
    return reply.send(success({ data }))
  })

  // PUT /dict/data - 修改字典数据
  s.put('', async (request, reply) => {
    const parsed = dictDataBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { dictCode, ...data } = parsed.data
    if (!dictCode) {
      return reply.status(400).send(error(400, 'dictCode 不能为空'))
    }
    const dictData = await updateDictData(dictCode, { ...data, updateBy: request.userId })
    if (!dictData) {
      return reply.status(404).send(error(404, '字典数据不存在'))
    }
    return reply.send(success({ dictData }))
  })

  // DELETE /dict/data/:dictCodes - 删除字典数据
  s.delete('/:dictCodes', async (request, reply) => {
    const { dictCodes } = z.object({ dictCodes: z.string() }).parse(request.params)
    const codes = dictCodes
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    await deleteDictDataBatch(codes)
    return reply.send(success({ deleted: true }))
  })
}
