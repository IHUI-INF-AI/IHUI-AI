/**
 * 系统级 access token 签发(后台任务调用 ai-service 用)。
 *
 * 背景:ai-service 的 JWT 中间件(Shared JWT_SECRET)验证所有非白名单请求,
 * 后台任务(jobs/ai-feed-collect 的 LLM 分类、ai-world-sync 的摘要改写等)没有
 * 用户上下文,aiServiceFetch(null, ...) 不带 Authorization → 401 → LLM 功能静默失效。
 *
 * 方案:用与 ai-service 共享的 JWT_SECRET 签发一个固定 sub 的短时 access token,
 * issuer 对齐 ai-service settings.jwt_issuer('ihui-ai'),type='access'。
 * 10 分钟有效 + 模块级缓存(到期前 1 分钟自动重签),避免每次调用都签名。
 */
import { SignJWT } from 'jose'
import { config } from '../config/index.js'

const SUBJECT = 'system-worker'
const TTL_MS = 10 * 60_000

let cached: { token: string; exp: number } | null = null

export async function getSystemAccessToken(): Promise<string> {
  const now = Date.now()
  if (cached && cached.exp > now + 60_000) return cached.token
  const secret = new TextEncoder().encode(config.JWT_SECRET)
  const token = await new SignJWT({ userId: SUBJECT, roleId: 0, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('ihui-ai')
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(secret)
  cached = { token, exp: now + TTL_MS }
  return token
}
