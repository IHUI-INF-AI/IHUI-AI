// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端圈子只读端点(GET /circles/users/recommend、GET /circles/topics/hot)。
 *
 * RN 圈子广场(CircleIndexScreen:131)与小程序圈子页(pages/circle/index.tsx:106)都在打这两条
 * 路径,后端此前一条都没注册 ⇒ 两块副榜恒空。这里按调用方已声明的契约补最小读面:
 *   - UserListRes{list} / RecommendUser{id,nickname,avatar?,bio?,followed?}
 *   - TopicListRes{list} / HotTopic{id,name,count}
 *
 * 数据源全部现成,零迁移:users.nickname/avatar/bio + user_follows(出 followed);
 * 热话题 = tags.name + tags.usage_count(见 social-queries.findHotTags 的取源理由)。
 * 候选与排序住在查询层(social-queries.ts),路由不重写 SQL。
 *
 * 鉴权档 = 整条要登录(与 course-mobile-routes 同档 preHandler + checkAuth)。依据:
 * ① 副榜唯一的动作是「关注」,而 POST /circles/follow 本身就要求登录(circles.ts preHandler
 *   把非公开的 GET 之外全部authenticate) ⇒ 游客看得见名单也点不动;
 * ② followed 是归属型读数,公开化就得给"游客态一律 false"造一条不读身份的分支,
 *   而 §5 要求公开读面显式登记 ⇒ 不开新公开面,不发明白名单;
 * ③ 调用方对该榜是「静默失败不阻塞主流程」,登录墙下的 401 与今天的 404 表现一致(副榜空),
 *   不算回退。
 * 身份只取 JWT 主体 request.userId;客户端自报的 userId 一律不读。热话题榜不含归属读数,
 * 因此既不读 query.userId 也不读 body.userId,同样落在上面这条档里(要登录,但不据自报取数)。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { checkAuth } from '../plugins/auth.js'
import { success } from '../utils/response.js'
import { parsePagination } from './user/_shared.js'
import { findFollowingIds, findHotTags, findRecommendedUsers } from '../db/social-queries.js'

export const circleMobileRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /circles/users/recommend - 推荐关注(分页参数沿用 user/_shared 的 parsePagination)
  server.get('/circles/users/recommend', async (request, reply) => {
    const pagination = parsePagination(request, reply)
    if (!pagination) return
    const userId = request.userId!
    const { page, pageSize } = pagination
    const { list, total } = await findRecommendedUsers({ page, pageSize, excludeUserId: userId })
    const followedIds = new Set(
      await findFollowingIds(
        userId,
        list.map((row) => row.id),
      ),
    )
    return reply.send(
      success({
        list: list.map((row) => ({
          id: row.id,
          // nickname 在库里可空,移动端契约要求字符串 ⇒ 空串如实反映"未填昵称"
          nickname: row.nickname ?? '',
          avatar: row.avatar ?? undefined,
          bio: row.bio ?? undefined,
          followed: followedIds.has(row.id),
        })),
        total,
        page,
        pageSize,
      }),
    )
  })

  // GET /circles/topics/hot - 热话题榜(分页参数同样沿用 user/_shared 的 parsePagination)
  // count 口径如实写清:给的是 tags.usage_count(该话题被关联的资源次数,含全部资源类型),
  // 不是"该话题下的圈子帖子数"——库里没有后者这个数,不现造。
  server.get('/circles/topics/hot', async (request, reply) => {
    const pagination = parsePagination(request, reply)
    if (!pagination) return
    const { list, total } = await findHotTags(pagination)
    return reply.send(
      success({
        list: list.map((tag) => ({
          id: tag.id,
          name: tag.name,
          count: tag.usageCount,
        })),
        total,
        page: pagination.page,
        pageSize: pagination.pageSize,
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
