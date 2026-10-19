// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

/**
 * 移动端账号安全只读端点(GET /user/security)。
 *
 * RN 的 SecuritySettingsScreen(apps/mobile-rn/src/screens/SecuritySettingsScreen.tsx)
 * 一直在打这条路径,后端从未注册 ⇒ 加载必然报错(屏侧 throw→setError;本仓最高频失效型)。
 * 这里按移动端已声明的契约 SecuritySettingsItem(packages/types/src/app-account.ts)补最小读面。
 *
 * 数据源全部现成,零迁移:
 * - twoFactorEnabled / passwordEnabled ← users 表(two_factor_enabled / password_hash),
 *   与 GET /auth/2fa/status 走同一条查询函数 findUserById,不在路由里重写 SQL;
 * - biometricEnabled / loginAlert ← user_preferences(group='security'),
 *   值口径 '1'/'0'(与 auth.ts 的 login-preferences 同一份约定)。
 *   这两项**没有写入方**(共享屏的开关目前只在本地 setState),所以未配置时如实回落 false ——
 *   那是"未开启"的真实读数,不得写死 true,也不得返回 null 打碎 boolean 契约。
 *
 * 身份只取 JWT 主体 request.userId(由 checkAuth 注入);客户端自报的 userId 一律不读。
 */
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../plugins/auth.js'
import { success, error } from '../utils/response.js'
import { findUserById } from '../db/queries.js'
import { USER_PREFERENCE_GROUPS, findUserPreferences } from '../db/user-preferences-queries.js'

/**
 * 本端点不接受任何查询参数:身份只从令牌主体进。
 * 混入 `?userId=` 一律当场 400(照 cli-tool-invoke-audit 的口径 —— 自报字段不开后门,
 * 也不静默摘除,静默摘除等于告诉调用方"自报有人看")。
 */
const querySchema = z.strictObject({})

/** user_preferences(group='security') 里本端点读取的两个键。 */
const SECURITY_PREFERENCE_KEYS = {
  biometric: 'biometric',
  loginAlert: 'loginAlert',
} as const

/** 偏好折成布尔:缺行与缺值都算未开启(与 parseLoginPreferences 的 autoLogin 同口径)。 */
function isPreferenceOn(prefs: Map<string, string | null>, key: string): boolean {
  return prefs.get(key) === '1'
}

export const userSecurityRoutes: FastifyPluginAsync = async (server) => {
  // 与 /courses/:id/* 同一档:账号安全读数属归属型数据,整条要登录,不开公开读面。
  server.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /user/security - 当前用户的四项安全开关
  server.get('/user/security', async (request, reply) => {
    if (!querySchema.safeParse(request.query).success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    const userId = request.userId!
    const user = await findUserById(userId)
    if (!user) return reply.status(404).send(error(404, '用户不存在'))
    const { list } = await findUserPreferences(userId, USER_PREFERENCE_GROUPS.security)
    const prefs = new Map(list.map((row) => [row.key, row.value]))
    return reply.send(
      success({
        passwordEnabled: user.passwordHash !== null && user.passwordHash !== '',
        biometricEnabled: isPreferenceOn(prefs, SECURITY_PREFERENCE_KEYS.biometric),
        twoFactorEnabled: user.twoFactorEnabled,
        loginAlert: isPreferenceOn(prefs, SECURITY_PREFERENCE_KEYS.loginAlert),
      }),
    )
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
