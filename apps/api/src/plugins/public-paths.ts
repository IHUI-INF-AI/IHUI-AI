// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 公开面单一真相源(BUG-4 根治)。
 *
 * 此前"哪些路径属于公开面"在三处各写了一份清单,且匹配语义彼此不一:
 *   · `plugins/auth-default-deny.ts` —— 兜底鉴权闸的公开名单,用 `path === p || path.startsWith(p)`
 *     (无段边界,`/api/agents` 会顺带放过 `/api/agentsXYZ`);
 *   · `plugins/tenant.ts` —— 租户隔离绕过的公开名单,用 `matchesPrefix`(段边界安全);
 *   · `server.ts` —— 网络分段的公开名单,用 `url.startsWith(p)`(无段边界)。
 * 三份不同源 + 两种匹配语义 ⇒ 漏登记一处就整链 401,多登记又让相邻未注册路径被误免鉴权。
 *
 * 根治(单一真相源 + 单一匹配原语):
 *   1. 三份清单**同源共存于本模块**,新增/调整公开面只改这一处,不再三文件各写一份、各漂各的;
 *   2. 三份都统一走 `matchesPrefix`(已在 `utils/http-normalize.ts` 实现、段边界安全、tenant.ts 已验证)
 *      —— 根除 `startsWith` 无段边界的毛病,`/api/agents` 不再顺带放过 `/api/agentsXYZ`。
 *
 * 三份清单的语义边界(故意不盲目合并):
 *   · `AUTH_PUBLIC_*` —— 兜底鉴权闸用:无凭据也放行(不需要登录)。这是"真实公开面"的权威定义。
 *   · `TENANT_BYPASS_*` —— 租户隔离绕过用:不强制 X-Tenant-Id / 租户存在性。
 *   · `NETWORK_PUBLIC_*` —— 网络分段用:不注入内网隔离,保持公网可达。
 * 三者是**不同维度**的公开性(`/api/settings` 可"免租户"却仍"需登录"),故分列;但同住一模块、
 * 同用一把尺,既消除漂移,又不破坏各维度的安全语义(如 `/api/settings/contact` 仍须登录)。
 *
 * 段边界约定(由 `matchesPrefix` 强制):
 *   · 带尾斜杠的前缀(`/api/auth/`)→ 仅 `startsWith`(含自身及所有子段);
 *   · 裸前缀(`/api/agents`)→ 精确匹配自身,或 `startsWith(prefix + '/')`(子段),**绝不**顺带放过
 *     `/api/agentsXYZ` 这类"同前缀兄弟路径"。
 *   · 精确集合只匹配自身——`/` 必须在精确集合里,一旦放进前缀集合会退化成"匹配一切"。
 */
import { matchesPrefix } from '../utils/http-normalize.js'

/**
 * 兜底鉴权闸的公开面(权威"真实公开面")。
 * 仅当"这条路径没有、也不需要登录"时才列于此;有凭据或自己的 preHandler 鉴权的路由不应出现。
 */
export const AUTH_PUBLIC_EXACT_PATHS: ReadonlySet<string> = new Set([
  '/',
  '/health',
  '/ready',
  '/live',
  '/metrics',
  '/business-metrics',
  '/api/health',
  '/api/metrics',
  '/api/business-metrics',
  '/api/csrf-token',
  '/api/landing',
  '/api/version',
  '/.well-known/agent.json',
  '/.well-known/agent-card.json',
  '/.well-known/apple-app-site-association',
  '/.well-known/assetlinks.json',
  '/api/configs',
  '/api/announcements',
  '/api/ai-education/teacher-certification',
  '/api/docs',
])

