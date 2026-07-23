import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findNoticeList,
  findNoticeById,
  createNotice,
  updateNotice,
  deleteNoticesBatch,
} from '../../db/admin-sys-queries.js'

// notice_router (prefix=/notice)
const noticeBodySchema = z.object({
  noticeId: z.number().int().optional(),
  noticeTitle: z.string().min(1),
  noticeType: z.string().min(1),
  noticeContent: z.string().optional(),
  status: z.string().optional(),
  createBy: z.string().optional(),
  remark: z.string().optional(),
})

export const noticeRoutes: FastifyPluginAsync = async (s) => {
  // GET /notice/list - 通知公告列表
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findNoticeList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      noticeTitle: parseStr(q.noticeTitle),
      noticeType: parseStr(q.noticeType),
      createBy: parseStr(q.createBy),
    })
    return reply.send(success({ list, total }))
  })

  // GET /notice/:noticeId - 公告详情
  s.get('/:noticeId', async (request, reply) => {
    const { noticeId } = z.object({ noticeId: z.string() }).parse(request.params)
    const id = Number(noticeId)
    if (Number.isNaN(id)) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const data = await findNoticeById(id)
    if (!data) {
      return reply.status(404).send(error(404, '公告不存在'))
    }
    return reply.send(success({ data }))
  })

  // POST /notice - 新增公告
  s.post('', async (request, reply) => {
    const parsed = noticeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { noticeId: _noticeId, createBy: _createBy, ...data } = parsed.data
    const notice = await createNotice({ ...data, createBy: request.userId })
    return reply.send(success({ notice }))
  })

  // PUT /notice - 修改公告
  s.put('', async (request, reply) => {
    const parsed = noticeBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { noticeId, createBy: _createBy2, ...data } = parsed.data
    if (!noticeId) {
      return reply.status(400).send(error(400, 'noticeId 不能为空'))
    }
    const notice = await updateNotice(noticeId, { ...data, updateBy: request.userId })
    if (!notice) {
      return reply.status(404).send(error(404, '公告不存在'))
    }
    return reply.send(success({ notice }))
  })

  // DELETE /notice/:noticeIds - 删除公告(逗号分隔)
  s.delete('/:noticeIds', async (request, reply) => {
    const { noticeIds } = z.object({ noticeIds: z.string() }).parse(request.params)
    const ids = noticeIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const deleted = await deleteNoticesBatch(ids)
    return reply.send(success({ deleted }))
  })
}
