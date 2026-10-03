// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * API Key「是否真实存在且当前可用」的唯一判定。
 *
 * 为什么单独一个模块:CSRF 钩子(csrf.ts)注册在 **onRequest**,要判「这个 `ihui_` 机器凭据
 * 是不是真的」就得查库;而 csrf 插件是 server.ts 主作用域上的全局钩子,静态 import DB
 * 会把连接池拉进**每次启动**的加载图(与 utils/internal-principal.ts 对 secretsEqual
 * 的动态导入同一理由:钩子只回答"凭据是否自证",不该为一次判定把重依赖拖进加载图)。
 * 故此处只留一个窄函数,由 csrf.ts **动态导入**,且导入失败 ⇒ false(fail-closed)。
 *
 * 判据 = 库里有行 + status='active' + 未过期(与 plugins/api-key-auth.ts 的
 * `authenticateApiKey` 前三步同向:先 status 再 checkExpiresAt)。刻意**不含**
 * secret 二次因子、IP ACL、模型白名单、配额与限流 —— 那些是 authenticateApiKey 的职责,
 * 由路由侧在该钩子之后照常执行;本函数只回答"这把 key 是不是真的存在",不重复授权。
 *
 * 读源用 `db`(主库)而非 `dbRead`,与 authenticateApiKey 的 P1-3 修复同理由:
 * 新建的 key 若从副本读会因复制延迟查不到,那样会把合法机器调用误判成"key 不存在"
 * ⇒ CSRF 403,是凭空造出的可用性事故。
 */
import { eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { developerApiKeys } from '@ihui/database'

/** 与 plugins/api-key-auth.ts `generateApiKey()` 同源:公开标识形如 `ihui_<24 hex>`。 */
export const API_KEY_PUBLIC_PREFIX = 'ihui_'

/** 形态不成立(非 `ihui_` 前缀)⇒ 直接 false,不必查库。 */
export function hasApiKeyPublicShape(key: string | undefined): key is string {
  return typeof key === 'string' && key.startsWith(API_KEY_PUBLIC_PREFIX) && key.length > API_KEY_PUBLIC_PREFIX.length
}

/**
 * 这把 API Key 在库里真实存在、处于 active、且未过期 ⇒ true。
 *
 * 任何异常(DB 不可达、schema 不匹配等)⇒ false(fail-closed):判据不可用时拒绝豁免,
 * 而不是"查不到就先信客户端说的"。fail-open 等于把 CSRF 防线交给攻击者能否让 DB 抖动。
 */
export async function isRegisteredUsableApiKey(key: string | undefined): Promise<boolean> {
  if (!hasApiKeyPublicShape(key)) return false
  try {
    const [row] = await db
      .select({ status: developerApiKeys.status, expiresAt: developerApiKeys.expiresAt })
      .from(developerApiKeys)
      .where(eq(developerApiKeys.key, key))
      .limit(1)
    if (!row || row.status !== 'active') return false
    if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return false
    return true
  } catch {
    return false
  }
}
// ⁠‌‌‌‍‍‌‍‍‌‌‌‍‍‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‌‌‌‍‍‌‌‍‍‌‌‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‍‍‌‌‍‍‌‌‍‍‌‌‌‍‍‌‌‌‌‌‌‍‌‌‌‌‍‌‌‌‌‍‍‌‍‍‍‍‌‌‌‍‍‌‍‍‍‍‌‌‌‌‍‍‍‍‍‍‌‌‍‌‍‍‍️‌‌‍‍‌‌‍‍‍‍‌‌‌‍‌‍‍‍‍‌‍‍‌‍‍‍‌‍‌‍‍⁠
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
