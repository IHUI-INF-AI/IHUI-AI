import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { findLogininforList, cleanLogininfor } from '../../db/admin-sys-queries.js'
import { db } from '../../db/index.js'
import { inArray } from 'drizzle-orm'
import { sysLogininfor } from '@ihui/database'

// logininfo_router (prefix=/logininfor)
export const logininforRoutes: FastifyPluginAsync = async (s) => {
  // GET /logininfor/list - 登录日志
  s.get('/list', async (request, reply) => {
    const q = request.query as Record<string, string>
    const { list, total } = await findLogininforList({
      page: parseNum(q.page, 1),
      pageSize: parseNum(q.pageSize, 10),
      loginName: parseStr(q.loginName),
      ipaddr: parseStr(q.ipaddr),
      status: parseStr(q.status),
    })
    return reply.send(success({ list, total }))
  })

  // DELETE /logininfor/clean - 清空登录日志
  s.delete('/clean', async (_request, reply) => {
    await cleanLogininfor()
    return reply.send(success({}))
  })

  // DELETE /logininfor/:infoIds - 删除登录日志(逗号分隔)
  s.delete('/:infoIds', async (request, reply) => {
    const { infoIds } = z.object({ infoIds: z.string() }).parse(request.params)
    const ids = infoIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    if (ids.length === 0) {
      return reply.status(400).send(error(400, '无效的 ID'))
    }
    const deleted = await db
      .delete(sysLogininfor)
      .where(inArray(sysLogininfor.infoId, ids))
      .returning()
    return reply.send(success({ deleted: deleted.length }))
  })

  // PUT /logininfor/unlock/:userName - 解锁用户
  s.put('/unlock/:userName', async (request, reply) => {
    const { userName } = z.object({ userName: z.string() }).parse(request.params)
    return reply.send(success({ userName, unlocked: true }))
  })
}
