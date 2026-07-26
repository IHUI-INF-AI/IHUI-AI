import type { MetadataRoute } from 'next'

// robots.txt 自动生成(2026-07-27 立,SEO 配套 sitemap.ts):
// - 允许爬虫抓取所有公开营销/产品/帮助/法律/资源页(sitemap.xml 已枚举)
// - 禁止抓取私有/登录后/敏感路由,防止被搜索引擎索引
//   私有页清单与 sitemap.ts 注释保持一致(admin/user/wallet/orders/sso/auth)
// - 显式声明 sitemap.xml 与 host,加速搜索引擎发现
// - 允许主流 AI 爬虫(GPTBot/ClaudeBot/PerplexityBot/Googlebot/Bingbot)抓取公开内容,
//   提升 GEO(LLM 检索)曝光度,与根 layout.tsx 的 llms.txt / claude.md 等 GEO 文件协同
//
// 2026-07-27 P3-1 对齐:output:'export' 模式下 robots.txt 路由需要 force-static,
// 与 sitemap.ts 同模式(否则 Next.js 抛 "export const dynamic = 'force-static' not configured" 错误)。
export const dynamic = 'force-static'

const SITE_URL = 'https://ihui.ai'

// 私有/敏感路由前缀清单(Disallow):
// - /api/           后端接口,无 HTML 内容
// - /admin/         管理后台,需 roleId 校验
// - /dashboard/     工作区私有面板
// - /settings/      用户设置(账号/API key/隐私/安全日志)
// - /wallet/        钱包(充值/提现/记录)
// - /orders/        订单详情
// - /payment/       支付流程(含 checkout 回调)
// - /member/        会员私有面板(地址/优惠券/历史)
// - /user/          用户私有资料(fans/follow/exam/profile)
// - /student/       学生私有数据(笔记/错题/证书)
// - /messages/      私信
// - /notifications/ 通知
// - /sso/           单点登录回调
// - /oauth/         OAuth 授权(含 authorize/my-authorized)
// - /search/        搜索历史(私有)
// - /workspace/     工作区实例(私有)
// - /memory/        Agent 记忆(私有)
// - /publish/       发布管理(私有)
// - /plan/          计划任务(私有)
// - /spec/          规格生成(私有)
// - /schedule/      日程(私有)
// - /tasks/         任务接收(私有)
// - /task-receiver/ 任务接收(私有)
// - /models/keys/   模型 API key 管理(敏感凭证)
// - /models/logs/   模型调用日志(私有)
// - /models/usage/  模型用量(私有)
// - /models/billing/ 模型账单(私有)
// - /settings/api-keys/ API key(敏感凭证)
// - /settings/security-log/ 安全日志(私有)
// - /settings/data-export/ 数据导出(私有)
// - /settings/account-deletion/ 账号注销(敏感操作)
const DISALLOWED_PATHS = [
  '/api/',
  '/admin/',
  '/dashboard/',
  '/settings/',
  '/wallet/',
  '/orders/',
  '/payment/',
  '/member/',
  '/user/',
  '/student/',
  '/messages/',
  '/notifications/',
  '/sso/',
  '/oauth/',
  '/search/',
  '/workspace/',
  '/memory/',
  '/publish/',
  '/plan/',
  '/spec/',
  '/schedule/',
  '/tasks/',
  '/task-receiver/',
  '/models/keys/',
  '/models/logs/',
  '/models/usage/',
  '/models/billing/',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        // 主流 AI 爬虫:允许抓取公开内容,提升 GEO 曝光度
        // GPTBot(OpenAI)/ ClaudeBot(Anthropic)/ PerplexityBot / Googlebot / Bingbot
        userAgent: ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Googlebot', 'Bingbot', 'CCBot'],
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
      {
        // 默认规则:所有爬虫
        userAgent: '*',
        allow: '/',
        disallow: DISALLOWED_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
