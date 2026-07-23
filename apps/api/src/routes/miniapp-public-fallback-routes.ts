/**
 * 小程序端首页公开 fallback 路由(2026-07-22 立)
 *
 * 背景:小程序端首页未登录时调用 /content/home、/content/banner/list、
 * /content/course/list、/study/info,这些路由在 API 中不存在或需鉴权,
 * 导致 Taro.request fail → 弹"网络异常"toast,影响界面展示。
 *
 * 方案:提供公开(无需鉴权)fallback,返回空数据成功响应,让首页能离线渲染骨架。
 * 已登录用户的真实数据走鉴权路由(/content/banners/list 复数等)。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../utils/response.js'

export const miniappPublicFallbackRoutes: FastifyPluginAsync = async (server) => {
  // GET /content/home - 首页聚合(banner 兜底)
  server.get('/content/home', async (_request, reply) => {
    return reply.send(success({ banner: [] }))
  })

  // GET /content/banner/list - banner 列表(单数别名,对齐小程序端契约)
  server.get('/content/banner/list', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // GET /content/course/list - 课程列表
  server.get('/content/course/list', async (_request, reply) => {
    return reply.send(success({ list: [], total: 0 }))
  })

  // GET /study/info - 学习统计
  server.get('/study/info', async (_request, reply) => {
    return reply.send(
      success({ todayMinutes: 0, totalMinutes: 0, continuousDays: 0, courses: 0 }),
    )
  })
}
