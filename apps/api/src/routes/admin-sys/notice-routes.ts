// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { guardBatchTargets } from '../../utils/batch-outcome.js'
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
    const requested = noticeIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    // G-815986(2026-09-30):**空集合参数必须在任何 IO 之前拒绝**。
    // 这里的"空"不是"客户端传了空串"那么罕见 —— `DELETE /notice/abc`(非数字、纯逗号、
    // 全是 NaN)经上面两步过滤后就是**空数组**,旧写法带着它直接发出
    // `DELETE ... WHERE notice_id inArray([])`;实测 drizzle 把空 inArray 渲染成合法 SQL 里的
    // `false`(不报错、命中 0 行),于是这次请求:① 为一个根本不存在的目标付了一次写 round-trip,
    // ② 回 `deleted: 0` 与"确有目标但目标都不在库里"**完全同形**,调用方读不出"没做成"与"没目标"。
    // 判据只许住在 utils/batch-outcome.ts 那一个纯函数出口(它结构上发不出查询),
    // 不得在本文件再抄一份 `if (ids.length === 0)` —— 两处算同一件事必漂移。
    const guard = guardBatchTargets(requested, 'noticeIds')
    if (!guard.ok) {
      return reply.status(400).send({ ...error(400, guard.message), errorCode: guard.code })
    }
    const deleted = await deleteNoticesBatch(guard.ids)
    return reply.send(success({ deleted }))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
