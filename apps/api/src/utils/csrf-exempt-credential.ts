// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 「这枚 JWT 是本服务端签的」—— CSRF 豁免的**唯一**凭据判据。
 *
 * ## 为什么不能用形态判定
 *
 * csrf.ts 历史上对 `Authorization: Bearer <x>` 只判**形态**(三段 base64url / `ihui_` 前缀,
 * 见 `isPlausibleBearerCredential`),理由是"真伪由路由侧鉴权判定"。但 CSRF 钩子注册在
 * **onRequest**,早于所有路由侧 preHandler/handler —— 形态判据成立的那一刻,请求已经
 * 整块跳过了 CSRF 校验。对"公开但要写状态"的端点(如 O7 RFC 7591 动态注册),这就等于
 * 攻击者自己拼一个 `Bearer aaa.bbb.ccc` 就能拿到无 CSRF 的写通道(与内部凭据族
 * `if (headers['x-internal-service-token']) return` 同一型无判据问题,只是载体从
 * 头名换成 token 形状)。
 *
 * ## 本函数的判据
 *
 * `compactVerify` 只验**签名**,不验 exp/aud/nbf —— 这是刻意的,不是疏漏:
 *
 *  - **签名通过** ⇒ 该 JWT 由持有 `JWT_SECRET` 的服务端签发,客户端无法伪造
 *    ⇒ 凭据"以服务端不可伪造的方式传递"这一 CSRF 豁免前提成立。
 *  - **不验 exp** ⇒ 已过期的 token 仍算"真凭据",豁免继续生效,请求照常落到路由侧
 *    由 `authenticate()` 判 401(前端 `apps/web/src/lib/api.ts` 的 401→静默续期链路
 *    才能接上)。若这里一并因过期而拒绝,过期 token 的写请求会从 401 变成 CSRF 403,
 *    前端续期分支永不触发 —— 那是把一次鉴权失败伪装成 CSRF 失败,比原缺陷更难排查。
 *    身份有效性(过期/封禁/refresh 冒充)是**授权**问题,归 `authenticate()`;本函数只回答
 *    "这个签名是不是我们自己签的"。
 *  - `algorithms: ['HS256']` ⇒ alg=none 与 RS256/HMAC 混淆(拿公钥当 HMAC 密钥)在此
 *    一并被拒。实测 jose 6.2.9:伪造签名 → ERR_JWS_SIGNATURE_VERIFICATION_FAILED,
 *    alg=none → ERR_JOSE_ALG_NOT_ALLOWED。
 *
 * 与 `verifyAccessToken`(packages/auth)的分工:那个是**授权**入口(验签 + exp + iss/aud
 * + type≠refresh + 查用户状态),会打 DB;本函数是**豁免**判据,必须留在 onRequest 的
 * 热路径上,因此只做无 IO 的签名验证。两者共用同一把 `JWT_SECRET`,不新增密钥体系。
 */
import { compactVerify } from 'jose'

/**
 * 校验一枚 access JWT 的签名是否由本服务端签出。
 *
 * @param token `Authorization: Bearer` / `auth_token` cookie 里的 JWT 原文
 * @returns 签名有效 ⇒ true;形态不成立/ 验签失败 / 密钥不可用 ⇒ false(fail-closed)
 */
export async function isServerSignedJwt(token: string | undefined): Promise<boolean> {
  if (!token) return false
  // 三段结构是 compact JWS 的最小形态;先判掉可省掉一次验签开销。
  const parts = token.split('.')
  if (parts.length !== 3 || parts.some((p) => p.length === 0)) return false
  try {
    const { getJwtSecret } = await import('@ihui/auth')
    // compactVerify 只验签名,不看 exp(理由见文件头"判据"一节)。
    await compactVerify(token, getJwtSecret(), { algorithms: ['HS256'] })
    return true
  } catch {
    // 密钥未配置/强度不足(getJwtSecret 会抛)、验签失败、格式非法 —— 一律拒绝豁免。
    return false
  }
}
// ⁠‌‌‌‍‍‌‍‍‌‌‌‍‌‌‍‌‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‌‌‍‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‌‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‌‌‌‌‍‌‌‌‌‍‍‌‍‍‍‍‌‌‌‌‍‌‍‍‍‍‌‌‌‌‍‍‍‍‍‍‌‌‌‌‍‍‍️‌‌‍‍‌‌‍‍‍‍‌‌‌‍‌‍‍‍‍‌‍‍‌‍‍‍‌‍‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
