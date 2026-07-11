import type { FastifyPluginAsync } from 'fastify'
import { success, error } from '../utils/response.js'

/**
 * 分享内容路由：/api/share/content/:code
 * 通过分享 code 获取 AI 对话内容（迁移自 share-h5 历史项目的 getShareContentByCode）。
 * 当前为结构化占位实现，确保 API 可用；后续接入数据库查询替换 TODO 即可。
 */
export const shareContentRoutes: FastifyPluginAsync = async (fastify) => {
  // 获取分享内容
  fastify.get('/content/:code', async (request, reply) => {
    const { code } = request.params as { code: string }

    // 校验 code：排除常见的无效路径名
    const invalidCodes = ['', 'dist', 'index.html', 'index', 'share', 'error']
    if (!code || invalidCodes.includes(code)) {
      return reply.code(400).send(error(400, '分享链接无效'))
    }

    // TODO: 从数据库或缓存查询分享内容（迁移自 /agent/creation/share/third/${code}）
    // 临时返回结构化占位数据，确保 API 可用
    const data = {
      code,
      modelName: 'AI 助手',
      modelIcon: '/icons/ai-default.png',
      question: '分享内容加载中...',
      answer: { text: '分享内容功能已就绪，等待数据接入。' },
      createdAt: new Date().toISOString(),
    }

    return reply.send(success(data))
  })
}
