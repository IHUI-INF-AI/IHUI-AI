// © 2026 IHUI AI (智汇AI) · 版权所有者: 李春川 (Li Chunchuan) · https://aizhs.top
// Provenance-watermarked. 未授权商用可被溯源追责 (Apache-2.0 须保留本声明与 NOTICE)。
// [IHUI-AI-PROVENANCE]:⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠

import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { checkAuth } from '../../plugins/auth.js'
import { success, error } from '../../utils/response.js'
import {
  deleteUserPreference,
  findUserPreferences,
  upsertUserPreference,
  USER_PREFERENCE_GROUPS,
} from '../../db/user-preferences-queries.js'
import {
  isIpLiteral,
  IP_WHITELIST_KEY,
  readIpWhitelist,
  recordIpWhitelistChangeSourceIp,
} from './ip-whitelist-guard.js'

/**
 * 账号级安全配置的读写面 —— 承接两处此前**只有 UI、没有后端**的面板：
 *   GET/POST/DELETE /api/user/ip-whitelist      web settings/IpWhitelist.tsx 一直在调，GET 从未注册
 *   GET/PUT        /api/agent/security-config  web settings/agent-security 在调，整条路由不存在
 *
 * 存储复用现成的 user_preferences(group='security') 逐键口径 —— 与 biometric/loginAlert 同一族
 * (值 '1'/'0'，见 routes/user-security-routes.ts 的头注)，不为此加迁移。
 * 身份只取 JWT 主体 request.userId(由 checkAuth 注入)，客户端自报的 userId 一律不读；
 * 三条 GET/POST/DELETE 的读写字段逐字等于 web 侧既有调用契约
 * (src/components/settings/IpWhitelist.tsx 把 GET 的 data 当 string[] 直接 setIps，
 *  这里回对象会把那张卡炸掉)，不另立形状、也不回带没人消费 currentIp/enabled 这类字段。
 *
 * **本文件只做存储与自救锚点，判定链在 ./ip-whitelist-guard.ts**，两件事各自的原因：
 *   - IP 白名单只拦**新登录会话**，不碰换网后的续期（统一签发出口不带 request.ip，且
 *     passkey / MFA 两条腿不走它，接一层会漏腿）。闸门挂在凭据验证之后、签发之前，
 *     已在线会话不受影响 —— 这是机主定的产品语义，不是待补的坑。
 *   - agent 护栏五字段**已按登录主体生效**：ai-service 侧 app/services/agent_security_prefs.py
 *     读的就是这里写的键(进程默认 ⊕ 该 principal 的显式表态)。两处口径必须一起看：
 *     这里的默认值(true / 'flag' / 'enforce' / true / false)与该模块的回落快照同值，
 *     改任何一边都要同批改另一边；硬门(危险命令、路径穿越、命令注入)不吃这些开关。
 *     另注：exec_policy_decision.py 头注自称"未接线"已过期 —— 它经
 *     app/services/agent_engine.py 的 _unmatched_command_decision_meta 被消费(只加文案位、
 *     不改处置)，那条自述留着会误导下一个来接的人。
 */

const GROUP = USER_PREFERENCE_GROUPS.security

const GUARD_POLICIES = ['flag', 'sanitize', 'refuse'] as const
const EXEC_MODES = ['enforce', 'audit', 'off'] as const

/** 入站契约一律 strictObject：自报的多余字段当场 400，不静默摘除。 */
const ipBodySchema = z.strictObject({ ip: z.string().min(1).max(64) })
const ipQuerySchema = z.strictObject({ ip: z.string().min(1).max(64) })
const emptyQuerySchema = z.strictObject({})

const agentSecurityPatchSchema = z
  .strictObject({
    prompt_guard_enabled: z.boolean().optional(),
    prompt_guard_policy: z.enum(GUARD_POLICIES).optional(),
    exec_policy_mode: z.enum(EXEC_MODES).optional(),
    input_scan_enabled: z.boolean().optional(),
    pipeline_record_enabled: z.boolean().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: '至少要提交一个字段' })

function pickEnum<T extends string>(
  raw: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes((raw ?? '') as T) ? (raw as T) : fallback
}

