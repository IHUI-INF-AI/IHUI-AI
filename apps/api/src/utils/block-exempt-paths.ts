// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 封禁豁免路径。
 *
 * 存在的理由:anti-automation / threat-detector 在 onRequest 阶段查 IP 封禁表并直接 403,
 * 而这两道钩子过去各持一份互不一致的 SKIP_PATHS(anti-automation 那份甚至是空的),导致:
 * 1. 监控探针 `/api/health` 一起被 403,被封时监控看到的是"服务挂了"而不是"这个 IP 被封了";
 * 2. 429 响应头引导客户端去打的 `/api/security/challenge` 自己也被封禁表挡住,
 *    管理员解封接口同样在钩子之后 —— 一旦被封,没有任何自救路径,只能等 TTL 到期。
 *
 * 因此统一为一张表,由两道封禁钩子共同消费。
 */

/** 监控 / 探针路径:不参与反自动化与威胁检测(它们不是用户行为)。 */
const MONITORING_PATHS: ReadonlySet<string> = new Set([
  '/api/health',
  '/api/ready',
  '/api/metrics',
  '/metrics',
  '/business-metrics',
])

/**
 * 自助解封面:被封的 IP 必须够得着,否则 CAPTCHA 闭环和管理员解封都是死路。
 * 精确匹配的是无认证的挑战端点;前缀匹配的是 requireAdmin 保护的端点
 * (放行到路由层由鉴权裁决,不构成绕过)。
 * 含 /api/csrf-token:挑战端点走 CSRF 校验,被封客户端若连签发 token 都被 403,
 * 闭环就断在第 0 步(只能等 TTL),故它属于解封面而非普通业务面。
 * 故意不含 /api/security/report —— 它无认证且能给任意 IP 记坏事件,
 * 放进豁免面等于给被封的攻击者一条免费的投毒通道。
 */
const SELF_SERVICE_EXACT_PATHS: ReadonlySet<string> = new Set([
  '/api/security/challenge',
  '/api/security/verify-challenge',
  '/api/csrf-token',
])
const SELF_SERVICE_EXEMPT_PREFIXES: readonly string[] = [
  '/api/security/block-ip',
  '/api/security/ip-reputation/',
]

/**
 * 该路径是否豁免封禁检查与频率计数。
 * @param path 已去 query、已小写的请求路径
 */
export function isBlockExemptPath(path: string): boolean {
  if (MONITORING_PATHS.has(path)) return true
  if (SELF_SERVICE_EXACT_PATHS.has(path)) return true
  return SELF_SERVICE_EXEMPT_PREFIXES.some((p) => path.startsWith(p))
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
