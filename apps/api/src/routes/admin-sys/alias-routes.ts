import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import {
  findLogininforList,
  cleanLogininfor,
  findJobLogList,
  cleanJobLogs,
  findPostList,
  findPostById,
} from '../../db/admin-sys-queries.js'

// 英文别名路由(若依风格 → 英文规范,兼容前端)
// - /login-logs  兼容 /logininfor
// - /tasks/logs  兼容 /job/log
// - /posts       兼容 /post
export const aliasRoutes: FastifyPluginAsync = async (server) => {
  // login-logs 别名(兼容 /logininfor)
  server.register(
    async (s) => {
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
      s.delete('/clean', async (_request, reply) => {
        await cleanLogininfor()
        return reply.send(success({}))
      })
    },
    { prefix: '/login-logs' },
  )

  // tasks/logs 别名(兼容 /job/log)
  server.register(
    async (s) => {
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findJobLogList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          jobName: parseStr(q.jobName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })
      s.delete('/clean', async (_request, reply) => {
        await cleanJobLogs()
        return reply.send(success({}))
      })
    },
    { prefix: '/tasks/logs' },
  )

  // posts 别名(兼容 /post)
  server.register(
    async (s) => {
      s.get('/list', async (request, reply) => {
        const q = request.query as Record<string, string>
        const { list, total } = await findPostList({
          page: parseNum(q.page, 1),
          pageSize: parseNum(q.pageSize, 10),
          postCode: parseStr(q.postCode),
          postName: parseStr(q.postName),
          status: parseStr(q.status),
        })
        return reply.send(success({ list, total }))
      })
      s.get('/:postId', async (request, reply) => {
        const { postId } = z.object({ postId: z.string() }).parse(request.params)
        const id = Number(postId)
        if (Number.isNaN(id)) {
          return reply.status(400).send(error(400, '无效的 ID'))
        }
        const data = await findPostById(id)
        if (!data) {
          return reply.status(404).send(error(404, '岗位不存在'))
        }
        return reply.send(success({ data }))
      })
    },
    { prefix: '/posts' },
  )
}