/** 兜底鉴权闸的公开前缀(段边界安全)。 */
export const AUTH_PUBLIC_PREFIX_PATHS: readonly string[] = [
  // 探活与指标
  '/api/health/',
  // 静态与公开文件
  '/uploads/',
  '/api/oss/public/',
  '/api/public/',
  // 登录/注册/OAuth/SSO 入口(各端点自己决定要不要凭据)
  '/api/auth/',
  '/api/oauth/',
  '/oauth/',
  '/api/sso/',
  // 外部平台回调(签名校验,不走 JWT)
  '/api/callback/',
  '/api/webhooks/',
  '/api/payments/',
  '/api/payment/',
  '/api/cozeZhsApi/',
  // GitHub App webhook(HMAC 验签,匿名到达)
  '/api/github-app/',
  // 协议发现
  '/.well-known/',
  // 机器面(API Key 自证;requireApiKeyAuth 会写 request.apiKey)
  '/v1/',
  '/v1beta/',
  '/api/mcp',
  // 公开市场与公开内容
  '/api/agents',
  '/api/categories',
  '/api/landing',
  '/api/voice/',
  '/api/crash-reports',
  // 文档详情 `/api/docs/:slug`(尾斜杠是段边界:不会顺带放过 `/api/docs-xyz` 或 `/api/admin/docs`)
  '/api/docs/',
  // 门户落地页 / 首页内容聚合 / 分类字典缓存
  '/landing',
  '/api/feature-center/',
  '/api/ai-world/',
  '/api/cache/agent-category-dict/',
  // 客户端启动即调的版本检查(注释自述"公开")与新闻列表
  '/api/app-version/',
  '/api/news/',
  '/api/news',
  '/api/articles',
  '/api/tools',
  '/api/help/',
  '/api/ai-feed/',
  '/api/live/',
  '/api/vip/levels',
  '/api/circles',
  '/api/relay/models/public',
  '/api/relay/monitor/',
  '/api/model-leaderboard',
  '/api/learn/',
  '/api/exam/papers',
  // 匿名埋点:未登录访客也要上报浏览,否则漏斗整段缺失
  '/api/analytics/track',
  '/api/visit-tracking/',
  // 路由自身已显式豁免的探活
  '/api/knowledge/health',
]

/**
 * 租户隔离绕过的公开面:不带 X-Tenant-Id / 不强制租户存在性即放行的路径。
 * 与鉴权公开面是不同维度(可"免租户"却仍"需登录",如 `/api/settings`)。
 */
export const TENANT_BYPASS_PREFIX_PATHS: readonly string[] = [
  '/api/health',
  '/api/auth/',
  '/api/sms-proxy/',
  // 短信厂商回调:只放完整路径,不放 /api/sms/callback/ 前缀(否则今后往该前缀下加写端点会
  // 自动继承"免租户"待遇;TENANT_STRICT_MODE 开 true 时回执整条链当场 401)。
  '/api/sms/callback/tencent',
  '/api/sms/callback/tencent/status',
  '/api/sms/callback/tencent/reply',
  '/api/oauth/',
  '/api/payments/',
  '/api/ai/callback',
  // 信源入口:同 ai-callback 属"机器回调",调用方不携带租户头(带 HMAC 签名);只放完整路径。
  '/api/webhooks/github',
  '/api/tbox/events',
  '/api/csrf-token',
  '/api/configs',
  '/api/settings',
  '/api/agreements/',
  '/api/exchange-rates/',
  '/api/share/',
  '/api/openapi/',
  '/api/developer/portal',
  '/api/ai-pricing',
  '/api/vip/levels',
  '/api/vip/products',
  '/docs',
  '/openapi.json',
]

/**
 * 网络分段的公开面:不注入内网隔离、保持公网可达的路径前缀。
 */
export const NETWORK_PUBLIC_PREFIX_PATHS: readonly string[] = [
  '/api/health',
  '/api/landing',
  '/api/public/',
  '/api/oss/public/',
  '/api/metrics',
  '/business-metrics',
  '/api/csrf-token',
]

/** 兜底鉴权闸:段边界安全的公开面判定。 */
export function isAuthPublicPath(path: string): boolean {
  if (AUTH_PUBLIC_EXACT_PATHS.has(path)) return true
  return AUTH_PUBLIC_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 租户隔离绕过:段边界安全的公开面判定。 */
export function isTenantBypassPath(path: string): boolean {
  return TENANT_BYPASS_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 网络分段:段边界安全的公开面判定。 */
export function isNetworkPublicPath(path: string): boolean {
  return NETWORK_PUBLIC_PREFIX_PATHS.some((p) => matchesPrefix(path, p))
}

/** 段边界安全的前缀匹配原语(再导出,供需要单独比对的消费方使用,避免第二个实现漂移)。 */
export { matchesPrefix }
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
