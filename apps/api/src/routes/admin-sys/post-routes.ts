import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { success, error } from '../../utils/response.js'
import { parseNum, parseStr } from './_shared.js'
import { findPostList, findPostById, createPost, updatePost, deletePostsBatch } from '../../db/admin-sys-queries.js'

// post_router (prefix=/post)
const postBodySchema = z.object({
  postId: z.number().int().optional(),
  postCode: z.string().min(1).optional(),
  postName: z.string().min(1).optional(),
  postSort: z.number().int().optional(),
  status: z.string().optional(),
  remark: z.string().optional(),
})

export const postRoutes: FastifyPluginAsync = async (s) => {
  // GET /post/list - 岗位列表
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

  // GET /post/:postId - 岗位详情
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

  // POST /post - 新增岗位
  s.post('', async (request, reply) => {
    const parsed = postBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { postId: _postId, postCode, postName, ...rest } = parsed.data
    if (!postCode || !postName) {
      return reply.status(400).send(error(400, 'postCode 和 postName 不能为空'))
    }
    const post = await createPost({ ...rest, postCode, postName })
    return reply.send(success({ post }))
  })

  // PUT /post - 修改岗位
  s.put('', async (request, reply) => {
    const parsed = postBodySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const { postId, ...data } = parsed.data
    if (!postId) {
      return reply.status(400).send(error(400, 'postId 不能为空'))
    }
    const post = await updatePost(postId, data)
    if (!post) {
      return reply.status(404).send(error(404, '岗位不存在'))
    }
    return reply.send(success({ post }))
  })

  // DELETE /post/:postIds - 删除岗位(逗号分隔)
  s.delete('/:postIds', async (request, reply) => {
    const { postIds } = z.object({ postIds: z.string() }).parse(request.params)
    const ids = postIds
      .split(',')
      .filter(Boolean)
      .map(Number)
      .filter((n) => !Number.isNaN(n))
    const deleted = await deletePostsBatch(ids)
    return reply.send(success({ deleted }))
  })
}
