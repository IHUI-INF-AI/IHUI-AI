/**
 * community 路由 hub(从原 community.ts 拆分,原始 1838 行已拆为 4 个子路由)。
 *
 * 拆分为:
 *   - community/circles.ts  圈子 + 帖子 + 点赞 + 评论
 *   - community/topics.ts   主题/动态 + 圈子分类关系
 *   - community/posts.ts    跨圈子社区帖子(/community/posts)
 *   - community/asks.ts     Asks 问答 + 圈子管理(admin)
 *
 * 挂载位置由 server.ts 的 server.register(communityRoutes, { prefix: '/api' }) 控制。
 * 端点路径与行为完全等价于原 community.ts。
 */
import type { FastifyPluginAsync } from 'fastify'
import circlesRoutes from './community/circles.js'
import topicsRoutes from './community/topics.js'
import postsRoutes from './community/posts.js'
import asksRoutes from './community/asks.js'

export const communityRoutes: FastifyPluginAsync = async (server) => {
  await server.register(circlesRoutes)
  await server.register(topicsRoutes)
  await server.register(postsRoutes)
  await server.register(asksRoutes)
}
