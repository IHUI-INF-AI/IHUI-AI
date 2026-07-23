import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseStr } from './_shared.js'
import { findDeptList, findDeptById, createDept, deleteDept, updateDept } from '../../db/admin-sys-queries.js'

// dept_router (prefix=/dept)
const deptBodySchema = z.object({
  deptId: z.number().int().optional(),
  parentId: z.number().int().optional(),
  deptName: z.string().min(1).optional(),
  orderNum: z.number().int().optional(),
  leader: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  status: z.string().optional(),
})

export const deptRoutes: FastifyPluginAsync = async (s) => {
  // GET /dept/list - 部门列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const list = await findDeptList({
      deptName: parseStr(q.deptName),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total: list.length }))
  })

  // GET /dept/list/exclude/:deptId - 排除某部门的树
  s.get('/list/exclude/:deptId', async (request, reply) => {
    const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
    const excludeId = Number(deptId)
    const list = await findDeptList()
    return reply.send(
      success({ list: list.filter((d) => d.deptId !== excludeId), exclude: deptId }),
    )
  })

  // GET /dept/:deptId - 部门详情
  s.get('/:deptId', async (request, reply) => {
    const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
    const id = Number(deptId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findDeptById(id)
    if (!data) {
      return reply.status(404).send(error(404, '部门不存在'))
    }
    return reply.send(success({ data }))
  })

  // POST /dept - 新增部门
  s.post('', async (request, reply) => {
    const parsed = deptBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { deptId: _deptId, deptName, ...rest } = parsed.data
    if (!deptName) {
      return reply.status(400).send(error(400, 'deptName 不能为空'))
    }
    const dept = await createDept({ ...rest, deptName })
    return reply.send(success({ dept }))
  })

  // PUT /dept - 修改部门
  s.put('', async (request, reply) => {
    const parsed = deptBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { deptId, ...data } = parsed.data
    if (!deptId) {
      return reply.status(400).send(error(400, 'deptId 不能为空'))
    }
    const dept = await updateDept(deptId, data)
    if (!dept) {
      return reply.status(404).send(error(404, '部门不存在'))
    }
    return reply.send(success({ dept }))
  })

  // DELETE /dept/:deptId - 删除部门
  s.delete('/:deptId', async (request, reply) => {
    const { deptId } = z.object({ deptId: z.string() }).parse(request.params)
    const id = Number(deptId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const dept = await deleteDept(id)
    if (!dept) {
      return reply.status(404).send(error(404, '部门不存在'))
    }
    return reply.send(success({ success: true }))
  })
}