export const userSecurityConfigRoutes: FastifyPluginAsync = async (server) => {
  server.addHook('preHandler', async (request, reply) => {
    if (!(await checkAuth(request, reply))) return
  })

  // GET /user/ip-whitelist — 列表（web 侧 data 直接当 string[] 用）
  server.get('/user/ip-whitelist', async (request, reply) => {
    if (!emptyQuerySchema.safeParse(request.query).success) {
      return reply.status(400).send(error(400, '参数错误'))
    }
    return reply.send(success(await readIpWhitelist(request.userId!)))
  })

  // POST /user/ip-whitelist {ip} — 幂等追加；响应仍是字符串数组
  server.post('/user/ip-whitelist', async (request, reply) => {
    const parsed = ipBodySchema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    if (!isIpLiteral(parsed.data.ip)) {
      return reply.status(400).send(error(400, '请输入合法的 IP 地址（不支持 CIDR 段）'))
    }
    const userId = request.userId!
    const ips = await readIpWhitelist(userId)
    if (!ips.includes(parsed.data.ip)) ips.push(parsed.data.ip)
    await upsertUserPreference(userId, GROUP, IP_WHITELIST_KEY, JSON.stringify(ips))
    await recordIpWhitelistChangeSourceIp(userId, request.ip)
    return reply.send(success(ips))
  })

  // DELETE /user/ip-whitelist?ip= — 摘除一条（web 侧现有调用形状）
  server.delete('/user/ip-whitelist', async (request, reply) => {
    const parsed = ipQuerySchema.safeParse(request.query)
    if (!parsed.success) return reply.status(400).send(error(400, '参数错误'))
    const userId = request.userId!
    const next = (await readIpWhitelist(userId)).filter((x) => x !== parsed.data.ip)
    if (next.length === 0) await deleteUserPreference(userId, GROUP, IP_WHITELIST_KEY)
    else await upsertUserPreference(userId, GROUP, IP_WHITELIST_KEY, JSON.stringify(next))
    // 清空/删项也要留自救锚点：能走到这里说明这台 IP 已经登录成功过
    await recordIpWhitelistChangeSourceIp(userId, request.ip)
    return reply.send(success(next))
  })

  // GET /agent/security-config — 缺行回默认，与 web 页 useState 初值同一组常量
  server.get('/agent/security-config', async (request, reply) => {
    const { list } = await findUserPreferences(request.userId!, GROUP)
    const prefs = new Map(list.map((row) => [row.key, row.value]))
    const bool = (key: string, whenMissing: boolean): boolean => {
      const v = prefs.get(`agentSecurity.${key}`)
      if (v === '1') return true
      if (v === '0') return false
      return whenMissing
    }
    return reply.send(
      success({
        prompt_guard_enabled: bool('prompt_guard_enabled', true),
        prompt_guard_policy: pickEnum(
          prefs.get('agentSecurity.prompt_guard_policy'),
          GUARD_POLICIES,
          'flag',
        ),
        exec_policy_mode: pickEnum(
          prefs.get('agentSecurity.exec_policy_mode'),
          EXEC_MODES,
          'enforce',
        ),
        input_scan_enabled: bool('input_scan_enabled', true),
        pipeline_record_enabled: bool('pipeline_record_enabled', false),
      }),
    )
  })

  // PUT /agent/security-config — 局部更新，只接受已知键（strictObject：自报未知字段当场 400）
  server.put('/agent/security-config', async (request, reply) => {
    const parsed = agentSecurityPatchSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send(error(400, parsed.error.issues[0]?.message ?? '参数错误'))
    }
    const userId = request.userId!
    for (const [key, value] of Object.entries(parsed.data)) {
      const stored = typeof value === 'boolean' ? (value ? '1' : '0') : String(value)
      await upsertUserPreference(userId, GROUP, `agentSecurity.${key}`, stored)
    }
    return reply.send(success(parsed.data))
  })
}
// ⁠​‌​​‌​​‌‍‍​‌​​‌​​​‍‍​‌​‌​‌​‌‍‍​‌​​‌​​‌‍‍​​‌​‌‌​‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌​​‌‌‌‌​‌​‍‍‌‌​‌‌​​​‌​​​‌‌‌‍‍​‌​​​​​‌‍‍​‌​​‌​​‌‍‍‌​‌‌​‌‌‌‍‍‌‌​​‌‌‌​‌​​‌‌‌​‍‍‌‌​​‌‌​​​‌​​‌​‌‍‍‌​‌‌‌​‌‌‌​‌‌‌​‌‍‍‌​‌‌​‌‌‌‍‍​‌​​‌‌​​‍‍​‌​​​​‌‌‍‍‌​‌‌​‌‌‌‍‍​‌‌​​​​‌‍‍​‌‌​‌​​‌‍‍​‌‌‌‌​‌​‍‍​‌‌​‌​​​‍‍​‌‌‌​​‌‌‍‍​​‌​‌‌‌​‍‍​‌‌‌​‌​​‍‍​‌‌​‌‌‌‌‍‍​‌‌‌​​​​‍‍‌​‌‌​‌‌‌‍‍​‌​‌​​​​‍‍​‌​‌​​‌​‍‍​‌​​‌‌‌‌‍‍​‌​‌​‌‌​‍‍​‌​​​‌​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​​‌‍‍​‌​​‌‌‌​‍‍​‌​​​​‌‌‍‍​‌​​​‌​‌‍‍​​‌​‌‌​‌‍‍​​‌‌​​‌​‍‍​​‌‌​​​​‍‍​​‌‌​​‌​‍‍​​‌‌​‌‌​⁠
