// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍​‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 招聘计划静态端点(2026-08-31 修复 404)。
 * 前端 (main)/recruitment 页与 /recruitment/[id] 详情页调用 GET /api/recruitment,
 * 后端此前无此路由 → 404。招聘计划为静态营销内容,直接返回内置数据。
 */
import type { FastifyPluginAsync } from 'fastify'
import { success } from '../../utils/response.js'

const PLAN = {
  title: '加入智汇AI',
  subtitle: '一起构建下一代 AI 应用平台',
  description:
    '智汇AI(IHUI-AI)是开源的 AI 应用平台,致力于让 AI 能力人人可用。我们正在寻找热爱技术、相信 AI 改变世界的伙伴,一起打造从模型网关、智能体编排到行业落地的完整产品矩阵。',
  requirements: [
    {
      title: 'AI 应用开发工程师',
      detail: '熟悉 TypeScript/Python,有 LLM 应用(Agent/RAG/Function Calling)开发经验',
    },
    { title: '大模型算法工程师', detail: '熟悉主流模型架构与微调,有推理优化或模型评估经验' },
    { title: '产品经理(AI 方向)', detail: '深度理解 AI 应用场景,能定义清晰的用户价值与产品路线' },
    { title: '开源社区运营', detail: '擅长内容创作与社区活动,熟悉 GitHub/公众号等渠道运营' },
  ],
  benefits: [
    { title: '远程协作', detail: '弹性工作时间,支持远程办公' },
    { title: '开源影响力', detail: '深度参与知名开源项目,沉淀个人品牌' },
    { title: '成长空间', detail: '与顶尖 AI 工程师共事,快速成长' },
    { title: '股权激励', detail: '核心成员享期权激励' },
  ],
  stats: [
    { label: '技术栈', value: 'TS + Python' },
    { label: '办公模式', value: '远程' },
    { label: '开源项目', value: 'IHUI-AI' },
  ],
}

export const recruitmentRoutes: FastifyPluginAsync = async (server) => {
  // GET /recruitment — 招聘计划(列表页 + 详情页共用)
  server.get('/recruitment', async (_request, reply) => {
    return reply.send(success(PLAN))
  })
}
